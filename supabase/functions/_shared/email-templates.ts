// Templates HTML simples e responsivos. Mantidos em uma string só para evitar
// dependências externas no runtime do Deno.
import { brl, dateBR, type EmailAttachment } from "./resend.ts";
import { LOGO_PNG_BASE64 } from "./logo-base64.ts";

// Logo embutido via Content-ID (cid:) — funciona no Gmail/Outlook sem depender
// do domínio público estar publicado. Usamos um anexo inline com este content_id.
export const LOGO_CID = "alugaflow-logo";
export const LOGO_SRC = `cid:${LOGO_CID}`;
export const SITE_URL = Deno.env.get("EMAIL_SITE_URL") || "https://alugaflow.com.br";

/** Anexo inline do logo. Inclua em `attachments` em TODO envio que use o layout. */
export const LOGO_ATTACHMENT: EmailAttachment = {
  filename: "alugaflow-logo.png",
  content: LOGO_PNG_BASE64,
  content_id: LOGO_CID,
  content_type: "image/png",
};


const baseStyle = `
  body{margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1f2937}
  .wrap{max-width:560px;margin:0 auto;padding:24px}
  .header{text-align:center;padding:8px 0 20px}
  .header img{max-width:140px;height:auto;display:inline-block}
  .card{background:#fff;border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  h1{font-size:20px;margin:0 0 12px;color:#0f172a}
  p{line-height:1.6;margin:0 0 12px}
  .btn{display:inline-block;background:#0f5b6e;color:#fff !important;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;margin:12px 0}
  .muted{color:#6b7280;font-size:12px;margin-top:24px;text-align:center}
  .footer{text-align:center;color:#6b7280;font-size:12px;padding:16px 8px 0}
  .footer a{color:#0f5b6e;text-decoration:none}
  .box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:12px 0}
  .row{display:flex;justify-content:space-between;padding:4px 0}
  .late{background:#fef2f2;border-color:#fecaca}
`;

function layout(title: string, inner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${baseStyle}</style></head>
  <body><div class="wrap">
    <div class="header"><a href="${SITE_URL}"><img src="${LOGO_SRC}" alt="AlugaFlow" /></a></div>

    <div class="card">${inner}</div>
    <div class="footer">© ${new Date().getFullYear()} AlugaFlow • Gestão de imóveis<br/>
      <a href="${SITE_URL}">${SITE_URL.replace(/^https?:\/\//, "")}</a>
    </div>
  </div></body></html>`;
}

export function welcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: "Bem-vindo ao AlugaFlow 🎉",
    html: layout("Bem-vindo", `
      <h1>Olá, ${name || "proprietário"} 👋</h1>
      <p>Sua conta no <b>AlugaFlow</b> foi criada com sucesso!</p>
      <p>Agora você pode cadastrar imóveis, inquilinos, gerar contratos e automatizar cobranças via PIX e boleto.</p>
      <a class="btn" href="https://alugaflow.com.br/dashboard">Acessar painel</a>
      <p>Qualquer dúvida, basta responder este e-mail.</p>
    `),
  };
}

export function leadNotificationEmail(args: {
  ownerName: string; leadName: string; leadPhone: string; leadEmail: string;
  propertyTitle?: string; message?: string;
}): { subject: string; html: string } {
  return {
    subject: `Novo lead recebido: ${args.leadName}`,
    html: layout("Novo lead", `
      <h1>📩 Você tem um novo interessado!</h1>
      <p><b>${args.leadName}</b> demonstrou interesse${args.propertyTitle ? ` no imóvel <b>${args.propertyTitle}</b>` : ""}.</p>
      <div class="box">
        <div class="row"><span>WhatsApp/Telefone</span><b>${args.leadPhone || "—"}</b></div>
        <div class="row"><span>E-mail</span><b>${args.leadEmail || "—"}</b></div>
        ${args.message ? `<p style="margin-top:12px"><i>"${args.message}"</i></p>` : ""}
      </div>
      <a class="btn" href="https://alugaflow.com.br/dashboard">Ver no painel</a>
    `),
  };
}

export function paymentReminderEmail(args: {
  tenantName: string; amount: number; dueDate: string; invoiceUrl?: string;
}): { subject: string; html: string } {
  return {
    subject: `Lembrete: aluguel vence em ${dateBR(args.dueDate)}`,
    html: layout("Lembrete", `
      <h1>Olá, ${args.tenantName} 👋</h1>
      <p>Este é apenas um lembrete amigável: seu aluguel vence em <b>${dateBR(args.dueDate)}</b>.</p>
      <div class="box">
        <div class="row"><span>Valor</span><b>${brl(args.amount)}</b></div>
        <div class="row"><span>Vencimento</span><b>${dateBR(args.dueDate)}</b></div>
      </div>
      ${args.invoiceUrl ? `<a class="btn" href="${args.invoiceUrl}">Pagar agora (PIX/Boleto)</a>` : ""}
      <p>Se já efetuou o pagamento, por favor desconsidere este aviso.</p>
    `),
  };
}

export function paymentReceiptEmail(args: {
  tenantName: string; amount: number; referenceMonth?: string; paidAt?: string;
}): { subject: string; html: string } {
  return {
    subject: "Recibo de pagamento confirmado ✅",
    html: layout("Recibo", `
      <h1>Pagamento recebido!</h1>
      <p>Olá, ${args.tenantName}. Confirmamos o recebimento do seu pagamento. Obrigado!</p>
      <div class="box">
        <div class="row"><span>Valor</span><b>${brl(args.amount)}</b></div>
        ${args.referenceMonth ? `<div class="row"><span>Referência</span><b>${dateBR(args.referenceMonth)}</b></div>` : ""}
        ${args.paidAt ? `<div class="row"><span>Pago em</span><b>${dateBR(args.paidAt)}</b></div>` : ""}
      </div>
      <p>Este e-mail serve como recibo simplificado.</p>
    `),
  };
}

export function paymentOverdueEmail(args: {
  tenantName: string; amount: number; dueDate: string; invoiceUrl?: string; daysLate: number;
}): { subject: string; html: string } {
  return {
    subject: `Aviso: aluguel em atraso (${args.daysLate} ${args.daysLate === 1 ? "dia" : "dias"})`,
    html: layout("Atraso", `
      <h1>⚠️ Identificamos um pagamento em atraso</h1>
      <p>Olá, ${args.tenantName}. Seu aluguel com vencimento em <b>${dateBR(args.dueDate)}</b> ainda consta como não pago.</p>
      <div class="box late">
        <div class="row"><span>Valor</span><b>${brl(args.amount)}</b></div>
        <div class="row"><span>Vencimento</span><b>${dateBR(args.dueDate)}</b></div>
        <div class="row"><span>Dias em atraso</span><b>${args.daysLate}</b></div>
      </div>
      ${args.invoiceUrl ? `<a class="btn" href="${args.invoiceUrl}">Regularizar pagamento</a>` : ""}
      <p>Caso o pagamento já tenha sido realizado, por favor desconsidere.</p>
    `),
  };
}

/**
 * Substitui variáveis no formato {{nome}} pelos dados do destinatário.
 * Suporta: {{nome}}, {{primeiro_nome}}, {{email}}, {{plano}}.
 */
export function personalize(text: string, vars: { name?: string | null; email?: string | null; plan?: string | null }): string {
  const name = (vars.name || "").trim();
  const first = name.split(/\s+/)[0] || "";
  const map: Record<string, string> = {
    nome: name || "cliente",
    primeiro_nome: first || "olá",
    email: vars.email || "",
    plano: vars.plan || "",
  };
  return text.replace(/\{\{\s*(nome|primeiro_nome|email|plano)\s*\}\}/gi, (_, k) => map[k.toLowerCase()] ?? "");
}

export function broadcastEmail(
  subject: string,
  body: string,
  vars?: { name?: string | null; email?: string | null; plan?: string | null },
): string {
  const personalized = vars ? personalize(body, vars) : body;
  const safeBody = personalized.replace(/\n/g, "<br/>");
  // Só adiciona saudação automática quando o corpo NÃO começa com uma saudação
  // (evita duplicar "Olá, Diego" + "Olá, equipe" quando o autor já cumprimentou).
  const startsWithGreeting = /^\s*(olá|ola|oi|prezad|caro|bom dia|boa tarde|boa noite)/i.test(personalized);
  const greetName = vars?.name ? (vars.name.split(/\s+/)[0]) : "";
  const hello = !startsWithGreeting && greetName ? `<p style="margin-top:0">Olá, <b>${greetName}</b> 👋</p>` : "";
  return layout(subject, `<h1>${subject}</h1>${hello}<p>${safeBody}</p>`);
}

