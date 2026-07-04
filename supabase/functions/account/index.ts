// Edge Function: account
// Substitui src/lib/account.functions.ts (createServerFn).
// Ação: delete_account — apaga arquivos do usuário em buckets e chama RPC delete_my_account.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKETS = [
  "property-photos",
  "tenant-documents",
  "signed-contracts",
  "branding",
  "blog-covers",
  "lead-documents",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function deleteUserFolder(client: any, bucket: string, prefix: string) {
  const toDelete: string[] = [];
  const stack: string[] = [prefix];
  while (stack.length) {
    const dir = stack.pop()!;
    const { data, error } = await client.storage.from(bucket).list(dir, { limit: 1000 });
    if (error || !data) continue;
    for (const item of data) {
      const path = `${dir}/${item.name}`;
      if (item.id === null || !item.metadata) stack.push(path);
      else toDelete.push(path);
    }
  }
  for (let i = 0; i < toDelete.length; i += 100) {
    await client.storage.from(bucket).remove(toDelete.slice(i, i + 100));
  }
}

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

  let payload: any = {};
  try { payload = await req.json(); } catch { /* aceita corpo vazio */ }
  const action = String(payload.action || "delete_account");

  if (action !== "delete_account") return json({ error: `Unknown action: ${action}` }, 400);

  try {
    for (const bucket of BUCKETS) {
      try { await deleteUserFolder(sb, bucket, userId); } catch (_e) { /* best-effort */ }
    }
    const { error } = await sb.rpc("delete_my_account");
    if (error) throw new Error(error.message);
    return json({ ok: true });
  } catch (e: any) {
    console.error("[account] delete_account", e?.message ?? e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
