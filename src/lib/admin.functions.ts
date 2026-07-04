// Wrappers cliente que invocam a Edge Function `admin` no Supabase.
// Mantém assinaturas compatíveis (fn() ou fn({ data: ... })) com chamadas anteriores via useServerFn.
import { supabase } from "@/integrations/supabase/client";

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin", { body });
  if (error) {
    let msg = error.message || "Falha ao chamar admin";
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

type PlanId = "free" | "investidor" | "imobiliaria";

export type AdminMetrics = {
  total_users?: number; new_users_30d?: number; total_properties?: number;
  total_leads?: number; estimated_monthly_revenue?: number;
  plan_counts?: Record<string, number>;
};

export async function getAdminMetrics(_args?: Record<string, unknown>) {
  return invoke<AdminMetrics>({ action: "metrics" });
}

export async function adminListUsers(_args?: Record<string, unknown>) {
  return invoke<Array<Record<string, unknown>>>({ action: "list_users" });
}

export async function adminSetUserPlan(args: { data: { userId: string; plan: PlanId } }) {
  return invoke<{ ok: true }>({ action: "set_plan", userId: args.data.userId, plan: args.data.plan });
}

export async function adminToggleActive(args: { data: { userId: string; active: boolean } }) {
  return invoke<{ ok: true }>({ action: "toggle_active", userId: args.data.userId, active: args.data.active });
}

export async function adminToggleAdmin(args: { data: { userId: string; makeAdmin: boolean } }) {
  return invoke<{ ok: true }>({ action: "toggle_admin", userId: args.data.userId, makeAdmin: args.data.makeAdmin });
}
export async function adminSetUserEmail(args: { data: { userId: string; email: string } }) {
  return invoke<{ ok: true }>({ action: "set_email", userId: args.data.userId, email: args.data.email });
}

export async function adminSendBroadcast(args: {
  data: { subject: string; body: string; targetPlan: "all" | PlanId | "user"; userId?: string };
}) {
  return invoke<{ ok: true; recipients: number }>({
    action: "send_broadcast",
    subject: args.data.subject,
    body: args.data.body,
    targetPlan: args.data.targetPlan,
    userId: args.data.userId,
  });
}

export async function adminAiCompose(args: {
  data: {
    mode: "subject" | "body" | "improve";
    prompt?: string;
    currentSubject?: string;
    currentBody?: string;
    tone?: string;
  };
}) {
  return invoke<{ ok: true; text: string }>({ action: "ai_compose", ...args.data });
}

export async function adminLegalAiEdit(args: {
  data: { slug: "termos" | "privacidade"; currentContent: string; instruction: string };
}) {
  return invoke<{ ok: true; content: string }>({ action: "legal_ai_edit", ...args.data });
}

