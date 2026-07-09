// Edge Function: contract-esign
// Cria contrato para assinatura eletrônica via D4Sign, com cobrança da taxa via Stripe.
// - Plano Gratuito (free): cria Stripe Checkout Session (pagamento único R$ 19,90). Contrato entra em 'aguardando_pagamento'.
//   Após pagamento confirmado (stripe-webhook), o documento é enviado ao D4Sign.
// - Plano Pago (investidor/imobiliaria): cria Stripe InvoiceItem avulso na próxima fatura recorrente,
//   e envia imediatamente ao D4Sign. Contrato entra em 'processando_assinatura'.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { d4UploadPdf, d4CreateSignerList, d4SendToSign, type D4Signer } from "../_shared/d4sign.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ESIGN_FEE_CENTS = 1990;
const ESIGN_FEE_LABEL = "Taxa de assinatura eletrônica (D4Sign)";

async function stripeFetch(path: string, body: Record<string, string>, secret: string): Promise<any> {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) p.append(k, v);
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: p.toString(),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Stripe ${r.status}`);
  return j;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:application\/pdf;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const STRIPE = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE) return json({ error: "STRIPE_SECRET_KEY não configurado" }, 500);

  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid body" }, 400); }

  const contract = body.contract as Record<string, any> | undefined;
  const pdfBase64 = body.pdfBase64 as string | undefined;
  const origin = (body.origin as string | undefined) ?? "";
  if (!contract || !pdfBase64) return json({ error: "contract e pdfBase64 são obrigatórios" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  // Plano do usuário
  const { data: profile } = await admin.from("profiles").select("full_name, plan").eq("id", user.id).maybeSingle();
  const plan = (profile?.plan ?? "free") as string;
  const isPaid = plan === "investidor" || plan === "imobiliaria";

  // Tenant + property (necessários para signatários D4Sign)
  const { data: tenant } = await admin.from("tenants").select("full_name, email").eq("id", contract.tenant_id).maybeSingle();
  if (!tenant?.email) return json({ error: "Inquilino sem email — impossível iniciar assinatura eletrônica." }, 400);
  if (!user.email) return json({ error: "Usuário sem email cadastrado." }, 400);

  // Insere contrato
  const insertPayload = {
    ...contract,
    user_id: user.id,
    signature_mode: "eletronica",
    signature_status: "pendente",
    status: isPaid ? "processando_assinatura" : "aguardando_pagamento",
    signature_fee_amount: ESIGN_FEE_CENTS / 100,
    signature_fee_status: "pendente",
  };
  const { data: ins, error: insErr } = await admin.from("contracts").insert(insertPayload).select("id").single();
  if (insErr) return json({ error: insErr.message }, 500);
  const contractId = ins.id as string;

  // Upload do PDF original ao storage (será usado pelo webhook para enviar ao D4Sign após pagamento)
  const pdfBytes = base64ToBytes(pdfBase64);
  const pdfPath = `${user.id}/${contractId}/original.pdf`;
  const { error: upErr } = await admin.storage.from("signed-contracts").upload(pdfPath, pdfBytes, {
    contentType: "application/pdf", upsert: true,
  });
  if (upErr) return json({ error: `Falha ao salvar PDF: ${upErr.message}` }, 500);
  await admin.from("contracts").update({ signed_pdf_path: pdfPath }).eq("id", contractId);

  // Signatários (usados imediatamente OU depois pelo webhook)
  const signers: D4Signer[] = [
    { email: user.email, act: "1" },
    { email: tenant.email, act: "1" },
  ];
  if (contract.guarantor_email) signers.push({ email: String(contract.guarantor_email), act: "1" });

  if (isPaid) {
    // Buscar customer id ativo
    const { data: sub } = await admin.from("subscriptions")
      .select("stripe_customer_id").eq("user_id", user.id)
      .not("stripe_customer_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!sub?.stripe_customer_id) {
      await admin.from("contracts").delete().eq("id", contractId);
      return json({ error: "Assinatura Stripe não encontrada. Verifique seu plano." }, 400);
    }
    // Cria InvoiceItem avulso — cobrado na próxima fatura recorrente
    const invoiceItem = await stripeFetch("/invoiceitems", {
      customer: sub.stripe_customer_id,
      amount: String(ESIGN_FEE_CENTS),
      currency: "brl",
      description: `${ESIGN_FEE_LABEL} — contrato ${contractId}`,
      "metadata[contract_id]": contractId,
      "metadata[type]": "esign_fee",
    }, STRIPE).catch((e) => { throw e; });

    await admin.from("contracts").update({
      stripe_invoice_item_id: invoiceItem.id,
      signature_fee_status: "agendado_fatura",
    }).eq("id", contractId);

    // Envia imediatamente ao D4Sign
    try {
      const up = await d4UploadPdf(`contrato-${contractId}.pdf`, pdfBytes);
      await d4CreateSignerList(up.uuid, signers);
      await d4SendToSign(up.uuid, { message: "Segue o contrato de locação para assinatura eletrônica." });
      await admin.from("contracts").update({
        d4sign_document_id: up.uuid,
        d4sign_status: "enviado",
      }).eq("id", contractId);
      return json({ ok: true, contractId, mode: "paid", d4signDocumentId: up.uuid });
    } catch (e) {
      const msg = (e as Error).message;
      await admin.from("contracts").update({ d4sign_status: `erro: ${msg}`.slice(0, 200) }).eq("id", contractId);
      return json({ error: `D4Sign: ${msg}`, contractId }, 502);
    }
  }

  // Plano Gratuito → Stripe Checkout (pagamento único)
  const successUrl = `${origin || "https://alugaflow.com.br"}/contracts?esign_paid=1&contract=${contractId}`;
  const cancelUrl = `${origin || "https://alugaflow.com.br"}/contracts?esign_cancel=1&contract=${contractId}`;
  const session = await stripeFetch("/checkout/sessions", {
    mode: "payment",
    "line_items[0][price_data][currency]": "brl",
    "line_items[0][price_data][unit_amount]": String(ESIGN_FEE_CENTS),
    "line_items[0][price_data][product_data][name]": ESIGN_FEE_LABEL,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: user.email,
    "metadata[contract_id]": contractId,
    "metadata[type]": "esign_fee",
    "metadata[user_id]": user.id,
  }, STRIPE);

  await admin.from("contracts").update({
    stripe_checkout_session_id: session.id,
  }).eq("id", contractId);

  return json({ ok: true, contractId, mode: "free", checkoutUrl: session.url });
});
