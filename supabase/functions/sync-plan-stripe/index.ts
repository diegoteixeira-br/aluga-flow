// Edge Function: sync-plan-stripe
// Cria/atualiza Produto e Price na Stripe automaticamente para um plano.
// Admin-only. Body: { planId: string }
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

async function stripeFetch(path: string, body: Record<string, string> | null, secret: string, method = "POST") {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (body) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) params.append(k, v);
    init.body = params.toString();
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, init);
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
  const STRIPE_SECRET = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE_SECRET) return json({ error: "STRIPE_SECRET_KEY não configurado" }, 500);

  const sb = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const admin = createClient(SUPABASE_URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  let payload: any = {};
  try { payload = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const planId = String(payload.planId || "");
  if (!planId) return json({ error: "planId obrigatório" }, 400);

  const { data: plan, error: planErr } = await admin.from("plans").select("*").eq("id", planId).maybeSingle();
  if (planErr || !plan) return json({ error: "Plano não encontrado" }, 404);

  // Plano gratuito: nada a sincronizar na Stripe
  const priceNumber = Number(plan.price ?? 0);
  if (!priceNumber || priceNumber <= 0) {
    await admin.from("plans").update({ stripe_price_id: null }).eq("id", planId);
    return json({ ok: true, skipped: "free plan" });
  }

  try {
    // 1. Garantir Product
    let productId: string | null = plan.stripe_product_id ?? null;
    if (productId) {
      try {
        await stripeFetch(`/products/${productId}`, { name: plan.name, active: "true" }, STRIPE_SECRET);
      } catch {
        productId = null; // produto não existe mais
      }
    }
    if (!productId) {
      const product = await stripeFetch("/products", {
        name: plan.name,
        "metadata[plan_id]": plan.id,
      }, STRIPE_SECRET);
      productId = product.id;
    }

    // 2. Verificar se Price atual ainda corresponde
    const cents = Math.round(priceNumber * 100);
    let priceId: string | null = plan.stripe_price_id ?? null;
    let needNewPrice = true;
    if (priceId) {
      try {
        const cur: any = await stripeFetch(`/prices/${priceId}`, null, STRIPE_SECRET, "GET");
        if (
          cur.active &&
          cur.unit_amount === cents &&
          cur.currency === "brl" &&
          cur.recurring?.interval === "month" &&
          cur.product === productId
        ) {
          needNewPrice = false;
        }
      } catch { /* preço sumiu, criar novo */ }
    }

    if (needNewPrice) {
      // Arquivar preço antigo (Stripe prices são imutáveis)
      if (priceId) {
        try { await stripeFetch(`/prices/${priceId}`, { active: "false" }, STRIPE_SECRET); } catch { /* noop */ }
      }
      const newPrice = await stripeFetch("/prices", {
        product: productId!,
        unit_amount: String(cents),
        currency: "brl",
        "recurring[interval]": "month",
        "metadata[plan_id]": plan.id,
      }, STRIPE_SECRET);
      priceId = newPrice.id;
    }

    await admin.from("plans").update({
      stripe_product_id: productId,
      stripe_price_id: priceId,
    }).eq("id", planId);

    return json({ ok: true, stripe_product_id: productId, stripe_price_id: priceId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
