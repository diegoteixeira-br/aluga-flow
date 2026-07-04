// Wrappers cliente que invocam a Edge Function `asaas-charges` no Supabase.
// Mantém a mesma assinatura de chamada usada antes ({ data: { ... } })
// para minimizar mudanças nos componentes.
import { supabase } from "@/integrations/supabase/client";

async function invokeAsaas<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("asaas-charges", { body });
  if (error) {
    // Tenta extrair a mensagem JSON retornada pela function
    let msg = error.message || "Falha ao chamar ASAAS";
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

export async function createAsaasChargeForPayment(args: { data: { paymentId: string } }) {
  return invokeAsaas<{ paymentId: string; invoiceUrl: string; reused: boolean }>({
    action: "payment",
    paymentId: args.data.paymentId,
  });
}

export async function createAsaasChargesForContract(args: { data: { contractId: string } }) {
  return invokeAsaas<{ created: number; failed: number; errors: string[] }>({
    action: "contract",
    contractId: args.data.contractId,
  });
}
