// Edge Function: stripe-webhook
// Substitui src/routes/api/public/stripe-webhook.ts.
// Público (verify_jwt = false). Valida assinatura HMAC do Stripe.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { d4UploadPdf, d4CreateSignerList, d4SendToSign, type D4Signer } from "../_shared/d4sign.ts";

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verifyStripeSig(payload: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const seg of header.split(",")) {
    const [k, v] = seg.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const signedPayload = `${ts}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  return timingSafeEq(toHex(sig), v1);
}

async function handleEsignFeePaid(admin: any, contractId: string) {
  const { data: contract } = await admin.from("contracts")
    .select("id, user_id, tenant_id, status, signed_pdf_path, guarantor_email")
    .eq("id", contractId).maybeSingle();
  if (!contract) { console.error("[esign_fee] contrato não encontrado", contractId); return; }
  if (contract.status !== "aguardando_pagamento") return;

  await admin.from("contracts").update({ signature_fee_status: "pago" }).eq("id", contractId);

  const { data: tenant } = await admin.from("tenants").select("email").eq("id", contract.tenant_id).maybeSingle();
  const { data: ownerUser } = await admin.auth.admin.getUserById(contract.user_id).catch(() => ({ data: null } as any));
  const ownerEmail = ownerUser?.user?.email as string | undefined;
  if (!tenant?.email || !ownerEmail || !contract.signed_pdf_path) {
    console.error("[esign_fee] dados incompletos para D4Sign", { contractId });
    return;
  }

  // Baixa PDF original do storage
  const { data: file, error: dlErr } = await admin.storage.from("signed-contracts").download(contract.signed_pdf_path);
  if (dlErr || !file) { console.error("[esign_fee] PDF não encontrado", dlErr); return; }
  const pdfBytes = new Uint8Array(await file.arrayBuffer());

  const signers: D4Signer[] = [
    { email: ownerEmail, act: "1" },
    { email: tenant.email, act: "1" },
  ];
  if (contract.guarantor_email) signers.push({ email: String(contract.guarantor_email), act: "1" });

  try {
    const up = await d4UploadPdf(`contrato-${contractId}.pdf`, pdfBytes);
    await d4CreateSignerList(up.uuid, signers);
    await d4SendToSign(up.uuid, { message: "Segue o contrato de locação para assinatura eletrônica." });
    await admin.from("contracts").update({
      status: "processando_assinatura",
      d4sign_document_id: up.uuid,
      d4sign_status: "enviado",
    }).eq("id", contractId);
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[esign_fee] D4Sign fail:", msg);
    await admin.from("contracts").update({ d4sign_status: `erro: ${msg}`.slice(0, 200) }).eq("id", contractId);
  }
}

async function handleEvent(event: StripeEvent, admin: any) {
  const obj = event.data.object as Record<string, any>;
  const STRIPE = Deno.env.get("STRIPE_SECRET_KEY");


  if (event.type === "checkout.session.completed") {
    const meta = (obj.metadata ?? {}) as Record<string, string>;

    // Fluxo: taxa de assinatura eletrônica (plano free)
    if (meta.type === "esign_fee" && meta.contract_id) {
      await handleEsignFeePaid(admin, meta.contract_id);
      return;
    }

    const userId = meta.user_id;
    const planType = meta.plan_type;
    const subId = obj.subscription as string | undefined;
    const customerId = obj.customer as string | undefined;
    if (!userId || !planType) return;


    let periodStart: string | null = null;
    let periodEnd: string | null = null;
    if (subId && STRIPE) {
      const r = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
        headers: { Authorization: `Bearer ${STRIPE}` },
      });
      if (r.ok) {
        const s: any = await r.json();
        if (s.current_period_start) periodStart = new Date(s.current_period_start * 1000).toISOString();
        if (s.current_period_end) periodEnd = new Date(s.current_period_end * 1000).toISOString();
      }
    }

    await admin.from("subscriptions").upsert({
      user_id: userId,
      plan_type: planType,
      stripe_subscription_id: subId ?? null,
      stripe_customer_id: customerId ?? null,
      status: "active",
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      scheduled_plan: null,
    }, { onConflict: "stripe_subscription_id" });
    await admin.from("profiles").update({ plan: planType }).eq("id", userId);
    return;
  }

  if (event.type === "customer.subscription.updated") {
    const subId = obj.id as string;
    const status = obj.status as string;
    const cancelAtEnd = obj.cancel_at_period_end as boolean;
    const periodStart = obj.current_period_start ? new Date((obj.current_period_start as number) * 1000).toISOString() : null;
    const periodEnd = obj.current_period_end ? new Date((obj.current_period_end as number) * 1000).toISOString() : null;
    await admin.from("subscriptions").update({
      status: status === "past_due" ? "past_due" : (cancelAtEnd ? "scheduled_downgrade" : "active"),
      cancel_at_period_end: cancelAtEnd,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    }).eq("stripe_subscription_id", subId);
    return;
  }

  if (event.type === "customer.subscription.deleted") {
    const subId = obj.id as string;
    const { data: sub } = await admin.from("subscriptions").select("user_id, scheduled_plan").eq("stripe_subscription_id", subId).maybeSingle();
    if (!sub) return;
    const newPlan = sub.scheduled_plan ?? "free";
    await admin.from("subscriptions").update({
      status: "cancelled",
      plan_type: newPlan,
      cancel_at_period_end: false,
      scheduled_plan: null,
    }).eq("stripe_subscription_id", subId);
    await admin.from("profiles").update({ plan: newPlan }).eq("id", sub.user_id);
    return;
  }

  if (event.type === "invoice.payment_failed") {
    const subId = obj.subscription as string | undefined;
    if (!subId) return;
    await admin.from("subscriptions").update({ status: "past_due" }).eq("stripe_subscription_id", subId);
    return;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const body = await req.text();

  if (secret) {
    const sig = req.headers.get("stripe-signature");
    const ok = await verifyStripeSig(body, sig, secret);
    if (!ok) return new Response("Invalid signature", { status: 401 });
  }

  let event: StripeEvent;
  try { event = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  try {
    await handleEvent(event, admin);
  } catch (e) {
    console.error("[stripe-webhook]", e);
    return new Response("error", { status: 500 });
  }
  return new Response("ok");
});
