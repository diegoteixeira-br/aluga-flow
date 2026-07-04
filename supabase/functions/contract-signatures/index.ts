// Edge Function: contract-signatures (autenticada)
// Substitui src/lib/signatures.functions.ts (createServerFn).
// Ações:
//   { action: "create", contractId, signers: [{role,name,email}] }
//   { action: "list",   contractId }
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ROLES = new Set(["locador", "locatario", "fiador"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const sb = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const action = body.action as string;
  const contractId = body.contractId as string;
  if (!contractId || typeof contractId !== "string") return json({ error: "contractId obrigatório" }, 400);

  // Verifica propriedade do contrato
  const { data: contract, error: cErr } = await sb
    .from("contracts")
    .select("id, user_id")
    .eq("id", contractId)
    .maybeSingle();
  if (cErr) return json({ error: cErr.message }, 500);
  if (!contract || contract.user_id !== userId) return json({ error: "Contrato não encontrado" }, 404);

  if (action === "list") {
    const { data: rows, error } = await sb
      .from("contract_signatures")
      .select("id, role, name, email, token, signed_at, signed_name, signed_cpf, signer_ip")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: true });
    if (error) return json({ error: error.message }, 500);
    return json({ signatures: rows ?? [] });
  }

  if (action === "create") {
    const signers = Array.isArray(body.signers) ? body.signers : [];
    if (signers.length < 1 || signers.length > 5) return json({ error: "1 a 5 signatários" }, 400);
    for (const s of signers) {
      if (!s || !ROLES.has(s.role)) return json({ error: "Papel inválido" }, 400);
      if (typeof s.name !== "string" || s.name.trim().length < 2) return json({ error: "Nome inválido" }, 400);
      if (typeof s.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) return json({ error: "E-mail inválido" }, 400);
    }

    await sb.from("contract_signatures").delete().eq("contract_id", contractId);

    const rows = signers.map((s: any) => ({
      contract_id: contractId,
      role: s.role,
      name: s.name,
      email: s.email,
    }));
    const { data: inserted, error: iErr } = await sb
      .from("contract_signatures")
      .insert(rows)
      .select("id, role, name, email, token");
    if (iErr) return json({ error: iErr.message }, 500);

    await sb
      .from("contracts")
      .update({ signature_mode: "eletronica", signature_status: "pendente" })
      .eq("id", contractId);

    return json({ signatures: inserted ?? [] });
  }

  return json({ error: "Ação inválida" }, 400);
});
