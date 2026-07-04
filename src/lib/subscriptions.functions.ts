// Wrappers cliente que invocam a Edge Function `subscriptions` no Supabase.
// Mantém assinaturas compatíveis com os componentes existentes
// (fn({ data: { ... } })) para minimizar mudanças.
import { supabase } from "@/integrations/supabase/client";

type PlanId = "free" | "investidor" | "imobiliaria";

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("subscriptions", { body });
  if (error) {
    let msg = error.message || "Falha ao chamar subscriptions";
    try {
      const ctx = (error as unknown as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      if (ctx && typeof ctx.json === "function") {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch { /* noop */ }
    throw new Error(msg);
  }
  if (data && typeof data === "object" && "error" in data && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

export type MySubscription = {
  plan: PlanId;
  profile: { plan?: string; full_name?: string } | null;
  subscription: {
    id: string;
    user_id: string;
    plan_type: PlanId;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    scheduled_plan: string | null;
    created_at: string;
  } | null;
  usage: { properties: number; listings: number };
  plans: Array<{
    id: string;
    name: string;
    price: number;
    promo_price: number | null;
    promo_until: string | null;
    benefits: unknown;
    max_properties: number | null;
    max_listings: number | null;
    stripe_price_id: string | null;
    sort_order: number;
  }>;
};

// Aceita `()` ou `({})` para compatibilidade com chamadas anteriores via useServerFn.
export async function getMySubscription(_args?: Record<string, unknown>) {
  return invoke<MySubscription>({ action: "get" });
}

export async function createCheckoutSession(args: { data: { planId: PlanId; origin: string } }) {
  return invoke<{ url: string; id: string }>({
    action: "checkout",
    planId: args.data.planId,
    origin: args.data.origin,
  });
}

export async function scheduleDowngrade(args: { data: { newPlan: PlanId } }) {
  return invoke<{ ok: true }>({ action: "downgrade", newPlan: args.data.newPlan });
}

export async function cancelSubscription(args: { data: { reason: string } }) {
  return invoke<{ ok: true; effectiveDate: string }>({ action: "cancel", reason: args.data.reason });
}
