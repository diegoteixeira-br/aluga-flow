// Edge Function: email-events
// Recebe Database Webhooks do Supabase para 3 eventos:
//   - INSERT em profiles  -> e-mail de boas-vindas
//   - INSERT em leads     -> notificação ao proprietário
//   - UPDATE em payments (status -> 'pago') -> recibo ao inquilino
// Protegido por header x-webhook-secret (env EMAIL_WEBHOOK_SECRET).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail } from "../_shared/resend.ts";
import {
  welcomeEmail, leadNotificationEmail, paymentReceiptEmail, LOGO_ATTACHMENT,
} from "../_shared/email-templates.ts";


const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
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

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const table = String(payload?.table || "");
  const type = String(payload?.type || ""); // INSERT | UPDATE | DELETE
  const rec = payload?.record || {};
  const old = payload?.old_record || {};

  try {
    // --- 1. BOAS-VINDAS ---
    if (table === "profiles" && type === "INSERT") {
      const { data: u } = await sb.auth.admin.getUserById(rec.id);
      const email = u?.user?.email;
      if (!email) return json({ skipped: "no email" });
      const tpl = welcomeEmail(rec.full_name || "");
      const r = await sendEmail({ to: email, ...tpl, attachments: [LOGO_ATTACHMENT] });
      return json({ ok: true, kind: "welcome", id: r.id, error: r.error });
    }

    // --- 2. NOVO LEAD ---
    if (table === "leads" && type === "INSERT") {
      const ownerId = rec.user_id;
      if (!ownerId) return json({ skipped: "no owner" });
      const { data: u } = await sb.auth.admin.getUserById(ownerId);
      const ownerEmail = u?.user?.email;
      if (!ownerEmail) return json({ skipped: "no owner email" });
      const { data: prof } = await sb.from("profiles").select("full_name").eq("id", ownerId).single();
      let propertyTitle: string | undefined;
      if (rec.property_id) {
        const { data: p } = await sb.from("properties").select("title").eq("id", rec.property_id).single();
        propertyTitle = p?.title;
      }
      const tpl = leadNotificationEmail({
        ownerName: prof?.full_name || "",
        leadName: rec.full_name || rec.name || "Interessado",
        leadPhone: rec.phone || rec.whatsapp || "",
        leadEmail: rec.email || "",
        propertyTitle,
        message: rec.message || rec.notes || "",
      });
      const r = await sendEmail({ to: ownerEmail, ...tpl, replyTo: rec.email || undefined, attachments: [LOGO_ATTACHMENT] });
      return json({ ok: true, kind: "lead", id: r.id, error: r.error });
    }

    // --- 3. RECIBO DE PAGAMENTO ---
    if (table === "payments" && type === "UPDATE") {
      const wasPaid = old?.status === "pago";
      const isPaid = rec?.status === "pago";
      if (wasPaid || !isPaid) return json({ skipped: "no status change" });
      if (rec.receipt_sent_at) return json({ skipped: "already sent" });

      const { data: contract } = await sb.from("contracts")
        .select("tenant:tenants(full_name, email)")
        .eq("id", rec.contract_id).single();
      const tenant = (contract as any)?.tenant;
      if (!tenant?.email) return json({ skipped: "no tenant email" });

      const tpl = paymentReceiptEmail({
        tenantName: tenant.full_name || "",
        amount: Number(rec.amount || 0),
        referenceMonth: rec.reference_month,
        paidAt: rec.paid_at || new Date().toISOString(),
      });
      const r = await sendEmail({ to: tenant.email, ...tpl, attachments: [LOGO_ATTACHMENT] });
      if (r.id) await sb.from("payments").update({ receipt_sent_at: new Date().toISOString() }).eq("id", rec.id);
      return json({ ok: true, kind: "receipt", id: r.id, error: r.error });
    }

    return json({ skipped: `unhandled ${table}/${type}` });
  } catch (e) {
    console.error("[email-events]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
