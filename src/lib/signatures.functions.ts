// Wrappers cliente que invocam a Edge Function `contract-signatures` no Supabase.
// Mantém a assinatura ({ data: { ... } }) usada nos componentes para minimizar mudanças.
import { supabase } from "@/integrations/supabase/client";

type SignerInput = { role: "locador" | "locatario" | "fiador"; name: string; email: string };
type SignatureRow = { id: string; role: string; name: string; email: string; token: string };
type SignatureFull = SignatureRow & {
  signed_at: string | null;
  signed_name: string | null;
  signed_cpf: string | null;
  signer_ip: string | null;
};

async function invokeSignatures<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("contract-signatures", { body });
  if (error) {
    let msg = error.message || "Falha ao chamar contract-signatures";
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

export async function createSignatureInvites(args: { data: { contractId: string; signers: SignerInput[] } }) {
  return invokeSignatures<{ signatures: SignatureRow[] }>({
    action: "create",
    contractId: args.data.contractId,
    signers: args.data.signers,
  });
}

export async function listContractSignatures(args: { data: { contractId: string } }) {
  return invokeSignatures<{ signatures: SignatureFull[] }>({
    action: "list",
    contractId: args.data.contractId,
  });
}
