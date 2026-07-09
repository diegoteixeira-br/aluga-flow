// D4Sign API helpers.
// Documentação: https://docapi.d4sign.com.br/docs
// Auth via query string: tokenAPI + cryptKey
// deno-lint-ignore-file no-explicit-any

const BASE = Deno.env.get("D4SIGN_BASE_URL") || "https://secure.d4sign.com.br/api/v1";

function requireEnv() {
  const token = Deno.env.get("D4SIGN_API_TOKEN");
  const crypt = Deno.env.get("D4SIGN_CRYPT_KEY");
  const safe = Deno.env.get("D4SIGN_SAFE_ID");
  if (!token || !crypt || !safe) {
    throw new Error("D4Sign não configurada: defina D4SIGN_API_TOKEN, D4SIGN_CRYPT_KEY e D4SIGN_SAFE_ID.");
  }
  return { token, crypt, safe };
}

function urlWithAuth(path: string): string {
  const { token, crypt } = requireEnv();
  const sep = path.includes("?") ? "&" : "?";
  return `${BASE}${path}${sep}tokenAPI=${encodeURIComponent(token)}&cryptKey=${encodeURIComponent(crypt)}`;
}

async function d4Fetch(path: string, init: RequestInit): Promise<any> {
  const res = await fetch(urlWithAuth(path), init);
  const txt = await res.text();
  let json: any = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { /* keep null */ }
  if (!res.ok) {
    const msg = json?.message || json?.error || txt || `D4Sign HTTP ${res.status}`;
    throw new Error(`D4Sign: ${msg}`);
  }
  return json;
}

/** Upload de PDF ao Cofre. Retorna { uuid } do documento criado. */
export async function d4UploadPdf(fileName: string, pdfBytes: Uint8Array): Promise<{ uuid: string }> {
  const { safe } = requireEnv();
  const form = new FormData();
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), fileName);
  const j = await d4Fetch(`/documents/${safe}/upload`, { method: "POST", body: form });
  const uuid = j?.uuid || j?.[0]?.uuid;
  if (!uuid) throw new Error("D4Sign: upload sem uuid retornado");
  return { uuid };
}

export type D4Signer = { email: string; act?: string; foreign?: "0" | "1"; certificadoicpbr?: "0" | "1"; assinatura_presencial?: "0" | "1" };

/** Cria a lista de signatários para o documento. */
export async function d4CreateSignerList(documentUuid: string, signers: D4Signer[]): Promise<void> {
  await d4Fetch(`/documents/${documentUuid}/createlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signers: signers.map((s) => ({
        email: s.email,
        act: s.act ?? "1",
        foreign: s.foreign ?? "0",
        certificadoicpbr: s.certificadoicpbr ?? "0",
        assinatura_presencial: s.assinatura_presencial ?? "0",
      })),
    }),
  });
}

/** Envia o documento para assinatura (dispara emails aos signatários). */
export async function d4SendToSign(documentUuid: string, opts?: { message?: string; workflow?: "0" | "1"; skip_email?: "0" | "1" }): Promise<void> {
  await d4Fetch(`/documents/${documentUuid}/sendtosigner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: opts?.message ?? "Segue o contrato para sua assinatura eletrônica.",
      workflow: opts?.workflow ?? "0",
      skip_email: opts?.skip_email ?? "0",
    }),
  });
}

/** Baixa o PDF assinado (base64). */
export async function d4DownloadSigned(documentUuid: string): Promise<{ base64: string; name: string } | null> {
  const j = await d4Fetch(`/documents/${documentUuid}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "PDF", language: "pt-BR" }),
  });
  if (!j?.url) return null;
  const r = await fetch(j.url);
  if (!r.ok) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return { base64: btoa(bin), name: j.name ?? "contrato-assinado.pdf" };
}
