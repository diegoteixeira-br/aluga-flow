import jsPDF from "jspdf";
import { formatBRL, formatDate } from "@/lib/format";
import { valorPorExtenso } from "@/lib/extenso";

export type ExtraCharge = { label: string; amount: number };

export type ContractPDFData = {
  contract_type?: string; // residencial | comercial
  property?: {
    nickname?: string | null; address?: string | null; city?: string | null; state?: string | null;
    zip_code?: string | null; type?: string | null; bedrooms?: number | null; area_m2?: number | null;
  };
  tenant?: {
    full_name?: string | null; cpf?: string | null; rg?: string | null;
    email?: string | null; phone?: string | null;
    address_street?: string | null; address_number?: string | null;
    address_neighborhood?: string | null; address_city?: string | null; address_state?: string | null;
  };
  guarantor?: {
    name?: string | null; cpf?: string | null; rg?: string | null;
    email?: string | null; phone?: string | null; address?: string | null;
  } | null;
  start_date: string;
  end_date: string;
  rent_amount: number;
  due_day: number;
  deposit_amount?: number | null;
  adjustment_index: string;
  adjustment_frequency_months: number;
  guarantee_type: string;
  guarantee_months?: number | null;
  extra_charges?: ExtraCharge[];
  notes?: string | null;
};

export type OwnerProfile = {
  full_name?: string | null; cpf?: string | null; rg?: string | null;
  phone?: string | null; email?: string | null;
  address_street?: string | null; address_number?: string | null; address_neighborhood?: string | null;
  address_city?: string | null; address_uf?: string | null; address_zip?: string | null;
  bank_name?: string | null; bank_agency?: string | null; bank_account?: string | null; pix_key?: string | null;
};

export type SignatureFooter = {
  role: "locador" | "locatario" | "fiador";
  name: string;
  cpf: string;
  signed_at: string; // ISO
  ip?: string | null;
};

const ADJ_LABEL: Record<string, string> = { nenhum: "Nenhum", igpm: "IGP-M", ipca: "IPCA" };
const GUARANTEE_LABEL: Record<string, string> = {
  sem_garantia: "Sem garantia", fiador: "Fiador", caucao: "Caução em dinheiro", seguro_fianca: "Seguro fiança",
};

export function generateContractPDF(
  c: ContractPDFData,
  owner: OwnerProfile,
  signatures?: SignatureFooter[],
): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;
  const dash = (v: string | number | null | undefined) => (v !== null && v !== undefined && String(v).trim() ? String(v) : "—");

  const ensure = (need: number) => { if (y + need > H - M) { doc.addPage(); y = M; } };

  // Header
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(26, 74, 107);
  doc.text("AlugaFlow", M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120);
  doc.text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, W - M, y, { align: "right" });
  y += 10;
  doc.setDrawColor(26, 74, 107); doc.line(M, y, W - M, y);
  y += 24;

  doc.setTextColor(20);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  const tipo = (c.contract_type || "residencial").toUpperCase();
  doc.text(`CONTRATO DE LOCAÇÃO ${tipo}`, W / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(120);
  doc.text("Regido pela Lei nº 8.245/91 (Lei do Inquilinato)", W / 2, y + 8, { align: "center" });
  y += 28;

  const section = (title: string) => {
    ensure(28);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(26, 74, 107);
    doc.text(title, M, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(20);
  };
  const line = (text: string) => {
    const wrapped = doc.splitTextToSize(text, W - 2 * M);
    for (const w of wrapped) { ensure(14); doc.text(w, M, y); y += 13; }
  };

  // PARTES
  section("LOCADOR (Proprietário)");
  line(`Nome: ${dash(owner.full_name)}`);
  line(`CPF: ${dash(owner.cpf)}   RG: ${dash(owner.rg)}`);
  line(`E-mail: ${dash(owner.email)}   Telefone: ${dash(owner.phone)}`);
  const oAddr = [owner.address_street, owner.address_number, owner.address_neighborhood, owner.address_city, owner.address_uf].filter(Boolean).join(", ");
  if (oAddr) line(`Endereço: ${oAddr}${owner.address_zip ? ` - CEP ${owner.address_zip}` : ""}`);
  y += 6;

  section("LOCATÁRIO (Inquilino)");
  const t = c.tenant;
  line(`Nome: ${dash(t?.full_name)}`);
  line(`CPF: ${dash(t?.cpf)}   RG: ${dash(t?.rg)}`);
  line(`E-mail: ${dash(t?.email)}   Telefone: ${dash(t?.phone)}`);
  const tAddr = [t?.address_street, t?.address_number, t?.address_neighborhood, t?.address_city, t?.address_state].filter(Boolean).join(", ");
  if (tAddr) line(`Endereço: ${tAddr}`);
  y += 6;

  if (c.guarantor?.name) {
    section("FIADOR");
    line(`Nome: ${dash(c.guarantor.name)}`);
    line(`CPF: ${dash(c.guarantor.cpf)}   RG: ${dash(c.guarantor.rg)}`);
    line(`E-mail: ${dash(c.guarantor.email)}   Telefone: ${dash(c.guarantor.phone)}`);
    if (c.guarantor.address) line(`Endereço: ${c.guarantor.address}`);
    y += 6;
  }

  // IMÓVEL
  section("IMÓVEL LOCADO");
  const p = c.property;
  line(`Identificação: ${dash(p?.nickname)}`);
  line(`Endereço: ${dash(p?.address)}${p?.city ? ` - ${p.city}/${p.state ?? ""}` : ""}${p?.zip_code ? ` - CEP ${p.zip_code}` : ""}`);
  line(`Tipo: ${dash(p?.type)}${p?.bedrooms ? ` | ${p.bedrooms} dorm.` : ""}${p?.area_m2 ? ` | ${p.area_m2} m²` : ""}`);
  y += 10;

  // CLÁUSULAS
  const valorExtenso = valorPorExtenso(c.rent_amount);
  const meses = monthsBetween(c.start_date, c.end_date);
  const extras = (c.extra_charges ?? []).filter((e) => e && e.label);
  const extrasText = extras.length
    ? extras.map((e) => `${e.label} (${formatBRL(e.amount || 0)})`).join(", ")
    : "nenhuma cobrança adicional pactuada";

  const garantiaDesc = (() => {
    if (c.guarantee_type === "caucao") {
      const m = c.guarantee_months ?? 1;
      return `caução em dinheiro equivalente a ${m} (${valorPorExtenso(m).split(" ")[0]}) mês(es) de aluguel, totalizando ${formatBRL(m * c.rent_amount)}, a ser depositada pelo LOCATÁRIO até a assinatura deste contrato.`;
    }
    if (c.guarantee_type === "fiador") {
      return `fiança prestada por ${dash(c.guarantor?.name)}, CPF ${dash(c.guarantor?.cpf)}, que se obriga solidariamente pelo cumprimento de todas as obrigações deste contrato, nos termos do art. 39 da Lei nº 8.245/91.`;
    }
    if (c.guarantee_type === "seguro_fianca") {
      return "seguro fiança locatícia contratado pelo LOCATÁRIO em seguradora idônea, mantendo-o vigente durante toda a vigência deste contrato.";
    }
    return "nenhuma garantia foi exigida nesta locação, conforme acordo entre as partes.";
  })();

  const clauses: { title: string; body: string }[] = [
    {
      title: "CLÁUSULA 1ª — DO OBJETO",
      body: `O LOCADOR cede ao LOCATÁRIO, em locação ${c.contract_type === "comercial" ? "comercial" : "residencial"}, o imóvel acima identificado, com todas as suas instalações e acessórios, recebido em perfeitas condições de habitabilidade, uso e conservação.`,
    },
    {
      title: "CLÁUSULA 2ª — DO PRAZO",
      body: `A locação vigorará pelo prazo de ${meses} (${valorPorExtenso(meses).split(" ")[0]}) meses, com início em ${formatDate(c.start_date)} e término em ${formatDate(c.end_date)}, podendo ser prorrogada mediante novo ajuste escrito entre as partes.`,
    },
    {
      title: "CLÁUSULA 3ª — DO VALOR E FORMA DE PAGAMENTO",
      body: `O aluguel mensal é de ${formatBRL(c.rent_amount)} (${valorExtenso}), a ser pago até o dia ${c.due_day} de cada mês, por depósito ou PIX em favor do LOCADOR. O atraso implicará multa de 2% sobre o valor devido, juros de mora de 1% ao mês e correção monetária pelo IGP-M, conforme art. 17 e seguintes da Lei nº 8.245/91.`,
    },
    {
      title: "CLÁUSULA 4ª — DO REAJUSTE",
      body: c.adjustment_index === "nenhum"
        ? "Não haverá reajuste do valor do aluguel durante a vigência deste contrato."
        : `O valor do aluguel será reajustado a cada ${c.adjustment_frequency_months} (${valorPorExtenso(c.adjustment_frequency_months).split(" ")[0]}) meses, com base na variação acumulada do índice ${ADJ_LABEL[c.adjustment_index] ?? c.adjustment_index}, ou outro índice oficial que vier a substituí-lo, observada a periodicidade mínima legal.`,
    },
    {
      title: "CLÁUSULA 5ª — DAS TAXAS, TRIBUTOS E ENCARGOS",
      body: `Correrão por conta do LOCATÁRIO, além do aluguel: ${extrasText}, bem como tarifas de água, energia elétrica, gás, telefone, internet e demais consumos do imóvel. O LOCATÁRIO se obriga a exibir os comprovantes de quitação sempre que solicitado pelo LOCADOR.`,
    },
    {
      title: "CLÁUSULA 6ª — DA CONSERVAÇÃO E DAS REFORMAS",
      body: "O LOCATÁRIO obriga-se a manter o imóvel em perfeito estado de conservação e a devolvê-lo, ao final da locação, nas mesmas condições em que o recebeu, salvo o desgaste natural pelo uso regular. Nenhuma modificação, benfeitoria ou reforma poderá ser realizada sem prévia e expressa autorização escrita do LOCADOR. Benfeitorias úteis ou voluptuárias não autorizadas não serão indenizáveis e poderão ser retiradas, desde que sem dano ao imóvel.",
    },
    {
      title: "CLÁUSULA 7ª — DAS PROIBIÇÕES AO LOCATÁRIO",
      body: "É vedado ao LOCATÁRIO: (a) ceder, sublocar ou emprestar o imóvel, total ou parcialmente, sem prévia autorização escrita do LOCADOR; (b) utilizar o imóvel para fim diverso do pactuado; (c) manter no imóvel substâncias inflamáveis, explosivas ou que possam comprometer sua segurança e integridade; (d) realizar atividades que perturbem o sossego, a segurança ou os bons costumes da vizinhança.",
    },
    {
      title: "CLÁUSULA 8ª — DA RESCISÃO",
      body: "O presente contrato poderá ser rescindido: (a) por mútuo acordo entre as partes; (b) por descumprimento de qualquer de suas cláusulas; (c) pela falta de pagamento do aluguel e demais encargos; (d) por iniciativa do LOCATÁRIO, mediante aviso prévio de 30 (trinta) dias; (e) nas demais hipóteses previstas nos arts. 9º, 46 e 47 da Lei nº 8.245/91.",
    },
    {
      title: "CLÁUSULA 9ª — DA MULTA POR RESCISÃO ANTECIPADA",
      body: `Em caso de rescisão antecipada pelo LOCATÁRIO antes do término do prazo contratual, será devida multa equivalente a 3 (três) aluguéis, reduzida proporcionalmente ao período já cumprido, na forma do art. 4º da Lei nº 8.245/91. O valor de referência da multa, com base no aluguel atual, equivale a ${formatBRL(c.rent_amount * 3)}.`,
    },
    {
      title: "CLÁUSULA 10ª — DA GARANTIA",
      body: `Como garantia das obrigações assumidas neste contrato, fica estabelecida a modalidade: ${GUARANTEE_LABEL[c.guarantee_type] ?? c.guarantee_type} — ${garantiaDesc}`,
    },
    {
      title: "CLÁUSULA 11ª — DO FORO",
      body: "Fica eleito o foro da comarca de situação do imóvel para dirimir quaisquer questões oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.",
    },
  ];

  for (const cl of clauses) {
    section(cl.title);
    line(cl.body);
    y += 6;
  }

  if (c.notes && c.notes.trim()) {
    section("CLÁUSULAS ADICIONAIS");
    line(c.notes);
    y += 6;
  }

  if (owner.bank_name || owner.pix_key) {
    section("DADOS PARA PAGAMENTO");
    if (owner.bank_name) line(`Banco: ${owner.bank_name}   Agência: ${dash(owner.bank_agency)}   Conta: ${dash(owner.bank_account)}`);
    if (owner.pix_key) line(`Chave PIX: ${owner.pix_key}`);
    y += 8;
  }

  // ASSINATURAS
  ensure(180);
  y = Math.max(y + 30, y);
  const cityLine = [owner.address_city, owner.address_uf].filter(Boolean).join("/") || "________________";
  doc.setFontSize(10); doc.setTextColor(20);
  doc.text(`${cityLine}, ${new Date().toLocaleDateString("pt-BR")}.`, M, y);
  y += 36;

  const signers: Array<{ role: string; name: string; cpf: string }> = [
    { role: "LOCADOR", name: owner.full_name ?? "—", cpf: owner.cpf ?? "—" },
    { role: "LOCATÁRIO", name: t?.full_name ?? "—", cpf: t?.cpf ?? "—" },
  ];
  if (c.guarantor?.name) signers.push({ role: "FIADOR", name: c.guarantor.name, cpf: c.guarantor.cpf ?? "—" });

  for (const s of signers) {
    ensure(70);
    doc.setDrawColor(20);
    doc.line(M, y, W - M, y);
    y += 14;
    doc.setFontSize(10); doc.setTextColor(20);
    doc.text(s.role, M, y);
    doc.text(s.name, W / 2, y, { align: "center" });
    doc.text(`CPF: ${s.cpf}`, W - M, y, { align: "right" });
    y += 32;
  }

  // Rodapé de assinaturas eletrônicas
  if (signatures && signatures.length > 0) {
    doc.addPage(); y = M;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(26, 74, 107);
    doc.text("REGISTRO DE ASSINATURAS ELETRÔNICAS", M, y); y += 18;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(80);
    doc.text("Este documento foi assinado eletronicamente conforme MP 2.200-2/2001. Validade jurídica garantida pelas evidências abaixo:", M, y, { maxWidth: W - 2 * M });
    y += 30;
    doc.setTextColor(20); doc.setFontSize(10);
    for (const s of signatures) {
      ensure(70);
      doc.setFont("helvetica", "bold");
      doc.text(s.role.toUpperCase(), M, y); y += 13;
      doc.setFont("helvetica", "normal");
      line(`Nome: ${s.name}`);
      line(`CPF: ${s.cpf}`);
      line(`Data/hora: ${new Date(s.signed_at).toLocaleString("pt-BR")}`);
      if (s.ip) line(`IP: ${s.ip}`);
      y += 8;
    }
  }

  return doc;
}

function monthsBetween(startISO: string, endISO: string): number {
  const s = new Date(startISO + "T00:00:00");
  const e = new Date(endISO + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1);
}

export function downloadContractPDF(
  filenameSlug: string,
  c: ContractPDFData,
  owner: OwnerProfile,
  signatures?: SignatureFooter[],
) {
  const doc = generateContractPDF(c, owner, signatures);
  doc.save(`contrato-${filenameSlug.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
