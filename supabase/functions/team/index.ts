// Edge Function: team
// Gestão de sub-usuários (membros) por dono da conta.
// Ações: list | create | update | delete
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const sb = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  // Caller must be an owner (not a member)
  const { data: callerProfile, error: cpErr } = await admin
    .from("profiles")
    .select("id, role, parent_id, plan")
    .eq("id", userId)
    .maybeSingle();
  if (cpErr) return json({ error: cpErr.message }, 500);
  if (!callerProfile || callerProfile.role === "member" || callerProfile.parent_id) {
    return json({ error: "Forbidden: only account owner can manage team" }, 403);
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const action = String(payload.action || "");

  try {
    if (action === "list") {
      const { data, error } = await admin
        .from("profiles")
        .select("id, full_name, email, role, created_at")
        .eq("parent_id", userId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ members: data ?? [] });
    }

    if (action === "create") {
      const { full_name, email, password } = payload;
      if (!full_name || !email || !password || String(password).length < 6) {
        return json({ error: "Nome, e-mail e senha (mín. 6) são obrigatórios" }, 400);
      }
      // Check plan limit
      const { data: limit, error: limErr } = await admin.rpc("check_plan_limit", {
        _user_id: userId, _resource: "users",
      });
      if (limErr) throw limErr;
      const l = limit as { allowed: boolean; current: number; max: number | null };
      if (!l.allowed) return json({ error: "Limite do plano atingido" }, 403);

      // Create auth user
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: String(email).trim().toLowerCase(),
        password: String(password),
        email_confirm: true,
        user_metadata: { full_name, parent_id: userId },
      });
      if (createErr) return json({ error: createErr.message }, 400);
      const newId = created.user!.id;

      // Upsert profile with parent_id + role=member + inherit owner's plan
      const { error: upErr } = await admin.from("profiles").upsert({
        id: newId,
        full_name,
        email: String(email).trim().toLowerCase(),
        parent_id: userId,
        role: "member",
        plan: callerProfile.plan ?? "free",
      });
      if (upErr) {
        // rollback
        await admin.auth.admin.deleteUser(newId);
        return json({ error: upErr.message }, 500);
      }
      return json({ ok: true, id: newId });
    }

    if (action === "update") {
      const { id, full_name, password } = payload;
      if (!id) return json({ error: "id obrigatório" }, 400);
      // ensure member belongs to caller
      const { data: m } = await admin.from("profiles").select("id, parent_id").eq("id", id).maybeSingle();
      if (!m || m.parent_id !== userId) return json({ error: "Forbidden" }, 403);

      if (full_name) {
        const { error } = await admin.from("profiles").update({ full_name }).eq("id", id);
        if (error) throw error;
      }
      if (password) {
        if (String(password).length < 6) return json({ error: "Senha mínimo 6 caracteres" }, 400);
        const { error } = await admin.auth.admin.updateUserById(id, { password: String(password) });
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === "delete") {
      const { id } = payload;
      if (!id) return json({ error: "id obrigatório" }, 400);
      const { data: m } = await admin.from("profiles").select("id, parent_id").eq("id", id).maybeSingle();
      if (!m || m.parent_id !== userId) return json({ error: "Forbidden" }, 403);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e: any) {
    console.error("[team]", action, e?.message ?? e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
