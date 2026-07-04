// Edge Function: subscriptions
// Substitui src/lib/subscriptions.functions.ts (createServerFn).
// Ações: get | checkout | downgrade | cancel
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLANS = ["free", "investidor", "imobiliaria"] as const;
type PlanId = (typeof PLANS)[number];
const RANK: Record<PlanId, number> = { free: 0, investidor: 1, imobiliaria: 2 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function stripeFetch(path: string, body: Record<string, string>, secret: string) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) params.append(k, v);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message || `Stripe error ${res.status}`);
  return j;
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
  const email = userData.user.email ?? "";

  let payload: any = {};
  try { payload = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const action = String(payload.action || "");

  try {
    if (action === "get") {
      const [{ data: profile }, { data: sub }, { data: properties }, { data: plans }] = await Promise.all([
        sb.from("profiles").select("plan, full_name").eq("id", userId).maybeSingle(),
        sb.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        sb.from("properties").select("id, listed_public").eq("user_id", userId),
        sb.from("plans").select("*").order("sort_order"),
      ]);
      const plan = (profile?.plan ?? "free") as PlanId;
      const propCount = properties?.length ?? 0;
      const listedCount = (properties ?? []).filter((p: any) => p.listed_public).length;
      return json({
        plan,
        profile,
        subscription: sub,
        usage: { properties: propCount, listings: listedCount },
        plans: plans ?? [],
      });
    }

    if (action === "checkout") {
      const planId = String(payload.planId || "") as PlanId;
      const origin = String(payload.origin || "");
      if (!PLANS.includes(planId)) return json({ error: "planId inválido" }, 400);
      if (!origin) return json({ error: "origin obrigatório" }, 400);
      const secret = Deno.env.get("STRIPE_SECRET_KEY");
      if (!secret) return json({ error: "Stripe não configurado (STRIPE_SECRET_KEY)" }, 500);

      const { data: plan } = await sb.from("plans").select("*").eq("id", planId).maybeSingle();
      if (!plan?.stripe_price_id) return json({ error: `Plano ${planId} sem stripe_price_id. Configure no painel admin.` }, 400);

      const { data: existing } = await sb.from("subscriptions").select("stripe_customer_id").eq("user_id", userId).not("stripe_customer_id", "is", null).limit(1).maybeSingle();

      const body: Record<string, string> = {
        mode: "subscription",
        "line_items[0][price]": plan.stripe_price_id,
        "line_items[0][quantity]": "1",
        success_url: `${origin}/minha-conta/plano?upgrade=success`,
        cancel_url: `${origin}/minha-conta/plano?upgrade=cancel`,
        "metadata[user_id]": userId,
        "metadata[plan_type]": planId,
        "subscription_data[metadata][user_id]": userId,
        "subscription_data[metadata][plan_type]": planId,
        allow_promotion_codes: "true",
      };
      if (existing?.stripe_customer_id) body.customer = existing.stripe_customer_id;
      else if (email) body.customer_email = email;

      const session = await stripeFetch("/checkout/sessions", body, secret);
      return json({ url: session.url, id: session.id });
    }

    if (action === "downgrade") {
      const newPlan = String(payload.newPlan || "") as PlanId;
      if (!PLANS.includes(newPlan)) return json({ error: "newPlan inválido" }, 400);

      const { data: profile } = await sb.from("profiles").select("plan").eq("id", userId).maybeSingle();
      const current = (profile?.plan ?? "free") as PlanId;
      if (RANK[newPlan] >= RANK[current]) return json({ error: "Downgrade inválido." }, 400);

      const { data: sub } = await sb.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();

      if (sub?.stripe_subscription_id) {
        const secret = Deno.env.get("STRIPE_SECRET_KEY");
        if (!secret) return json({ error: "Stripe não configurado." }, 500);
        await stripeFetch(`/subscriptions/${sub.stripe_subscription_id}`, { cancel_at_period_end: "true" }, secret);
      }

      if (sub) {
        await admin.from("subscriptions").update({
          cancel_at_period_end: true,
          scheduled_plan: newPlan,
          status: "scheduled_downgrade",
        }).eq("id", sub.id);
      } else {
        await admin.from("profiles").update({ plan: newPlan }).eq("id", userId);
      }
      return json({ ok: true });
    }

    if (action === "cancel") {
      const reason = String(payload.reason || "").slice(0, 500);
      if (!reason) return json({ error: "reason obrigatório" }, 400);

      const { data: profile } = await sb.from("profiles").select("plan, full_name").eq("id", userId).maybeSingle();
      const plan = (profile?.plan ?? "free") as PlanId;
      const { data: sub } = await sb.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();

      let effectiveDate = new Date().toISOString();
      if (sub?.stripe_subscription_id) {
        const secret = Deno.env.get("STRIPE_SECRET_KEY");
        if (!secret) return json({ error: "Stripe não configurado." }, 500);
        const updated: any = await stripeFetch(`/subscriptions/${sub.stripe_subscription_id}`, { cancel_at_period_end: "true" }, secret);
        if (updated?.current_period_end) effectiveDate = new Date(updated.current_period_end * 1000).toISOString();
      } else if (sub?.current_period_end) {
        effectiveDate = sub.current_period_end;
      }

      if (sub) {
        await admin.from("subscriptions").update({
          cancel_at_period_end: true,
          scheduled_plan: "free",
          status: "scheduled_downgrade",
        }).eq("id", sub.id);
      } else {
        await admin.from("profiles").update({ plan: "free" }).eq("id", userId);
      }

      await admin.from("cancellations").insert({
        user_id: userId,
        plan_type: plan,
        reason,
        effective_date: effectiveDate,
      });

      return json({ ok: true, effectiveDate });
    }

    return json({ error: "action inválida (use get|checkout|downgrade|cancel)" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
