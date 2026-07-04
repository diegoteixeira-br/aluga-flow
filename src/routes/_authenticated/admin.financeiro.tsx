import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  component: AdminFinance,
});

type Entry = { id: string; description: string; kind: "receita" | "despesa"; amount: number; category: string | null; entry_date: string };

function AdminFinance() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Entry>>({ kind: "receita", entry_date: todayISO() });

  const load = async () => {
    const { data } = await supabase.from("admin_finance_entries").select("*").order("entry_date", { ascending: false });
    setRows((data ?? []) as Entry[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.description || !form.amount) return toast.error("Preencha descrição e valor");
    const { error } = await supabase.from("admin_finance_entries").insert({
      description: form.description, kind: form.kind!, amount: Number(form.amount),
      category: form.category ?? null, entry_date: form.entry_date ?? todayISO(),
    });
    if (error) return toast.error(error.message);
    toast.success("Lançamento criado");
    setOpen(false); setForm({ kind: "receita", entry_date: todayISO() }); load();
  };

  const month = new Date().toISOString().slice(0, 7);
  const monthRows = rows.filter((r) => r.entry_date.startsWith(month));
  const monthRevenue = monthRows.filter((r) => r.kind === "receita").reduce((s, r) => s + Number(r.amount), 0);
  const monthCost = monthRows.filter((r) => r.kind === "despesa").reduce((s, r) => s + Number(r.amount), 0);

  const chartData = useMemo(() => {
    const map = new Map<string, { month: string; receita: number; despesa: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      map.set(key, { month: d.toLocaleDateString("pt-BR", { month: "short" }), receita: 0, despesa: 0 });
    }
    rows.forEach((r) => {
      const key = r.entry_date.slice(0, 7);
      const e = map.get(key);
      if (e) e[r.kind] += Number(r.amount);
    });
    return Array.from(map.values());
  }, [rows]);

  const exportCSV = () => {
    const csv = ["data;tipo;descricao;categoria;valor",
      ...rows.map((r) => `${r.entry_date};${r.kind};"${r.description}";${r.category ?? ""};${r.amount}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "financeiro.csv"; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Controle de receitas e despesas internas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}><Download className="mr-2 h-4 w-4" /> Exportar CSV</Button>
          <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Novo lançamento</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Receita do mês</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{formatBRL(monthRevenue)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Despesas do mês</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{formatBRL(monthCost)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Lucro líquido</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatBRL(monthRevenue - monthCost)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Últimos 6 meses</CardTitle></CardHeader>
        <CardContent style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v: number) => formatBRL(v)} /><Legend />
              <Bar dataKey="receita" fill="#10b981" /><Bar dataKey="despesa" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lançamentos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem lançamentos.</TableCell></TableRow> :
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.entry_date)}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell className="text-muted-foreground">{r.category ?? "—"}</TableCell>
                    <TableCell><Badge variant={r.kind === "receita" ? "default" : "destructive"}>{r.kind}</Badge></TableCell>
                    <TableCell className="text-right">{formatBRL(Number(r.amount))}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Descrição</Label><Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tipo</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as "receita" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label><Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
