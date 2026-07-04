// Edge Function: sign-contract (pública)
// Substitui src/routes/api/public/sign-contract.ts
// GET  ?token=...                                 -> retorna contrato p/ assinante
// POST { token, signed_name, signed_cpf }         -> registra assinatura
// verify_jwt = false (público, autenticado pelo token único da assinatura)
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function onlyDigits(s: string) { return s.replace(/\D+/g, ""); }
function isValidCPF(cpf: string): boolean {
  const c = onlyDigits(cpf);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(c[i]) * (slice + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(c[9]) && calc(10) === parseInt(c[10]);
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function getContractView(token: string) {
  const sb = admin();
  const { data: sig, error } = await sb
    .from("contract_signatures")
    .select("id, role, name, email, signed_at, contract_id")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!sig) return null;

  const { data: contract } = await sb
    .from("contracts")
    .select(`
      id, user_id, contract_type, start_date, end_date, rent_amount, due_day,
      adjustment_index, adjustment_frequency_months, guarantee_type, guarantee_months,
      extra_charges, notes, deposit_amount,
      guarantor_name, guarantor_cpf, guarantor_rg, guarantor_email, guarantor_phone, guarantor_address,
      property:properties(nickname,address,city,state,zip_code,type,bedrooms,area_m2),
      tenant:tenants(full_name,cpf,rg,email,phone,address_street,address_number,address_neighborhood,address_city,address_state)
    `)
    .eq("id", sig.contract_id)
    .maybeSingle();
  if (!contract) return null;

  const { data: ownerProfile } = await sb
    .from("profiles")
    .select("full_name, cpf, phone, address_street, address_number, address_neighborhood, address_city, address_uf, address_zip, bank_name, bank_agency, bank_account, pix_key")
    .eq("id", contract.user_id)
    .maybeSingle();

  const { data: allSigs } = await sb
    .from("contract_signatures")
    .select("role, name, signed_at")
    .eq("contract_id", sig.contract_id)
    .order("created_at", { ascending: true });

  return { signature: sig, contract, owner: ownerProfile, signatures: allSigs ?? [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);

  if (req.method === "GET") {
    const token = url.searchParams.get("token") ?? "";
    if (!token) return json({ error: "missing token" }, 400);
    try {
      const view = await getContractView(token);
      if (!view) return json({ error: "invalid token" }, 404);
      return json(view);
    } catch (e) { return json({ error: (e as Error).message }, 500); }
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid body" }, 400); }

  const token = (body.token ?? "") as string;
  const name = ((body.signed_name ?? "") as string).trim();
  const cpf = onlyDigits((body.signed_cpf ?? "") as string);
  if (!token || name.length < 3) return json({ error: "Nome obrigatório" }, 400);
  if (!isValidCPF(cpf)) return json({ error: "CPF inválido" }, 400);

  const sb = admin();
  const { data: sig, error } = await sb
    .from("contract_signatures")
    .select("id, contract_id, signed_at")
    .eq("token", token)
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!sig) return json({ error: "Token inválido" }, 404);
  if (sig.signed_at) return json({ error: "Já assinado" }, 409);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const { error: uErr } = await sb
    .from("contract_signatures")
    .update({ signed_name: name, signed_cpf: cpf, signed_at: new Date().toISOString(), signer_ip: ip })
    .eq("id", sig.id);
  if (uErr) return json({ error: uErr.message }, 500);

  const { data: all } = await sb
    .from("contract_signatures")
    .select("signed_at")
    .eq("contract_id", sig.contract_id);
  const total = all?.length ?? 0;
  const done = (all ?? []).filter((x) => x.signed_at).length;
  if (total > 0 && done === total) {
    await sb.from("contracts")
      .update({ signature_status: "assinado", signed_at: new Date().toISOString() })
      .eq("id", sig.contract_id);
  } else if (done > 0) {
    await sb.from("contracts")
      .update({ signature_status: "parcial" })
      .eq("id", sig.contract_id);
  }

  return json({ ok: true, completed: done === total });
});
