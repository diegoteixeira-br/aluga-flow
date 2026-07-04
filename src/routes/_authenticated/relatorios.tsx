import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — AlugaFlow" }] }),
  component: ReportsPage,
});

function defaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(start), to: iso(end) };
}

type Row = {
  kind: "Receita" | "Despesa";
  date: string;
  description: string;
  amount: number;
};

function ReportsPage() {
  const init = defaultRange();
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);

  const { data, isLoading } = useQuery({
    queryKey: ["relatorios", from, to],
    queryFn: async () => {
      const [paymentsRes, expensesRes] = await Promise.all([
        supabase
          .from("payments")
          .select("paid_date, paid_amount, amount, status, contract:contracts(property:properties(nickname), tenant:tenants(full_name))")
          .gte("paid_date", from)
          .lte("paid_date", to)
          .eq("status", "pago"),
        supabase
          .from("expenses")
          .select("expense_date, amount, description, category, property:properties(nickname)")
          .gte("expense_date", from)
          .lte("expense_date", to),
      ]);
      if (paymentsRes.error) throw paymentsRes.error;
      if (expensesRes.error) throw expensesRes.error;

      const rows: Row[] = [
        ...(paymentsRes.data ?? []).map((p): Row => ({
          kind: "Receita",
          date: p.paid_date as string,
          description: `Aluguel — ${(p.contract as { property?: { nickname?: string } } | null)?.property?.nickname ?? "—"} / ${(p.contract as { tenant?: { full_name?: string } } | null)?.tenant?.full_name ?? "—"}`,
          amount: Number(p.paid_amount ?? p.amount ?? 0),
        })),
        ...(expensesRes.data ?? []).map((e): Row => ({
          kind: "Despesa",
          date: e.expense_date as string,
          description: `${e.category ?? "Despesa"}${e.description ? ` — ${e.description}` : ""}${(e.property as { nickname?: string } | null)?.nickname ? ` (${(e.property as { nickname?: string } | null)?.nickname})` : ""}`,
          amount: Number(e.amount ?? 0),
        })),
      ].sort((a, b) => a.date.localeCompare(b.date));

      const receitas = rows.filter((r) => r.kind === "Receita").reduce((s, r) => s + r.amount, 0);
      const despesas = rows.filter((r) => r.kind === "Despesa").reduce((s, r) => s + r.amount, 0);
      return { rows, receitas, despesas };
    },
  });

  const saldo = useMemo(() => (data ? data.receitas - data.despesas : 0), [data]);

  function exportCSV() {
    if (!data) return;
    const headers = ["Tipo", "Data", "Descrição", "Valor"];
    const lines = [headers.join(";")];
    for (const r of data.rows) {
      const desc = `"${(r.description ?? "").replace(/"/g, '""')}"`;
      const val = r.kind === "Despesa" ? -r.amount : r.amount;
      lines.push([r.kind, r.date, desc, val.toFixed(2).replace(".", ",")].join(";"));
    }
    lines.push("");
    lines.push(["", "", "Total receitas", data.receitas.toFixed(2).replace(".", ",")].join(";"));
    lines.push(["", "", "Total despesas", data.despesas.toFixed(2).replace(".", ",")].join(";"));
    lines.push(["", "", "Saldo", (data.receitas - data.despesas).toFixed(2).replace(".", ",")].join(";"));
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Extrato de receitas e despesas por período.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1"><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => {
              const n = new Date();
              setFrom(new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10));
              setTo(new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().slice(0, 10));
            }}>Mês atual</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => {
              const n = new Date();
              setFrom(new Date(n.getFullYear(), n.getMonth() - 1, 1).toISOString().slice(0, 10));
              setTo(new Date(n.getFullYear(), n.getMonth(), 0).toISOString().slice(0, 10));
            }}>Mês anterior</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => {
              const y = new Date().getFullYear();
              setFrom(`${y}-01-01`); setTo(`${y}-12-31`);
            }}>Ano</Button>
          </div>
          <Button onClick={exportCSV} variant="outline" className="ml-auto" disabled={!data || data.rows.length === 0}>
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Receita bruta</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">{formatBRL(data?.receitas ?? 0)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Despesas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{formatBRL(data?.despesas ?? 0)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Lucro líquido</CardTitle></CardHeader>
          <CardContent><div className={"text-2xl font-bold " + (saldo >= 0 ? "text-success" : "text-destructive")}>{formatBRL(saldo)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <p className="p-6 text-muted-foreground">Carregando...</p>
          : !data || data.rows.length === 0 ? <p className="p-6 text-center text-muted-foreground">Sem lançamentos no período.</p>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Tipo</TableHead><TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell><Badge variant={r.kind === "Receita" ? "default" : "destructive"} className={r.kind === "Receita" ? "bg-green-600 hover:bg-green-600 text-white" : ""}>{r.kind}</Badge></TableCell>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell className={"text-right font-medium " + (r.kind === "Despesa" ? "text-destructive" : "text-success")}>
                      {r.kind === "Despesa" ? "- " : ""}{formatBRL(r.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
