// Shared: ativa um contrato (status → ativo), gera pagamentos e envia email de conclusão.
// Usado por activate-contract (fluxo manual) e d4sign-webhook (fluxo eletrônico).
// deno-lint-ignore-file no-explicit-any
import { sendEmail, brl, dateBR } from "./resend.ts";
import { LOGO_ATTACHMENT, LOGO_SRC } from "./email-templates.ts";

function buildMonthlyPayments(a: { contract_id: string; user_id: string; start_date: string; end_date: string; due_day: number; amount: number }) {
  const out: Array<{ contract_id: string; user_id: string; reference_month: string; due_date: string; amount: number; status: "pendente" }> = [];
  const start = new Date(a.start_date + "T00:00:00");
  const end = new Date(a.end_date + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return out;
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    const y = cur.getFullYear(), m = cur.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = Math.min(a.due_day, lastDay);
    const due = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const ref = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    out.push({ contract_id: a.contract_id, user_id: a.user_id, reference_month: ref, due_date: due, amount: a.amount, status: "pendente" });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

function emailHtml(args: { property: string; tenant: string; owner: string; start: string; end: string; rent: number; due_day: number; kind: string }) {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f6f8;margin:0;padding:24px;color:#1f2937">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
      <div style="text-align:center;margin-bottom:12px"><img src="${LOGO_SRC}" alt="AlugaFlow" style="max-width:140px"/></div>
      <h1 style="font-size:20px;color:#0f172a;margin:0 0 12px">Contrato ativado ✔</h1>
      <p style="line-height:1.6">O contrato de locação foi <b>concluído e ativado</b> após ${args.kind}.</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:12px 0;font-size:14px">
        <p style="margin:4px 0"><b>Imóvel:</b> ${args.property}</p>
        <p style="margin:4px 0"><b>Locador:</b> ${args.owner}</p>
        <p style="margin:4px 0"><b>Locatário:</b> ${args.tenant}</p>
        <p style="margin:4px 0"><b>Vigência:</b> ${dateBR(args.start)} a ${dateBR(args.end)}</p>
        <p style="margin:4px 0"><b>Aluguel:</b> ${brl(args.rent)} — vencimento dia ${args.due_day}</p>
      </div>
      <p style="line-height:1.6">A partir de agora as cobranças mensais estão liberadas no painel.</p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px;text-align:center">AlugaFlow — gestão de aluguéis</p>
    </div>
  </body></html>`;
}

/**
 * Ativa o contrato: seta status/ativo/signature_status, gera pagamentos (se não houver),
 * e envia email de conclusão para locador e inquilino.
 * @param admin - service-role Supabase client
 * @param contractId - id do contrato
 * @param kind - "eletronica" | "manual" (usado apenas no texto do email)
 * @param signedPdfPath - path opcional do PDF assinado no storage
 */
export async function activateContract(admin: any, contractId: string, kind: "eletronica" | "manual", signedPdfPath?: string | null): Promise<{ ok: boolean; paymentsCreated: number }> {
  const { data: contract, error: cErr } = await admin
    .from("contracts")
    .select(`id, user_id, status, start_date, end_date, rent_amount, due_day,
             property:properties(nickname), tenant:tenants(full_name, email)`)
    .eq("id", contractId)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!contract) throw new Error("Contrato não encontrado");
  if (contract.status === "ativo") return { ok: true, paymentsCreated: 0 };

  const update: Record<string, any> = {
    status: "ativo",
    signature_status: "assinado",
    signed_at: new Date().toISOString(),
    signature_mode: kind,
  };
  if (signedPdfPath) update.signed_pdf_path = signedPdfPath;
  const { error: uErr } = await admin.from("contracts").update(update).eq("id", contractId);
  if (uErr) throw new Error(uErr.message);

  const { count } = await admin.from("payments").select("id", { count: "exact", head: true }).eq("contract_id", contractId);
  let paymentsCreated = 0;
  if (!count || count === 0) {
    const payments = buildMonthlyPayments({
      contract_id: contract.id, user_id: contract.user_id,
      start_date: contract.start_date, end_date: contract.end_date,
      due_day: contract.due_day, amount: Number(contract.rent_amount),
    });
    if (payments.length > 0) {
      const { error: pErr } = await admin.from("payments").insert(payments);
      if (!pErr) paymentsCreated = payments.length;
    }
  }

  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", contract.user_id).maybeSingle();
  const { data: ownerUser } = await admin.auth.admin.getUserById(contract.user_id).catch(() => ({ data: null } as any));
  const ownerEmail = ownerUser?.user?.email as string | undefined;
  const property = contract.property;
  const tenant = contract.tenant;
  const html = emailHtml({
    property: property?.nickname ?? "—",
    tenant: tenant?.full_name ?? "—",
    owner: profile?.full_name ?? ownerEmail ?? "—",
    start: contract.start_date,
    end: contract.end_date,
    rent: Number(contract.rent_amount),
    due_day: contract.due_day,
    kind: kind === "eletronica" ? "as assinaturas eletrônicas via D4Sign" : "o envio do PDF assinado",
  });
  const recipients = [ownerEmail, tenant?.email].filter((x): x is string => !!x);
  if (recipients.length > 0) {
    const r = await sendEmail({
      to: recipients,
      subject: `Contrato ativado — ${property?.nickname ?? "AlugaFlow"}`,
      html,
      attachments: [LOGO_ATTACHMENT],
    });
    if (r.error) console.error("[activate-contract-shared] email fail:", r.error);
  }

  return { ok: true, paymentsCreated };
}
