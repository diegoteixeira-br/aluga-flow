// Edge Function: d4sign-webhook
// Recebe eventos da D4Sign. Quando type = 'finish' (documento finalizado),
// ativa o contrato: status → 'ativo', gera pagamentos e envia email.
// Público (verify_jwt = false). Autenticação: token opcional via query ?token=... (D4SIGN_WEBHOOK_TOKEN)
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { activateContract } from "../_shared/contract-activate.ts";
import { d4DownloadSigned } from "../_shared/d4sign.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const tokenExpected = Deno.env.get("D4SIGN_WEBHOOK_TOKEN");
  if (tokenExpected) {
    const url = new URL(req.url);
    const t = url.searchParams.get("token") ?? req.headers.get("x-d4sign-token");
    if (t !== tokenExpected) return new Response("Invalid token", { status: 401 });
  }

  const bodyText = await req.text();
  let payload: any = {};
  try { payload = bodyText ? JSON.parse(bodyText) : {}; } catch { /* pode vir form-encoded */
    payload = Object.fromEntries(new URLSearchParams(bodyText));
  }

  const documentUuid = payload.uuid ?? payload.uuidDoc ?? payload.uuid_document ?? payload.documentUuid;
  const type = String(payload.type_post ?? payload.type ?? payload.message_type ?? "").toLowerCase();
  if (!documentUuid) return new Response("no uuid", { status: 400 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: contract } = await admin.from("contracts")
    .select("id, user_id, status")
    .eq("d4sign_document_id", documentUuid)
    .maybeSingle();
  if (!contract) return new Response("contract not found", { status: 404 });

  // Atualiza status D4Sign (log leve)
  await admin.from("contracts").update({ d4sign_status: type || "evento" }).eq("id", contract.id);

  const isFinished = /finish|signed_by_all|finalizad|assinatura.*conclu/i.test(type)
    || Boolean(payload.finished) || Boolean(payload.signed);

  if (!isFinished) return new Response("ok");
  if (contract.status === "ativo") return new Response("ok");

  // Baixa PDF assinado (opcional) e sobrescreve o path original
  let signedPath: string | null = null;
  try {
    const dl = await d4DownloadSigned(documentUuid);
    if (dl) {
      const bin = Uint8Array.from(atob(dl.base64), (c) => c.charCodeAt(0));
      const path = `${contract.user_id}/${contract.id}/signed.pdf`;
      const { error } = await admin.storage.from("signed-contracts").upload(path, bin, {
        contentType: "application/pdf", upsert: true,
      });
      if (!error) signedPath = path;
    }
  } catch (e) {
    console.error("[d4sign-webhook] download signed pdf fail:", (e as Error).message);
  }

  try {
    await activateContract(admin, contract.id, "eletronica", signedPath);
  } catch (e) {
    console.error("[d4sign-webhook] activate fail:", (e as Error).message);
    return new Response("activate error", { status: 500 });
  }
  return new Response("ok");
});
