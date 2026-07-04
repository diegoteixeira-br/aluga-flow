// Supabase Edge Function: send-charges
// Roda diariamente (pg_cron) e cria cobranças ASAAS para pagamentos
// pendentes cujo vencimento cai em X dias (config por proprietário).
// Pode ser invocada manualmente via supabase.functions.invoke('send-charges').
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ASAAS_URLS: Record<string, string> = {
  sandbox: "https://sandbox.asaas.com/api/v3",
  production: "https://api.asaas.com/v3",
};

function onlyDigits(s: string | null | undefined) {
  return (s ?? "").replace(/\D+/g, "");
}

async function asaasFetch(env: string, key: string, path: string, init?: RequestInit) {
  const base = ASAAS_URLS[env] ?? ASAAS_URLS.sandbox;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: key,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg =
      body?.errors?.map?.((e: any) => e.description).join("; ") ||
      text ||
      `ASAAS HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

async function ensureCustomer(sb: any, env: string, key: string, tenant: any) {
  if (tenant.asaas_customer_id) return tenant.asaas_customer_id;
  const cpf = onlyDigits(tenant.cpf);
  if (!cpf) throw new Error(`Inquilino ${tenant.full_name} sem CPF`);
  const created = await asaasFetch(env, key, "/customers", {
    method: "POST",
    body: JSON.stringify({
      name: tenant.full_name,
      cpfCnpj: cpf,
      email: tenant.email ?? undefined,
      mobilePhone: onlyDigits(tenant.phone) || undefined,
      notificationDisabled: false,
    }),
  });
  await sb.from("tenants").update({ asaas_customer_id: String(created.id) }).eq("id", tenant.id);
  return String(created.id);
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Optional payload: { user_id?: string } restringe a um proprietário (botão "testar agora")
  let onlyUserId: string | null = null;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.user_id) onlyUserId = String(body.user_id);
    }
  } catch { /* noop */ }

  // 1. Buscar perfis com automação ativa
  let profileQ = sb
    .from("profiles")
    .select("id, asaas_api_key, asaas_environment, auto_charge_days_before, auto_charge_message")
    .eq("auto_charge_enabled", true)
    .not("asaas_api_key", "is", null);
  if (onlyUserId) profileQ = profileQ.eq("id", onlyUserId);

  const { data: profiles, error: pErr } = await profileQ;
  if (pErr) {
    return new Response(JSON.stringify({ error: pErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  let totalCreated = 0;
  let totalFailed = 0;

  for (const prof of profiles ?? []) {
    const days = Number(prof.auto_charge_days_before ?? 3);
    const targetDate = addDaysISO(days);
    const env = (prof.asaas_environment as string) || "sandbox";
    const key = prof.asaas_api_key as string;

    const { data: payments, error: payErr } = await sb
      .from("payments")
      .select(
        "id, amount, due_date, reference_month, asaas_payment_id, charge_sent_at, contract:contracts(tenant:tenants(id, full_name, cpf, email, phone, asaas_customer_id))",
      )
      .eq("user_id", prof.id)
      .eq("status", "pendente")
      .eq("due_date", targetDate)
      .is("charge_sent_at", null);

    if (payErr) {
      results.push({ user_id: prof.id, error: payErr.message });
      continue;
    }

    let created = 0; let failed = 0; const errors: string[] = [];
    for (const p of payments ?? []) {
      try {
        const tenant = (p as any).contract?.tenant;
        if (!tenant) throw new Error("Sem inquilino vinculado");
        const customerId = await ensureCustomer(sb, env, key, tenant);
        const refLabel = p.reference_month
          ? new Date(p.reference_month + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
          : "";
        const description = [
          `Aluguel ${refLabel}`.trim(),
          prof.auto_charge_message || "",
        ].filter(Boolean).join(" — ");

        const charge = await asaasFetch(env, key, "/payments", {
          method: "POST",
          body: JSON.stringify({
            customer: customerId,
            billingType: "UNDEFINED",
            value: Number(p.amount),
            dueDate: p.due_date,
            description,
            externalReference: p.id,
          }),
        });

        await sb.from("payments").update({
          asaas_payment_id: String(charge.id),
          asaas_invoice_url: charge.invoiceUrl || charge.bankSlipUrl || "",
          charge_sent_at: new Date().toISOString(),
        }).eq("id", p.id);

        created++;
      } catch (e) {
        failed++;
        errors.push(`${p.id}: ${(e as Error).message}`);
      }
    }
    totalCreated += created;
    totalFailed += failed;
    results.push({
      user_id: prof.id,
      target_date: targetDate,
      checked: payments?.length ?? 0,
      created,
      failed,
      errors: errors.slice(0, 5),
    });
  }

  return new Response(
    JSON.stringify({ ok: true, profiles: profiles?.length ?? 0, created: totalCreated, failed: totalFailed, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
