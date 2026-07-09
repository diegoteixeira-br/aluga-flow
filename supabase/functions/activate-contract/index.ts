// Edge Function: activate-contract
// Ativa um contrato manual após o anexo do PDF assinado.
// - Autenticação: bearer JWT do usuário logado
// - Verifica que o contrato pertence ao usuário e está em 'aguardando_assinatura_fisica'
// - Atualiza status para 'ativo', signature_status='assinado', signed_at, signed_pdf_path
// - Gera pagamentos mensais (se ainda não existirem)
// - Envia email de conclusão ao locador e ao inquilino
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail, brl, dateBR } from "../_shared/resend.ts";
import { LOGO_ATTACHMENT, LOGO_SRC } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function buildMonthlyPayments(a: { contract_id: string; user_id: string; start_date: string; end_date: string; due_day: number; amount: number }) {
  const out: Array<{ contract_id: string; user_id: string; reference_month: string; due_date: string; amount: number; status: "pendente" }> = [];
  const start = new Date(a.start_date + "T00:00:00");
  const end = new Date(a.end_date + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return out;
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    const y = cur.getFullYear(), m = cur.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = Math.min(a.due_day, lastDay);
    const due = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const ref = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    out.push({ contract_id: a.contract_id, user_id: a.user_id, reference_month: ref, due_date: due, amount: a.amount, status: "pendente" });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

function emailHtml(args: { property: string; tenant: string; owner: string; start: string; end: string; rent: number; due_day: number }) {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f6f8;margin:0;padding:24px;color:#1f2937">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <div style="text-align:center;margin-bottom:12px"><img src="${LOGO_SRC}" alt="AlugaFlow" style="max-width:140px"/></div>
      <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px">Contrato ativado ✔</h1>
      <p style="line-height:1.6">O contrato de locação foi <b>concluído e ativado</b> após o envio do PDF assinado.</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:12px 0;font-size:14px">
        <p style="margin:4px 0"><b>Imóvel:</b> ${args.property}</p>
        <p style="margin:4px 0"><b>Locador:</b> ${args.owner}</p>
        <p style="margin:4px 0"><b>Locatário:</b> ${args.tenant}</p>
        <p style="margin:4px 0"><b>Vigência:</b> ${dateBR(args.start)} a ${dateBR(args.end)}</p>
        <p style="margin:4px 0"><b>Aluguel:</b> ${brl(args.rent)} — vencimento dia ${args.due_day}</p>
      </div>
      <p style="line-height:1.6">A partir de agora as cobranças mensais estão liberadas no painel.</p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;text-align:center">AlugaFlow — gestão de aluguéis</p>
    </div>
  </body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid body" }, 400); }
  const contractId = String(body.contractId ?? "");
  const signedPdfPath = String(body.signedPdfPath ?? "");
  if (!contractId || !signedPdfPath) return json({ error: "contractId e signedPdfPath são obrigatórios" }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false } });

  const { data: contract, error: cErr } = await admin
    .from("contracts")
    .select(`id, user_id, status, start_date, end_date, rent_amount, due_day,
             property:properties(nickname), tenant:tenants(full_name, email)`)
    .eq("id", contractId)
    .maybeSingle();
  if (cErr) return json({ error: cErr.message }, 500);
  if (!contract || contract.user_id !== user.id) return json({ error: "Contrato não encontrado" }, 404);
  if (contract.status !== "aguardando_assinatura_fisica") {
    return json({ error: `Contrato está em status '${contract.status}', não pode ser ativado.` }, 409);
  }

  // Atualiza contrato
  const { error: uErr } = await admin.from("contracts").update({
    status: "ativo",
    signature_status: "assinado",
    signed_at: new Date().toISOString(),
    signed_pdf_path: signedPdfPath,
  }).eq("id", contractId);
  if (uErr) return json({ error: uErr.message }, 500);

  // Gera pagamentos se ainda não existirem
  const { count } = await admin.from("payments").select("id", { count: "exact", head: true }).eq("contract_id", contractId);
  let paymentsCreated = 0;
  if (!count || count === 0) {
    const payments = buildMonthlyPayments({
      contract_id: contract.id, user_id: user.id,
      start_date: contract.start_date, end_date: contract.end_date,
      due_day: contract.due_day, amount: Number(contract.rent_amount),
    });
    if (payments.length > 0) {
      const { error: pErr } = await admin.from("payments").insert(payments);
      if (!pErr) paymentsCreated = payments.length;
    }
  }

  // Email
  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const property = (contract as any).property;
  const tenant = (contract as any).tenant;
  const html = emailHtml({
    property: property?.nickname ?? "—",
    tenant: tenant?.full_name ?? "—",
    owner: profile?.full_name ?? user.email ?? "—",
    start: contract.start_date,
    end: contract.end_date,
    rent: Number(contract.rent_amount),
    due_day: contract.due_day,
  });
  const recipients = [user.email, tenant?.email].filter((x): x is string => !!x);
  if (recipients.length > 0) {
    const r = await sendEmail({
      to: recipients,
      subject: `Contrato ativado — ${property?.nickname ?? "AlugaFlow"}`,
      html,
      attachments: [LOGO_ATTACHMENT],
    });
    if (r.error) console.error("[activate-contract] email fail:", r.error);
  }

  return json({ ok: true, paymentsCreated });
});
