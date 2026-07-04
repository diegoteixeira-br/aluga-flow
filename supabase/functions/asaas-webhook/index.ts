// Edge Function: asaas-webhook
// Substitui src/routes/api/public/asaas-webhook.ts
// Configure no painel ASAAS o token em "asaas-access-token" igual ao secret ASAAS_WEBHOOK_TOKEN.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "GET") return new Response("ok", { status: 200 });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  const token = req.headers.get("asaas-access-token") ?? req.headers.get("x-asaas-token");
  if (!expected || token !== expected) return new Response("Unauthorized", { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  const { event, payment } = body;
  if (!event || !payment?.id) return new Response("ignored", { status: 200 });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const paid = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_RECEIVED_IN_CASH"]);
  const refunded = new Set(["PAYMENT_REFUNDED", "PAYMENT_DELETED"]);

  if (paid.has(event)) {
    const paidDate = payment.paymentDate || payment.clientPaymentDate || new Date().toISOString().slice(0, 10);
    const { error } = await sb
      .from("payments")
      .update({
        status: "pago",
        paid_date: paidDate,
        paid_amount: payment.value ?? null,
        method: (payment.billingType ?? "").toLowerCase() === "pix" ? "pix" : "boleto",
      })
      .eq("asaas_payment_id", payment.id);
    if (error) return new Response(error.message, { status: 500 });
  } else if (refunded.has(event)) {
    await sb.from("payments").update({ status: "cancelado" }).eq("asaas_payment_id", payment.id);
  }

  return new Response("ok", { status: 200 });
});
