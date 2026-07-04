// Wrapper cliente que invoca a Edge Function `account` no Supabase.
import { supabase } from "@/integrations/supabase/client";

export async function deleteAccount(_args?: Record<string, unknown>): Promise<{ ok: true }> {
  const { data, error } = await supabase.functions.invoke("account", {
    body: { action: "delete_account" },
  });
  if (error) {
    let msg = error.message || "Falha ao excluir conta";
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
  return data as { ok: true };
}
