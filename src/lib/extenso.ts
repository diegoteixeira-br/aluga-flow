// Conversão de número para extenso em reais (BRL) — implementação simples e suficiente.
const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const d = Math.floor(r / 10);
  const u = r % 10;
  const parts: string[] = [];
  if (c) parts.push(centenas[c]);
  if (r < 20 && r > 9) parts.push(especiais[r - 10]);
  else {
    if (d) parts.push(dezenas[d]);
    if (u) parts.push(unidades[u]);
  }
  return parts.filter(Boolean).join(d > 1 && u ? " e " : " e ").replace(/ e  e /g, " e ");
}

function inteiroExtenso(n: number): string {
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const parts: string[] = [];
  if (milhoes) parts.push(`${milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`}`);
  if (milhares) parts.push(`${milhares === 1 ? "mil" : `${ate999(milhares)} mil`}`);
  if (resto) parts.push(ate999(resto));
  return parts.join(" e ");
}

export function valorPorExtenso(valor: number): string {
  if (!isFinite(valor)) return "—";
  const v = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(v / 100);
  const centavos = v % 100;
  const partes: string[] = [];
  if (reais > 0) partes.push(`${inteiroExtenso(reais)} ${reais === 1 ? "real" : "reais"}`);
  if (centavos > 0) partes.push(`${inteiroExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  if (partes.length === 0) return "zero reais";
  return partes.join(" e ");
}
