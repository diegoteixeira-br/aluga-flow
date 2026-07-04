// Edge Function: email-cron
// Disparada diariamente pelo pg_cron. Envia:
//   - Lembretes para pagamentos que vencem em N dias (auto_charge_days_before, padrão 3)
//   - Avisos de atraso para pagamentos pendentes com vencimento já passado
// Marca reminder_sent_at / overdue_notice_sent_at para evitar reenvio.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail } from "../_shared/resend.ts";
import { paymentReminderEmail, paymentOverdueEmail, LOGO_ATTACHMENT } from "../_shared/email-templates.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}

function addDaysISO(d: number): string {
  const x = new Date();
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
}
function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / 86400000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const secret = Deno.env.get("EMAIL_WEBHOOK_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let remindersSent = 0, overdueSent = 0, errors: string[] = [];

  // 1) LEMBRETES - varre proprietários com automação ativa
  const { data: profiles } = await sb.from("profiles")
    .select("id, auto_charge_days_before")
    .eq("auto_charge_enabled", true);

  for (const prof of profiles ?? []) {
    const n = Number(prof.auto_charge_days_before ?? 3);
    const due = addDaysISO(n);
    const { data: pays } = await sb.from("payments")
      .select("id, amount, due_date, asaas_invoice_url, contract:contracts(tenant:tenants(full_name, email))")
      .eq("user_id", prof.id).eq("status", "pendente")
      .eq("due_date", due).is("reminder_sent_at", null);
    for (const p of pays ?? []) {
      const tenant = (p as any).contract?.tenant;
      if (!tenant?.email) continue;
      const tpl = paymentReminderEmail({
        tenantName: tenant.full_name || "",
        amount: Number(p.amount), dueDate: p.due_date, invoiceUrl: p.asaas_invoice_url || undefined,
      });
      const r = await sendEmail({ to: tenant.email, ...tpl, attachments: [LOGO_ATTACHMENT] });
      if (r.error) { errors.push(`reminder ${p.id}: ${r.error}`); continue; }
      await sb.from("payments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", p.id);
      remindersSent++;
    }
  }

  // 2) ATRASOS - todos os pagamentos pendentes com vencimento passado, ainda sem aviso
  const today = todayISO();
  const { data: late } = await sb.from("payments")
    .select("id, amount, due_date, asaas_invoice_url, contract:contracts(tenant:tenants(full_name, email))")
    .eq("status", "pendente").lt("due_date", today).is("overdue_notice_sent_at", null);

  for (const p of late ?? []) {
    const tenant = (p as any).contract?.tenant;
    if (!tenant?.email) continue;
    const tpl = paymentOverdueEmail({
      tenantName: tenant.full_name || "",
      amount: Number(p.amount), dueDate: p.due_date, invoiceUrl: p.asaas_invoice_url || undefined,
      daysLate: daysBetween(today, p.due_date),
    });
    const r = await sendEmail({ to: tenant.email, ...tpl, attachments: [LOGO_ATTACHMENT] });
    if (r.error) { errors.push(`overdue ${p.id}: ${r.error}`); continue; }
    await sb.from("payments").update({ overdue_notice_sent_at: new Date().toISOString() }).eq("id", p.id);
    overdueSent++;
  }

  return json({ ok: true, reminders: remindersSent, overdue: overdueSent, errors: errors.slice(0, 10) });
});
