// Edge Function: asaas-charges
// Substitui src/lib/asaas.functions.ts (createServerFn).
// Ações:
//   { action: "payment",  paymentId: uuid }   -> cria 1 cobrança para um pagamento
//   { action: "contract", contractId: uuid }  -> cria cobranças para todos os pagamentos pendentes do contrato
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const msg = body?.errors?.map?.((e: any) => e.description).join("; ") || text || `ASAAS HTTP ${res.status}`;
    throw new Error(`ASAAS: ${msg}`);
  }
  return body;
}

async function ensureCustomer(sb: any, env: string, key: string, tenant: any) {
  if (tenant.asaas_customer_id) return tenant.asaas_customer_id;
  const cpf = onlyDigits(tenant.cpf);
  if (!cpf) throw new Error("Inquilino sem CPF cadastrado");
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  // Client com token do usuário (respeita RLS)
  const sb = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  let payload: any = {};
  try { payload = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  // Carrega API key do proprietário
  const { data: prof, error: pErr } = await sb
    .from("profiles")
    .select("asaas_api_key, asaas_environment")
    .eq("id", userId)
    .maybeSingle();
  if (pErr) return json({ error: pErr.message }, 500);
  if (!prof?.asaas_api_key) return json({ error: "Configure sua API Key do ASAAS em Configurações" }, 400);
  const key = prof.asaas_api_key as string;
  const env = (prof.asaas_environment as string) || "sandbox";

  try {
    if (payload.action === "payment") {
      const paymentId = String(payload.paymentId || "");
      if (!paymentId) return json({ error: "paymentId obrigatório" }, 400);

      const { data: payment, error: e1 } = await sb
        .from("payments")
        .select("id, amount, due_date, asaas_payment_id, asaas_invoice_url, contract_id, reference_month")
        .eq("id", paymentId)
        .maybeSingle();
      if (e1) throw e1;
      if (!payment) return json({ error: "Pagamento não encontrado" }, 404);
      if (payment.asaas_payment_id && payment.asaas_invoice_url) {
        return json({ paymentId: payment.asaas_payment_id, invoiceUrl: payment.asaas_invoice_url, reused: true });
      }

      const { data: contract, error: e2 } = await sb
        .from("contracts")
        .select("id, tenant_id, tenant:tenants(id, full_name, cpf, email, phone, asaas_customer_id)")
        .eq("id", payment.contract_id)
        .maybeSingle();
      if (e2) throw e2;
      if (!contract?.tenant) return json({ error: "Inquilino do contrato não encontrado" }, 404);

      const customerId = await ensureCustomer(sb, env, key, contract.tenant);
      const refLabel = payment.reference_month
        ? new Date(payment.reference_month + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        : "";

      const created = await asaasFetch(env, key, "/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: customerId,
          billingType: "UNDEFINED",
          value: Number(payment.amount),
          dueDate: payment.due_date,
          description: `Aluguel ${refLabel}`.trim(),
          externalReference: payment.id,
        }),
      });

      const asaasPaymentId = String(created.id);
      const invoiceUrl = created.invoiceUrl || created.bankSlipUrl || "";
      await sb.from("payments").update({ asaas_payment_id: asaasPaymentId, asaas_invoice_url: invoiceUrl }).eq("id", payment.id);
      return json({ paymentId: asaasPaymentId, invoiceUrl, reused: false });
    }

    if (payload.action === "contract") {
      const contractId = String(payload.contractId || "");
      if (!contractId) return json({ error: "contractId obrigatório" }, 400);

      const { data: contract, error: cErr } = await sb
        .from("contracts")
        .select("id, tenant:tenants(id, full_name, cpf, email, phone, asaas_customer_id)")
        .eq("id", contractId)
        .maybeSingle();
      if (cErr) throw cErr;
      if (!contract?.tenant) return json({ error: "Contrato/inquilino não encontrado" }, 404);

      const customerId = await ensureCustomer(sb, env, key, contract.tenant);

      const { data: payments, error: pErr2 } = await sb
        .from("payments")
        .select("id, amount, due_date, reference_month, asaas_payment_id")
        .eq("contract_id", contractId)
        .is("asaas_payment_id", null)
        .order("due_date", { ascending: true });
      if (pErr2) throw pErr2;

      let ok = 0, fail = 0; const errors: string[] = [];
      for (const p of payments ?? []) {
        try {
          const refLabel = p.reference_month
            ? new Date(p.reference_month + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
            : "";
          const created = await asaasFetch(env, key, "/payments", {
            method: "POST",
            body: JSON.stringify({
              customer: customerId,
              billingType: "UNDEFINED",
              value: Number(p.amount),
              dueDate: p.due_date,
              description: `Aluguel ${refLabel}`.trim(),
              externalReference: p.id,
            }),
          });
          await sb.from("payments").update({
            asaas_payment_id: String(created.id),
            asaas_invoice_url: created.invoiceUrl || created.bankSlipUrl || "",
          }).eq("id", p.id);
          ok++;
        } catch (e) {
          fail++; errors.push((e as Error).message);
        }
      }
      return json({ created: ok, failed: fail, errors: errors.slice(0, 3) });
    }

    return json({ error: "action inválida (use 'payment' ou 'contract')" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
