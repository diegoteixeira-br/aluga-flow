import type { ContractPDFData, OwnerProfile } from "@/lib/contract-pdf";
import { formatBRL, formatDate } from "@/lib/format";
import { valorPorExtenso } from "@/lib/extenso";

export type TokenGroup = {
  id: string;
  label: string;
  tokens: Array<{ key: string; label: string }>;
};

export const TOKEN_GROUPS: TokenGroup[] = [
  {
    id: "geral",
    label: "Geral",
    tokens: [
      { key: "data_assinatura", label: "Data de assinatura" },
      { key: "data_hoje_extenso", label: "Data por extenso" },
    ],
  },
  {
    id: "proprietario",
    label: "Proprietário (Locador)",
    tokens: [
      { key: "proprietario_nome", label: "Nome" },
      { key: "proprietario_cpf", label: "CPF" },
      { key: "proprietario_rg", label: "RG" },
      { key: "proprietario_email", label: "E-mail" },
      { key: "proprietario_telefone", label: "Telefone" },
      { key: "proprietario_endereco", label: "Endereço" },
      { key: "proprietario_qualificacao", label: "Qualificação completa" },
      { key: "proprietario_razao_social", label: "Razão social / nome" },
    ],
  },
  {
    id: "contratante",
    label: "Inquilino (Locatário)",
    tokens: [
      { key: "contratante_nome", label: "Nome" },
      { key: "contratante_cpf", label: "CPF" },
      { key: "contratante_rg", label: "RG" },
      { key: "contratante_email", label: "E-mail" },
      { key: "contratante_telefone", label: "Telefone" },
      { key: "contratante_endereco", label: "Endereço atual" },
      { key: "contratante_qualificacao", label: "Qualificação completa" },
    ],
  },
  {
    id: "garantia",
    label: "Fiador / Garantia",
    tokens: [
      { key: "garantia_tipo", label: "Tipo de garantia" },
      { key: "garantia_caucionante_nome", label: "Nome do fiador 1" },
      { key: "garantia_caucionante_qualificacao", label: "Qualificação do fiador 1" },
      { key: "garantia_outro_fiador_nome", label: "Nome do fiador 2" },
      { key: "garantia_outro_fiador_qualificacao", label: "Qualificação do fiador 2" },
    ],
  },
  {
    id: "contrato",
    label: "Contrato",
    tokens: [
      { key: "contrato_objeto", label: "Endereço do imóvel" },
      { key: "contrato_objeto_cidade", label: "Cidade do imóvel" },
      { key: "contrato_objeto_estado", label: "Estado do imóvel" },
      { key: "contrato_inicio", label: "Data de início" },
      { key: "contrato_data_termino", label: "Data de término" },
      { key: "contrato_prazo_em_meses", label: "Prazo em meses" },
      { key: "contrato_valor_inicial", label: "Valor do aluguel" },
      { key: "contrato_valor_inicial_extenso", label: "Valor por extenso" },
      { key: "contrato_dia_vencimento", label: "Dia de vencimento" },
      { key: "contrato_inflacao", label: "Índice de reajuste" },
      { key: "contrato_caucao_valor", label: "Valor da caução" },
    ],
  },
];

function qualificacaoProprietario(o: OwnerProfile): string {
  const partes: string[] = [];
  if (o.full_name) partes.push(o.full_name);
  if (o.cpf) partes.push(`inscrito(a) no CPF nº ${o.cpf}`);
  if (o.rg) partes.push(`RG nº ${o.rg}`);
  const end = [o.address_street, o.address_number, o.address_neighborhood, o.address_city, o.address_uf]
    .filter(Boolean).join(", ");
  if (end) partes.push(`residente em ${end}`);
  if (o.email) partes.push(`e-mail ${o.email}`);
  if (o.phone) partes.push(`telefone ${o.phone}`);
  return partes.join(", ") || "—";
}

function qualificacaoInquilino(t: ContractPDFData["tenant"]): string {
  if (!t) return "—";
  const partes: string[] = [];
  if (t.full_name) partes.push(t.full_name);
  if (t.cpf) partes.push(`CPF nº ${t.cpf}`);
  if (t.rg) partes.push(`RG nº ${t.rg}`);
  const end = [t.address_street, t.address_number, t.address_neighborhood, t.address_city, t.address_state]
    .filter(Boolean).join(", ");
  if (end) partes.push(`residente em ${end}`);
  if (t.email) partes.push(`e-mail ${t.email}`);
  if (t.phone) partes.push(`telefone ${t.phone}`);
  return partes.join(", ");
}

function qualificacaoFiador(g: NonNullable<ContractPDFData["guarantor"]>): string {
  const partes: string[] = [];
  if (g.name) partes.push(g.name);
  if (g.cpf) partes.push(`CPF nº ${g.cpf}`);
  if (g.rg) partes.push(`RG nº ${g.rg}`);
  if (g.address) partes.push(`residente em ${g.address}`);
  if (g.email) partes.push(`e-mail ${g.email}`);
  if (g.phone) partes.push(`telefone ${g.phone}`);
  return partes.join(", ");
}

const ADJ_LABEL: Record<string, string> = { nenhum: "Nenhum", igpm: "IGP-M", ipca: "IPCA" };
const GUAR_LABEL: Record<string, string> = {
  sem_garantia: "Sem garantia", fiador: "Fiador",
  caucao: "Caução em dinheiro", seguro_fianca: "Seguro fiança",
};

export function buildTokenValues(
  c: ContractPDFData,
  owner: OwnerProfile,
  signDateISO?: string,
): Record<string, string> {
  const enderecoImovel = [c.property?.address, c.property?.city, c.property?.state].filter(Boolean).join(", ");
  const caucaoValor = c.guarantee_type === "caucao" && c.guarantee_months && c.rent_amount
    ? c.guarantee_months * c.rent_amount : 0;
  const hoje = signDateISO ?? new Date().toISOString().slice(0, 10);
  return {
    data_assinatura: formatDate(hoje),
    data_hoje_extenso: new Date(hoje + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),

    proprietario_nome: owner.full_name ?? "",
    proprietario_razao_social: owner.full_name ?? "",
    proprietario_cpf: owner.cpf ?? "",
    proprietario_rg: owner.rg ?? "",
    proprietario_email: owner.email ?? "",
    proprietario_telefone: owner.phone ?? "",
    proprietario_endereco: [owner.address_street, owner.address_number, owner.address_neighborhood, owner.address_city, owner.address_uf].filter(Boolean).join(", "),
    proprietario_qualificacao: qualificacaoProprietario(owner),

    contratante_nome: c.tenant?.full_name ?? "",
    contratante_cpf: c.tenant?.cpf ?? "",
    contratante_rg: c.tenant?.rg ?? "",
    contratante_email: c.tenant?.email ?? "",
    contratante_telefone: c.tenant?.phone ?? "",
    contratante_endereco: [c.tenant?.address_street, c.tenant?.address_number, c.tenant?.address_neighborhood, c.tenant?.address_city, c.tenant?.address_state].filter(Boolean).join(", "),
    contratante_qualificacao: qualificacaoInquilino(c.tenant),

    garantia_tipo: GUAR_LABEL[c.guarantee_type] ?? c.guarantee_type,
    garantia_caucionante_nome: c.guarantor?.name ?? "",
    garantia_caucionante_qualificacao: c.guarantor ? qualificacaoFiador(c.guarantor) : "",
    garantia_outro_fiador_nome: "",
    garantia_outro_fiador_qualificacao: "",

    contrato_objeto: enderecoImovel,
    contrato_objeto_cidade: c.property?.city ?? "",
    contrato_objeto_estado: c.property?.state ?? "",
    contrato_inicio: formatDate(c.start_date),
    contrato_data_termino: formatDate(c.end_date),
    contrato_prazo_em_meses: String(monthsBetween(c.start_date, c.end_date)),
    contrato_valor_inicial: formatBRL(c.rent_amount),
    contrato_valor_inicial_extenso: valorPorExtenso(c.rent_amount),
    contrato_dia_vencimento: String(c.due_day),
    contrato_inflacao: ADJ_LABEL[c.adjustment_index] ?? c.adjustment_index,
    contrato_caucao_valor: formatBRL(caucaoValor),
  };
}

function monthsBetween(s: string, e: string): number {
  const a = new Date(s + "T00:00:00"), b = new Date(e + "T00:00:00");
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

const TOKEN_RE = /\[([a-z0-9_]+)\]/gi;

export function resolveTokens(text: string, values: Record<string, string>): string {
  return text.replace(TOKEN_RE, (m, key: string) => {
    const v = values[key];
    return v !== undefined && v !== "" ? v : m;
  });
}

export const TEMPLATE_LOCACAO_DINAMICO = `CONTRATO DE LOCAÇÃO RESIDENCIAL

LOCADOR: [proprietario_qualificacao]

LOCATÁRIO: [contratante_qualificacao]

FIADORES: [garantia_caucionante_qualificacao] e [garantia_outro_fiador_qualificacao]

CLÁUSULA PRIMEIRA - DO OBJETO DA LOCAÇÃO
1.1 O objeto deste contrato de locação é o imóvel situado à [contrato_objeto], no exato estado do termo de vistoria e fotos em anexo.

CLÁUSULA SEGUNDA - DO PRAZO DE VIGÊNCIA
2.1 O prazo da locação é de [contrato_prazo_em_meses] meses, iniciando-se em [contrato_inicio] com término em [contrato_data_termino], independentemente de aviso, notificação ou interpelação judicial ou extrajudicial.
2.2 Findo o prazo ajustado, se o LOCATÁRIO continuar na posse do imóvel alugado por mais de trinta dias sem oposição do LOCADOR, presumir-se-á prorrogada a locação por prazo indeterminado, mantidas as demais cláusulas e condições do contrato.

CLÁUSULA TERCEIRA - DA FORMA DE PAGAMENTO
3.1 O aluguel mensal deverá ser pago até o dia [contrato_dia_vencimento] do mês subsequente ao vencido, por meio de Boleto/Transferência/PIX, no valor de R$ [contrato_valor_inicial] ([contrato_valor_inicial_extenso]), reajustados anualmente pelo índice [contrato_inflacao]. Sendo extinto tal índice, será utilizado, sucessivamente, outro índice permitido por lei.

CLÁUSULA QUARTA - DAS TAXAS E TRIBUTOS
4.1 Todas as taxas e tributos incidentes sobre o imóvel, tais como condomínio, IPTU, bem como despesas ordinárias de condomínio e quaisquer outras despesas que recaírem sobre o imóvel, serão de responsabilidade do LOCATÁRIO, o qual arcará também com as despesas provenientes de sua utilização tais como ligação e consumo de luz, força, água e gás que serão pagas diretamente às empresas concessionárias dos referidos serviços, que serão devidos a partir desta data independente da troca de titularidade.

CLÁUSULA QUINTA - DA MULTA E JUROS DE MORA
5.1 Em caso de mora no pagamento do aluguel, o valor será corrigido pelo IGP-M até o dia do efetivo pagamento e acrescido da multa moratória de 10% (dez por cento) e dos juros de 1% (um por cento) ao mês e ensejará a sua cobrança através de advogado. Ficam desde já fixados os honorários advocatícios em 10% (dez por cento), se amigável a cobrança, e de 20% (vinte por cento), se judicial.

CLÁUSULA SEXTA - DA CONSERVAÇÃO, REFORMAS E BENFEITORIAS NECESSÁRIAS
6.1 Ao LOCATÁRIO a responsabilidade por zelar pela conservação, limpeza do imóvel e segurança.
6.2 As benfeitorias necessárias introduzidas pelo LOCATÁRIO, ainda que não autorizadas pelo LOCADOR, bem como as úteis, desde que autorizadas, serão indenizáveis e permitem o exercício do direito de retenção. As benfeitorias voluptuárias não serão indenizáveis, podendo ser levantadas pelo LOCATÁRIO, finda a locação, desde que sua retirada não afete a estrutura e a substância do imóvel.
6.3 O LOCATÁRIO está obrigado a devolver o imóvel em perfeitas condições de limpeza, conservação e pintura, quando finda ou rescindida esta avença, conforme constante no termo de vistoria em anexo.

CLÁUSULA SÉTIMA - DA GARANTIA
7.1 Para garantia do fiel cumprimento de todas as obrigações ora pactuadas, o LOCATÁRIO oferece como garantia: [garantia_tipo]. Em caso de caução, o valor é de [contrato_caucao_valor].

CLÁUSULA OITAVA - DO FORO
8.1 As partes elegem o foro de [contrato_objeto_cidade]/[contrato_objeto_estado] para dirimirem qualquer litígio decorrente do presente termo.

E, por assim estarem justos e contratados, mandaram extrair o presente instrumento em três (03) vias, para um só efeito, assinando-as, juntamente com as testemunhas, a tudo presentes.

[contrato_objeto_cidade], [data_assinatura].


LOCADOR: _____________________________________
[proprietario_razao_social]


LOCATÁRIO: _____________________________________
[contratante_nome]


FIADOR(ES): _____________________________________
[garantia_caucionante_nome]

_____________________________________
[garantia_outro_fiador_nome]


TESTEMUNHA 1: _____________________________
TESTEMUNHA 2: _____________________________
`;
