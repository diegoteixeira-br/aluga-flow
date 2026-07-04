import jsPDF from "jspdf";
import { formatBRL, formatDate } from "@/lib/format";
import { valorPorExtenso } from "@/lib/extenso";
import type { OwnerProfile, ContractPDFData } from "@/lib/contract-pdf";

/**
 * Biblioteca de modelos de contrato. Cada gerador retorna um jsPDF
 * já preenchido com os dados reais (substitui as variáveis [xxx]).
 */

function dataPorExtenso(d: Date = new Date()): string {
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function qualificacaoOwner(o: OwnerProfile): string {
  const addr = [o.address_street, o.address_number, o.address_neighborhood, o.address_city, o.address_uf].filter(Boolean).join(", ");
  return `${o.full_name ?? "—"}, brasileiro(a), portador(a) do RG nº ${o.rg ?? "—"} e CPF nº ${o.cpf ?? "—"}, residente e domiciliado(a) em ${addr || "—"}${o.address_zip ? `, CEP ${o.address_zip}` : ""}`;
}

function qualificacaoTenant(t: ContractPDFData["tenant"]): string {
  if (!t) return "—";
  const addr = [t.address_street, t.address_number, t.address_neighborhood, t.address_city, t.address_state].filter(Boolean).join(", ");
  return `${t.full_name ?? "—"}, portador(a) do RG nº ${t.rg ?? "—"} e CPF nº ${t.cpf ?? "—"}, residente em ${addr || "—"}`;
}

function qualificacaoFiador(g: ContractPDFData["guarantor"]): string {
  if (!g?.name) return "—";
  return `${g.name}, portador(a) do RG nº ${g.rg ?? "—"} e CPF nº ${g.cpf ?? "—"}, residente em ${g.address ?? "—"}`;
}

const ADJ: Record<string, string> = { nenhum: "Nenhum", igpm: "IGP-M", ipca: "IPCA" };

// ---------- Util de renderização ----------
type Doc = { doc: jsPDF; y: number; W: number; H: number; M: number };

function newDoc(): Doc {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  return { doc, y: 48, W: doc.internal.pageSize.getWidth(), H: doc.internal.pageSize.getHeight(), M: 48 };
}
function ensure(d: Doc, need: number) { if (d.y + need > d.H - d.M) { d.doc.addPage(); d.y = d.M; } }
function header(d: Doc, title: string) {
  d.doc.setFont("helvetica","bold"); d.doc.setFontSize(18); d.doc.setTextColor(26,74,107);
  d.doc.text("AlugaFlow", d.M, d.y);
  d.doc.setFont("helvetica","normal"); d.doc.setFontSize(10); d.doc.setTextColor(120);
  d.doc.text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, d.W - d.M, d.y, { align: "right" });
  d.y += 10; d.doc.setDrawColor(26,74,107); d.doc.line(d.M, d.y, d.W - d.M, d.y); d.y += 24;
  d.doc.setTextColor(20); d.doc.setFont("helvetica","bold"); d.doc.setFontSize(13);
  d.doc.text(title, d.W/2, d.y, { align: "center" }); d.y += 24;
  d.doc.setFont("helvetica","normal"); d.doc.setFontSize(10);
}
function section(d: Doc, title: string) {
  ensure(d, 28);
  d.doc.setFont("helvetica","bold"); d.doc.setFontSize(10.5); d.doc.setTextColor(26,74,107);
  d.doc.text(title, d.M, d.y); d.y += 14;
  d.doc.setFont("helvetica","normal"); d.doc.setFontSize(10); d.doc.setTextColor(20);
}
function p(d: Doc, text: string) {
  const wrapped = d.doc.splitTextToSize(text, d.W - 2*d.M);
  for (const w of wrapped) { ensure(d, 14); d.doc.text(w, d.M, d.y); d.y += 13; }
}
function assinaturas(d: Doc, signers: Array<{ role: string; name: string; cpf?: string | null }>, city?: string | null) {
  ensure(d, 120); d.y += 20;
  d.doc.text(`${city || "________________"}, ${new Date().toLocaleDateString("pt-BR")}.`, d.M, d.y); d.y += 36;
  for (const s of signers) {
    ensure(d, 70);
    d.doc.setDrawColor(20); d.doc.line(d.M, d.y, d.W - d.M, d.y); d.y += 14;
    d.doc.text(s.role, d.M, d.y);
    d.doc.text(s.name, d.W/2, d.y, { align: "center" });
    d.doc.text(`CPF: ${s.cpf ?? "—"}`, d.W - d.M, d.y, { align: "right" });
    d.y += 32;
  }
}

// ===================================================================
// MODELO 1 — Contrato de Locação Residencial (template variável)
// ===================================================================
export function gerarContratoResidencial(c: ContractPDFData, owner: OwnerProfile): jsPDF {
  const d = newDoc();
  header(d, "CONTRATO DE LOCAÇÃO RESIDENCIAL");
  d.doc.setFontSize(9); d.doc.setTextColor(120);
  d.doc.text("Regido pela Lei nº 8.245/91 (Lei do Inquilinato)", d.W/2, d.y, { align: "center" });
  d.y += 18; d.doc.setTextColor(20); d.doc.setFontSize(10);

  const meses = monthsBetween(c.start_date, c.end_date);
  const valorExt = valorPorExtenso(c.rent_amount);
  const cidade = c.property?.city ?? owner.address_city ?? "—";
  const estado = c.property?.state ?? owner.address_uf ?? "—";

  section(d, "DAS PARTES");
  p(d, `LOCADOR: ${qualificacaoOwner(owner)}.`);
  p(d, `LOCATÁRIO: ${qualificacaoTenant(c.tenant)}.`);
  if (c.guarantor?.name) p(d, `FIADOR: ${qualificacaoFiador(c.guarantor)}.`);
  d.y += 6;

  const objeto = `${c.property?.address ?? "—"}${c.property?.city ? `, ${c.property.city}/${c.property.state ?? ""}` : ""}`;

  const clauses = [
    ["CLÁUSULA 1ª — DO OBJETO", `O LOCADOR cede em locação ao LOCATÁRIO o imóvel situado em ${objeto}, destinado exclusivamente a fins residenciais.`],
    ["CLÁUSULA 2ª — DO PRAZO", `A locação vigorará pelo prazo de ${meses} meses, com início em ${formatDate(c.start_date)} e término em ${formatDate(c.end_date)}.`],
    ["CLÁUSULA 3ª — DO ALUGUEL", `O aluguel mensal é de ${formatBRL(c.rent_amount)} (${valorExt}), a ser pago até o dia ${c.due_day} de cada mês.`],
    ["CLÁUSULA 4ª — DO REAJUSTE", c.adjustment_index === "nenhum" ? "Não haverá reajuste do aluguel durante a vigência deste contrato." : `O aluguel será reajustado anualmente pela variação acumulada do índice ${ADJ[c.adjustment_index] ?? c.adjustment_index}.`],
    ["CLÁUSULA 5ª — DA FORMA DE PAGAMENTO", `O pagamento será efetuado mediante depósito ou PIX em favor do LOCADOR${owner.pix_key ? ` (chave PIX: ${owner.pix_key})` : ""}.`],
    ["CLÁUSULA 6ª — DA MORA", "O atraso no pagamento implicará multa de 2%, juros de 1% ao mês e correção monetária."],
    ["CLÁUSULA 7ª — DAS TAXAS E ENCARGOS", `Correm por conta do LOCATÁRIO as despesas com água, energia, gás, IPTU, condomínio e demais consumos.`],
    ["CLÁUSULA 8ª — DA CONSERVAÇÃO", "O LOCATÁRIO obriga-se a manter o imóvel em perfeito estado de conservação e devolvê-lo nas mesmas condições em que recebeu."],
    ["CLÁUSULA 9ª — DAS BENFEITORIAS", "Quaisquer benfeitorias só poderão ser realizadas com prévia e expressa autorização do LOCADOR, e não serão indenizáveis."],
    ["CLÁUSULA 10ª — DAS PROIBIÇÕES", "É vedada a sublocação, cessão ou empréstimo do imóvel sem autorização escrita do LOCADOR."],
    ["CLÁUSULA 11ª — DA DESTINAÇÃO", "O imóvel destina-se exclusivamente a fins residenciais, sendo proibida qualquer atividade comercial."],
    ["CLÁUSULA 12ª — DA VISTORIA", "O imóvel é entregue conforme termo de vistoria que integra este contrato como anexo."],
    ["CLÁUSULA 13ª — DAS REPARAÇÕES", "Reparos decorrentes do uso normal ficam a cargo do LOCATÁRIO; reparos estruturais a cargo do LOCADOR."],
    ["CLÁUSULA 14ª — DA RESCISÃO", "O presente contrato poderá ser rescindido por mútuo acordo ou por descumprimento de qualquer de suas cláusulas."],
    ["CLÁUSULA 15ª — DA MULTA POR RESCISÃO ANTECIPADA", `Em caso de rescisão antecipada pelo LOCATÁRIO, será devida multa equivalente a 3 aluguéis, proporcional ao período cumprido (art. 4º da Lei 8.245/91). Valor de referência: ${formatBRL(c.rent_amount * 3)}.`],
    ["CLÁUSULA 16ª — DA GARANTIA", garantiaTexto(c)],
    ["CLÁUSULA 17ª — DA DEVOLUÇÃO", "Ao término da locação, o imóvel deverá ser entregue livre de pessoas e coisas, com todos os encargos quitados."],
    ["CLÁUSULA 18ª — DA NOTIFICAÇÃO", "As notificações entre as partes poderão ser feitas por e-mail, WhatsApp ou carta com aviso de recebimento."],
    ["CLÁUSULA 19ª — DA SUCESSÃO", "Este contrato obriga as partes, herdeiros e sucessores."],
    ["CLÁUSULA 20ª — DO FORO", `Fica eleito o foro da comarca de ${cidade}/${estado} para dirimir quaisquer dúvidas oriundas deste contrato.`],
  ] as const;

  for (const [title, body] of clauses) { section(d, title); p(d, body); d.y += 4; }

  ensure(d, 30);
  d.doc.setFont("helvetica","italic"); d.doc.setFontSize(9); d.doc.setTextColor(100);
  d.doc.text(`Documento gerado em ${dataPorExtenso()}.`, d.M, d.y); d.y += 16;
  d.doc.setFont("helvetica","normal"); d.doc.setFontSize(10); d.doc.setTextColor(20);

  const signers = [
    { role: "LOCADOR", name: owner.full_name ?? "—", cpf: owner.cpf },
    { role: "LOCATÁRIO", name: c.tenant?.full_name ?? "—", cpf: c.tenant?.cpf },
  ];
  if (c.guarantor?.name) signers.push({ role: "FIADOR", name: c.guarantor.name, cpf: c.guarantor.cpf });
  assinaturas(d, signers, `${cidade}/${estado}`);
  return d.doc;
}

function garantiaTexto(c: ContractPDFData): string {
  if (c.guarantee_type === "caucao") {
    const m = c.guarantee_months ?? 1;
    return `Caução em dinheiro equivalente a ${m} mês(es) de aluguel, totalizando ${formatBRL(m * c.rent_amount)}.`;
  }
  if (c.guarantee_type === "fiador") return `Fiança prestada por ${c.guarantor?.name ?? "—"} (CPF ${c.guarantor?.cpf ?? "—"}), solidariamente responsável pelas obrigações deste contrato.`;
  if (c.guarantee_type === "seguro_fianca") return "Seguro fiança locatícia contratado pelo LOCATÁRIO.";
  return "Sem garantia.";
}

function monthsBetween(s: string, e: string): number {
  const a = new Date(s + "T00:00:00"), b = new Date(e + "T00:00:00");
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1);
}

// ===================================================================
// MODELO 2 — Distrato de Locação
// ===================================================================
export type DistratoData = {
  end_date: string;              // data de encerramento
  meses_restantes: number;       // meses restantes do contrato
  aplicar_multa: boolean;
  devolver_caucao: boolean;
  caucao_valor: number;
  observacoes?: string;
};

export function gerarDistrato(c: ContractPDFData, owner: OwnerProfile, dist: DistratoData): jsPDF {
  const d = newDoc();
  header(d, "DISTRATO DE LOCAÇÃO");

  const meses = monthsBetween(c.start_date, c.end_date);
  const multa = dist.aplicar_multa && dist.meses_restantes > 0 && meses > 0
    ? (c.rent_amount / meses) * dist.meses_restantes
    : 0;

  section(d, "DAS PARTES");
  p(d, `LOCADOR: ${qualificacaoOwner(owner)}.`);
  p(d, `LOCATÁRIO: ${qualificacaoTenant(c.tenant)}.`);
  d.y += 6;

  section(d, "DO OBJETO");
  p(d, `As partes, de comum acordo, resolvem RESCINDIR o contrato de locação celebrado em ${formatDate(c.start_date)}, com vigência prevista até ${formatDate(c.end_date)}, referente ao imóvel situado em ${c.property?.address ?? "—"}${c.property?.city ? `, ${c.property.city}/${c.property.state ?? ""}` : ""}.`);
  d.y += 4;

  section(d, "DA DATA DE ENCERRAMENTO");
  p(d, `A locação fica encerrada em ${formatDate(dist.end_date)}, data em que o LOCATÁRIO entrega o imóvel ao LOCADOR, livre e desimpedido.`);

  section(d, "DA MULTA POR RESCISÃO ANTECIPADA");
  if (multa > 0) {
    p(d, `Em razão da rescisão antecipada (${dist.meses_restantes} meses restantes do prazo original), o LOCATÁRIO pagará ao LOCADOR multa proporcional no valor de ${formatBRL(multa)} (${valorPorExtenso(multa)}), nos termos do art. 4º da Lei 8.245/91.`);
  } else {
    p(d, "As partes dispensam reciprocamente qualquer multa rescisória.");
  }

  section(d, "DA DEVOLUÇÃO DA CAUÇÃO");
  if (dist.devolver_caucao && dist.caucao_valor > 0) {
    p(d, `O LOCADOR devolverá ao LOCATÁRIO o valor da caução de ${formatBRL(dist.caucao_valor)}, abatidos eventuais débitos pendentes, no prazo de até 30 dias.`);
  } else {
    p(d, "Não há valor de caução a ser devolvido.");
  }

  section(d, "DA QUITAÇÃO");
  p(d, "Cumpridas as obrigações acima, as partes outorgam reciprocamente a mais ampla, geral, rasa e irrevogável quitação, nada mais tendo a reclamar uma da outra a qualquer tempo ou título.");

  if (dist.observacoes?.trim()) { section(d, "OBSERVAÇÕES"); p(d, dist.observacoes); }

  const cidade = c.property?.city ?? owner.address_city ?? "—";
  assinaturas(d, [
    { role: "LOCADOR", name: owner.full_name ?? "—", cpf: owner.cpf },
    { role: "LOCATÁRIO", name: c.tenant?.full_name ?? "—", cpf: c.tenant?.cpf },
  ], cidade);
  return d.doc;
}

// ===================================================================
// MODELO 3 — Confissão de Dívida
// ===================================================================
export type ConfissaoData = {
  valor_divida: number;
  parcelas: number;
  data_inicio_pagamento: string; // ISO
};

export function gerarConfissaoDivida(c: ContractPDFData, owner: OwnerProfile, conf: ConfissaoData): jsPDF {
  const d = newDoc();
  header(d, "INSTRUMENTO PARTICULAR DE CONFISSÃO DE DÍVIDA");

  const parcela = conf.parcelas > 0 ? conf.valor_divida / conf.parcelas : conf.valor_divida;

  section(d, "DAS PARTES");
  p(d, `CREDOR: ${qualificacaoOwner(owner)}.`);
  p(d, `DEVEDOR: ${qualificacaoTenant(c.tenant)}.`);
  if (c.guarantor?.name) p(d, `FIADOR: ${qualificacaoFiador(c.guarantor)}, solidariamente responsável pelo pagamento.`);
  d.y += 6;

  section(d, "CLÁUSULA 1ª — DA DÍVIDA");
  p(d, `O DEVEDOR confessa-se devedor ao CREDOR da quantia líquida e certa de ${formatBRL(conf.valor_divida)} (${valorPorExtenso(conf.valor_divida)}), referente a aluguéis e encargos vencidos do contrato de locação celebrado em ${formatDate(c.start_date)}.`);

  section(d, "CLÁUSULA 2ª — DO PAGAMENTO");
  p(d, `O DEVEDOR pagará a dívida em ${conf.parcelas} parcelas mensais e consecutivas de ${formatBRL(parcela)} (${valorPorExtenso(parcela)}), vencendo a primeira em ${formatDate(conf.data_inicio_pagamento)} e as demais no mesmo dia dos meses subsequentes.`);

  section(d, "CLÁUSULA 3ª — DA MORA E DOS ENCARGOS");
  p(d, "O atraso no pagamento de qualquer parcela acarretará: (a) multa moratória de 10% sobre o valor devido; (b) juros de mora de 1% ao mês; (c) correção monetária; (d) honorários advocatícios de 20% em caso de cobrança judicial ou extrajudicial.");

  section(d, "CLÁUSULA 4ª — DO VENCIMENTO ANTECIPADO");
  p(d, "O inadimplemento de qualquer parcela importará no vencimento antecipado de todas as demais, podendo o CREDOR cobrar de uma só vez o saldo devedor atualizado.");

  section(d, "CLÁUSULA 5ª — DO TÍTULO EXECUTIVO");
  p(d, "Este instrumento constitui título executivo extrajudicial, nos termos do art. 784, III, do Código de Processo Civil.");

  section(d, "CLÁUSULA 6ª — DO FORO");
  p(d, `Fica eleito o foro da comarca de ${c.property?.city ?? owner.address_city ?? "—"} para dirimir quaisquer dúvidas.`);

  const signers = [
    { role: "CREDOR", name: owner.full_name ?? "—", cpf: owner.cpf },
    { role: "DEVEDOR", name: c.tenant?.full_name ?? "—", cpf: c.tenant?.cpf },
  ];
  if (c.guarantor?.name) signers.push({ role: "FIADOR", name: c.guarantor.name, cpf: c.guarantor.cpf });
  assinaturas(d, signers, c.property?.city ?? owner.address_city ?? "—");
  return d.doc;
}

// ===================================================================
// MODELO 4 — Termo de Vistoria
// ===================================================================
export type VistoriaItem = { comodo: string; estado: "bom" | "regular" | "ruim"; observacoes?: string };
export type VistoriaData = {
  tipo: "entrada" | "saida";
  data: string; // ISO
  itens: VistoriaItem[];
  observacoes_gerais?: string;
};

export function gerarTermoVistoria(c: ContractPDFData, owner: OwnerProfile, v: VistoriaData): jsPDF {
  const d = newDoc();
  header(d, `TERMO DE VISTORIA — ${v.tipo === "entrada" ? "ENTRADA" : "SAÍDA"}`);

  section(d, "IDENTIFICAÇÃO");
  p(d, `Imóvel: ${c.property?.address ?? "—"}${c.property?.city ? `, ${c.property.city}/${c.property.state ?? ""}` : ""}`);
  p(d, `Locador: ${owner.full_name ?? "—"} (CPF ${owner.cpf ?? "—"})`);
  p(d, `Locatário: ${c.tenant?.full_name ?? "—"} (CPF ${c.tenant?.cpf ?? "—"})`);
  p(d, `Data da vistoria: ${formatDate(v.data)}`);
  d.y += 8;

  section(d, "ESTADO DE CONSERVAÇÃO POR CÔMODO");
  for (const it of v.itens) {
    ensure(d, 28);
    d.doc.setFont("helvetica","bold");
    d.doc.text(`• ${it.comodo}`, d.M, d.y);
    d.doc.setFont("helvetica","normal");
    d.doc.text(`Estado: ${it.estado.toUpperCase()}`, d.W - d.M, d.y, { align: "right" });
    d.y += 14;
    if (it.observacoes?.trim()) p(d, `  Obs.: ${it.observacoes}`);
    d.y += 2;
  }

  if (v.observacoes_gerais?.trim()) { section(d, "OBSERVAÇÕES GERAIS"); p(d, v.observacoes_gerais); }

  section(d, "DECLARAÇÃO");
  p(d, "As partes declaram que o imóvel foi vistoriado e encontra-se nas condições descritas acima, servindo este termo como referência para a entrega/devolução do bem.");

  assinaturas(d, [
    { role: "LOCADOR", name: owner.full_name ?? "—", cpf: owner.cpf },
    { role: "LOCATÁRIO", name: c.tenant?.full_name ?? "—", cpf: c.tenant?.cpf },
  ], c.property?.city ?? owner.address_city ?? "—");
  return d.doc;
}

// ===================================================================
// MODELO 5 — Locação Residencial/Comercial (20 cláusulas, completo)
// ===================================================================
export function gerarContratoLocacaoCompleto(c: ContractPDFData, owner: OwnerProfile): jsPDF {
  const d = newDoc();
  const tipo = (c.contract_type ?? "residencial").toUpperCase();
  header(d, `CONTRATO DE LOCAÇÃO DE IMÓVEL ${tipo}`);
  d.doc.setFontSize(9); d.doc.setTextColor(120);
  d.doc.text("Regido pela Lei nº 8.245/91 (Lei do Inquilinato) e LGPD (Lei 13.709/18)", d.W/2, d.y, { align: "center" });
  d.y += 18; d.doc.setTextColor(20); d.doc.setFontSize(10);

  const meses = monthsBetween(c.start_date, c.end_date);
  const valorExt = valorPorExtenso(c.rent_amount);
  const cidade = c.property?.city ?? owner.address_city ?? "—";
  const estado = c.property?.state ?? owner.address_uf ?? "—";
  const objeto = `${c.property?.address ?? "—"}${c.property?.city ? `, ${c.property.city}/${c.property.state ?? ""}` : ""}`;
  const tipoLower = (c.contract_type ?? "residencial").toLowerCase();
  const formaPag = owner.pix_key ? `PIX (${owner.pix_key}) ou transferência bancária` : "Boleto, transferência ou PIX";

  section(d, "DAS PARTES");
  p(d, `LOCADOR: ${qualificacaoOwner(owner)}.`);
  p(d, `LOCATÁRIO: ${qualificacaoTenant(c.tenant)}.`);
  if (c.guarantor?.name) p(d, `FIADOR: ${qualificacaoFiador(c.guarantor)}.`);
  d.y += 6;

  const garantiaClausula = c.guarantee_type === "caucao"
    ? `Como garantia de fiança, o LOCATÁRIO depositará caução no valor de ${formatBRL((c.guarantee_months ?? 1) * c.rent_amount)}, equivalente a ${c.guarantee_months ?? 1} mês(es) de aluguel. A caução servirá como garantia de eventuais inadimplementos, não impedindo a ação de cobrança e despejo cabíveis. Não acionada ao término da locação, será devolvida em até 5 dias úteis, devidamente atualizada.`
    : c.guarantee_type === "fiador"
      ? `O FIADOR, principal pagador do LOCATÁRIO, responde solidariamente por todos os pagamentos descritos neste contrato, até a efetiva entrega das chaves ao LOCADOR e termo de vistoria do imóvel.`
      : c.guarantee_type === "seguro_fianca"
        ? "A garantia desta locação será prestada mediante seguro fiança locatícia contratado pelo LOCATÁRIO em seguradora idônea, com vigência mínima igual ao prazo deste contrato."
        : "As partes ajustam a presente locação sem exigência de garantia, nos termos do art. 37 da Lei 8.245/91.";

  const clauses: Array<[string, string]> = [
    ["CLÁUSULA PRIMEIRA — DO OBJETO DA LOCAÇÃO", `1.1 O objeto deste contrato de locação é o imóvel situado em ${objeto}, no exato estado do termo de vistoria e fotos em anexo.`],
    ["CLÁUSULA SEGUNDA — DO PRAZO DE VIGÊNCIA", `2.1 O prazo da locação é de ${meses} meses, iniciando-se em ${formatDate(c.start_date)} com término em ${formatDate(c.end_date)}, independentemente de aviso, notificação ou interpelação judicial ou extrajudicial.\n2.2 Findo o prazo ajustado, se o locatário continuar na posse do imóvel por mais de 30 dias sem oposição do locador, presumir-se-á prorrogada a locação por prazo indeterminado, mantidas as demais cláusulas e condições do contrato.`],
    ["CLÁUSULA TERCEIRA — DA FORMA DE PAGAMENTO", `3.1 O aluguel mensal deverá ser pago até o dia ${c.due_day} do mês subsequente ao vencido, por meio de ${formaPag}, no valor de ${formatBRL(c.rent_amount)} (${valorExt}), reajustados anualmente pelo índice ${ADJ[c.adjustment_index] ?? c.adjustment_index}, incidente sobre o último aluguel pago no mês anterior. Sendo extinto tal índice, será utilizado, sucessivamente, o IPC/FIPE ou IGP/FGV.`],
    ["CLÁUSULA QUARTA — DAS TAXAS E TRIBUTOS", "4.1 Todas as taxas e tributos incidentes sobre o imóvel, tais como condomínio, IPTU, bem como despesas ordinárias de condomínio e quaisquer outras que recaírem sobre o imóvel, serão de responsabilidade do LOCATÁRIO, o qual arcará também com as despesas de luz, força, água e gás, pagas diretamente às concessionárias, independentemente da troca de titularidade."],
    ["CLÁUSULA QUINTA — DA MULTA E JUROS DE MORA", "5.1 Em caso de mora no pagamento do aluguel, o valor será corrigido pelo IGP-M até o dia do efetivo pagamento e acrescido de multa moratória de 10% e juros de 1% ao mês, ensejando cobrança por advogado, fixados desde já os honorários em 10% se amigável e 20% se judicial."],
    ["CLÁUSULA SEXTA — DA CONSERVAÇÃO, REFORMAS E BENFEITORIAS", "6.1 Ao LOCATÁRIO recai a responsabilidade por zelar pela conservação, limpeza e segurança do imóvel.\n6.2 Benfeitorias necessárias serão indenizáveis; úteis somente se previamente autorizadas; voluptuárias não são indenizáveis e poderão ser levantadas se sua retirada não afetar a estrutura.\n6.3 O LOCATÁRIO obriga-se a devolver o imóvel em perfeitas condições de limpeza, conservação e pintura, conforme termo de vistoria em anexo.\n6.4 Obras que alterem a estrutura dependem de autorização escrita do LOCADOR; quando autorizadas, incorporam-se ao imóvel sem direito a indenização.\n6.5 É responsabilidade do LOCATÁRIO verificar a voltagem e a capacidade da instalação elétrica, respondendo por danos a equipamentos por inadequação."],
    ["CLÁUSULA SÉTIMA — DA DESTINAÇÃO DO IMÓVEL", `7.1 O LOCATÁRIO declara que o imóvel destina-se exclusivamente para uso ${tipoLower}.\n7.2 O LOCATÁRIO obriga-se, por si e seus dependentes, a cumprir as disposições legais sobre o Condomínio, sua Convenção e Regulamento Interno.`],
    ["CLÁUSULA OITAVA — DOS SINISTROS", "8.1 No caso de sinistro do prédio, parcial ou total, que impossibilite a habitação do imóvel locado, o presente contrato estará rescindido, independentemente de aviso ou interpelação.\n8.2 No caso de incêndio parcial, o contrato terá sua vigência suspensa, sendo devolvido ao LOCATÁRIO após a reconstrução, prorrogado pelo mesmo tempo das obras."],
    ["CLÁUSULA NONA — DA SUBLOCAÇÃO", "9.1 É vedado ao LOCATÁRIO sublocar, transferir ou ceder o imóvel, sendo nulo qualquer ato praticado sem consentimento prévio e por escrito do LOCADOR."],
    ["CLÁUSULA DÉCIMA — DA DESAPROPRIAÇÃO", "10.1 Em caso de desapropriação total ou parcial do imóvel, ficará rescindido de pleno direito o presente contrato, sendo passíveis de indenização as perdas e danos efetivamente demonstradas."],
    ["CLÁUSULA DÉCIMA PRIMEIRA — DOS CASOS DE FALECIMENTO", "11.1 Falecendo o FIADOR, deve o LOCATÁRIO, no prazo de 30 dias, indicar substituto idôneo nas mesmas condições ou prestar seguro fiança de empresa idônea."],
    ["CLÁUSULA DÉCIMA SEGUNDA — DA GARANTIA", `12.1 ${garantiaClausula}`],
    ["CLÁUSULA DÉCIMA TERCEIRA — DA ALIENAÇÃO DO IMÓVEL", "13.1 No caso de alienação do imóvel, o LOCATÁRIO terá direito de preferência; não utilizada formalmente, o LOCADOR poderá dispor livremente do imóvel."],
    ["CLÁUSULA DÉCIMA QUARTA — DAS VISTORIAS", "14.1 É facultado ao LOCADOR, mediante aviso prévio, vistoriar o imóvel, por si ou seus procuradores, sempre que achar conveniente, para certificar o cumprimento das obrigações."],
    ["CLÁUSULA DÉCIMA QUINTA — DAS INFRAÇÕES AO CONTRATO", `15.1 A não observância de qualquer das cláusulas do presente contrato sujeita o infrator à multa de 3 (três) aluguéis vigentes, tomando-se por base o último aluguel vencido (referência: ${formatBRL(c.rent_amount * 3)}).`],
    ["CLÁUSULA DÉCIMA SEXTA — DA SUCESSÃO", "16.1 As partes contratantes obrigam-se por si, herdeiros e/ou sucessores."],
    ["CLÁUSULA DÉCIMA SÉTIMA — DA RESCISÃO DO CONTRATO", `17.1 A rescisão antecipada culmina em multa contratual proporcional, calculada por: valor da multa (3 aluguéis) / ${meses} meses × meses faltantes para o término.\n17.2 Após o prazo de vigência, podem as partes rescindir o contrato mediante aviso prévio de 30 dias.`],
    ["CLÁUSULA DÉCIMA OITAVA — DA OBSERVÂNCIA À LGPD", "18.1 O LOCATÁRIO declara expresso CONSENTIMENTO para que o LOCADOR colete, trate e compartilhe os dados necessários ao cumprimento do contrato (art. 7º, V, LGPD), ao cumprimento de obrigações legais (art. 7º, II) e à proteção ao crédito (art. 7º, V)."],
    ["CLÁUSULA DÉCIMA NONA — TERMOS GERAIS", "19.1 O LOCATÁRIO obriga-se a respeitar os direitos de vizinhança e a Convenção/Regulamento Interno do condomínio, respondendo por multas decorrentes de infrações.\n19.2 A colocação de placas, letreiros, aparelhos de ar-condicionado, antenas e similares depende de observância da legislação municipal e, quando em condomínio, de prévia autorização do síndico."],
    ["CLÁUSULA VIGÉSIMA — DO FORO", `20.1 As partes elegem o foro de ${cidade}/${estado} para dirimirem qualquer litígio decorrente do presente termo.`],
  ];

  for (const [title, body] of clauses) { section(d, title); for (const part of body.split("\n")) p(d, part); d.y += 2; }

  ensure(d, 30);
  d.doc.setFont("helvetica","italic"); d.doc.setFontSize(9); d.doc.setTextColor(100);
  d.doc.text(`${cidade}, ${dataPorExtenso()}.`, d.M, d.y); d.y += 16;
  d.doc.setFont("helvetica","normal"); d.doc.setFontSize(10); d.doc.setTextColor(20);

  const signers = [
    { role: "LOCADOR", name: owner.full_name ?? "—", cpf: owner.cpf },
    { role: "LOCATÁRIO", name: c.tenant?.full_name ?? "—", cpf: c.tenant?.cpf },
  ];
  if (c.guarantor?.name) signers.push({ role: "FIADOR", name: c.guarantor.name, cpf: c.guarantor.cpf });
  assinaturas(d, signers, `${cidade}/${estado}`);

  // Testemunhas
  ensure(d, 60); d.y += 10;
  d.doc.setFont("helvetica","bold"); d.doc.text("TESTEMUNHAS:", d.M, d.y); d.y += 18;
  d.doc.setFont("helvetica","normal");
  d.doc.line(d.M, d.y, d.M + 220, d.y);
  d.doc.line(d.W - d.M - 220, d.y, d.W - d.M, d.y); d.y += 12;
  d.doc.setFontSize(9); d.doc.text("Nome / RG", d.M, d.y); d.doc.text("Nome / RG", d.W - d.M - 220, d.y);

  return d.doc;
}

// ===================================================================
// MODELO 6 — Corretagem Imobiliária
// ===================================================================
export type CorretagemData = {
  corretor_nome: string;
  corretor_cpf: string;
  corretor_creci?: string;
  corretor_endereco?: string;
  valor_imovel: number;
  comissao_percent: number; // ex: 6
  prazo_dias: number;
  cidade_foro: string;
};

export function gerarCorretagemImobiliaria(c: ContractPDFData, owner: OwnerProfile, k: CorretagemData): jsPDF {
  const d = newDoc();
  header(d, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CORRETAGEM IMOBILIÁRIA");

  section(d, "IDENTIFICAÇÃO DAS PARTES");
  p(d, `CONTRATANTE (PROPRIETÁRIO): ${qualificacaoOwner(owner)}.`);
  p(d, `CORRETOR: ${k.corretor_nome}, portador(a) do CPF nº ${k.corretor_cpf}${k.corretor_creci ? `, CRECI nº ${k.corretor_creci}` : ""}${k.corretor_endereco ? `, residente em ${k.corretor_endereco}` : ""}.`);
  d.y += 4;

  section(d, "CLÁUSULA 1ª — DO OBJETO");
  p(d, `O presente contrato tem como objeto a prestação de serviços de corretagem para o oferecimento e negociação da venda do imóvel situado em ${c.property?.address ?? "—"}${c.property?.city ? `, ${c.property.city}/${c.property.state ?? ""}` : ""}.`);

  section(d, "CLÁUSULA 2ª — DO IMÓVEL");
  p(d, "O imóvel encontra-se livre de quaisquer ônus ou dívidas que possam impedir transações. O CONTRATANTE compromete-se a fornecer todas as certidões pessoais e do imóvel necessárias.");

  section(d, "CLÁUSULA 3ª — DEVERES DO CONTRATANTE");
  p(d, "3.1 O CONTRATANTE compromete-se a não negociar e/ou vender o imóvel diretamente durante a vigência deste contrato; caso o faça, será devido o pagamento integral da comissão ajustada.");
  p(d, "3.2 Todo o trâmite de transferência do imóvel ao novo comprador será de exclusiva responsabilidade do CONTRATANTE.");

  section(d, "CLÁUSULA 4ª — DA PRESTAÇÃO DE SERVIÇOS");
  p(d, "O CORRETOR compromete-se a realizar o trabalho de corretagem de forma criteriosa e com a máxima honestidade, empregando todos os meios pessoais para concretizar a venda do imóvel, sem utilizar intermediários sem autorização expressa do CONTRATANTE.");

  section(d, "CLÁUSULA 5ª — DO VALOR DO IMÓVEL E DA COMISSÃO");
  p(d, `5.1 O imóvel é ofertado pelo valor total de ${formatBRL(k.valor_imovel)} (${valorPorExtenso(k.valor_imovel)}).`);
  p(d, `5.2 Concretizada a venda, o CONTRATANTE pagará ao CORRETOR comissão equivalente a ${k.comissao_percent}% sobre o valor efetivo da venda, totalizando, no preço base, ${formatBRL((k.valor_imovel * k.comissao_percent) / 100)}.`);
  p(d, "5.3 Vendido o imóvel a preço superior ao ofertado, o CORRETOR receberá a diferença, limitada a 10% sobre o preço base.");
  p(d, "5.4 É vedado ao CORRETOR ofertar o imóvel a preço menor sem autorização expressa.");

  section(d, "CLÁUSULA 6ª — DO PRAZO");
  p(d, `6.1 O CORRETOR terá o prazo de ${k.prazo_dias} dias, contados da assinatura deste, para concretizar a venda do imóvel.`);
  p(d, "6.2 Ultrapassado o prazo, o CORRETOR fará jus à comissão se a venda ocorrer dentro de 90 dias após o término, desde que as negociações já estivessem iniciadas e formalmente comunicadas ao CONTRATANTE.");

  section(d, "CLÁUSULA 7ª — CONDIÇÕES GERAIS");
  p(d, "O CORRETOR intermediará a operação até a inicialização da venda, restando os demais trâmites por conta e risco do CONTRATANTE. Findo o prazo, o CORRETOR devolverá ao CONTRATANTE todos os documentos e chaves em seu poder.");

  section(d, "CLÁUSULA 8ª — DO FORO");
  p(d, `Fica eleito o foro da comarca de ${k.cidade_foro} para dirimir quaisquer controvérsias oriundas deste contrato.`);

  assinaturas(d, [
    { role: "CONTRATANTE", name: owner.full_name ?? "—", cpf: owner.cpf },
    { role: "CORRETOR", name: k.corretor_nome, cpf: k.corretor_cpf },
  ], k.cidade_foro);
  return d.doc;
}

// ---------- Download helpers ----------
function slug(s: string) { return s.replace(/\s+/g, "-").toLowerCase(); }

export function baixarContratoResidencial(name: string, c: ContractPDFData, o: OwnerProfile) {
  gerarContratoResidencial(c, o).save(`contrato-${slug(name)}.pdf`);
}
export function baixarDistrato(name: string, c: ContractPDFData, o: OwnerProfile, dist: DistratoData) {
  gerarDistrato(c, o, dist).save(`distrato-${slug(name)}.pdf`);
}
export function baixarConfissaoDivida(name: string, c: ContractPDFData, o: OwnerProfile, conf: ConfissaoData) {
  gerarConfissaoDivida(c, o, conf).save(`confissao-divida-${slug(name)}.pdf`);
}
export function baixarTermoVistoria(name: string, c: ContractPDFData, o: OwnerProfile, v: VistoriaData) {
  gerarTermoVistoria(c, o, v).save(`vistoria-${slug(name)}.pdf`);
}
export function baixarContratoLocacaoCompleto(name: string, c: ContractPDFData, o: OwnerProfile) {
  gerarContratoLocacaoCompleto(c, o).save(`contrato-locacao-${slug(name)}.pdf`);
}
export function baixarCorretagem(name: string, c: ContractPDFData, o: OwnerProfile, k: CorretagemData) {
  gerarCorretagemImobiliaria(c, o, k).save(`corretagem-${slug(name)}.pdf`);
}
