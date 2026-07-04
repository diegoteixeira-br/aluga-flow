export const formatBRL = (value: number | string | null | undefined) => {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
};

export const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value + (value.length === 10 ? "T00:00:00" : "")) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
};

export const todayISO = () => new Date().toISOString().slice(0, 10);
