import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2, Users, Wallet, AlertTriangle, TrendingUp, CalendarClock, Target, AlertCircle, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL, formatDate, todayISO } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — AlugaFlow" }] }),
  component: Dashboard,
});

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(d: Date) { return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""); }
function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const today = todayISO();
      const [properties, tenants, contracts, payments, expenses, profile] = await Promise.all([
        supabase.from("properties").select("id,status,rent_amount"),
        supabase.from("tenants").select("id"),
        supabase.from("contracts").select("id,status,rent_amount,end_date, property:properties(nickname), tenant:tenants(full_name)"),
        supabase.from("payments").select("id,amount,paid_amount,status,due_date,reference_month,paid_date,charge_sent_at,asaas_payment_id, contract:contracts(property:properties(nickname), tenant:tenants(full_name))"),
        supabase.from("expenses").select("id,amount,expense_date"),
        supabase.from("profiles").select("auto_charge_enabled, auto_charge_days_before").maybeSingle(),
      ]);
      return {
        properties: properties.data ?? [],
        tenants: tenants.data ?? [],
        contracts: (contracts.data ?? []) as Array<{ id: string; status: string; rent_amount: number; end_date: string | null; property?: { nickname?: string }; tenant?: { full_name?: string } }>,
        payments: (payments.data ?? []) as Array<{ id: string; amount: number; paid_amount: number | null; status: string; due_date: string; reference_month: string; paid_date: string | null; charge_sent_at: string | null; asaas_payment_id: string | null; contract?: { property?: { nickname: string }; tenant?: { full_name: string } } }>,
        expenses: expenses.data ?? [],
        profile: profile.data as { auto_charge_enabled?: boolean; auto_charge_days_before?: number } | null,
        today,
      };
    },
  });

  if (isLoading || !data) return <p className="text-muted-foreground">Carregando...</p>;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthStartIso = monthStart.toISOString().slice(0, 10);
  const monthEndIso = monthEnd.toISOString().slice(0, 10);

  const activeContracts = data.contracts.filter((c) => c.status === "ativo").length;
  const occupied = data.properties.filter((p) => p.status === "alugado").length;

  const receivedThisMonth = data.payments
    .filter((p) => p.paid_date && p.paid_date >= monthStartIso && p.paid_date <= monthEndIso)
    .reduce((s, p) => s + Number(p.paid_amount || 0), 0);
  const expectedThisMonth = data.payments
    .filter((p) => p.due_date >= monthStartIso && p.due_date <= monthEndIso && p.status !== "cancelado")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const pctReceived = expectedThisMonth > 0 ? Math.min(100, Math.round((receivedThisMonth / expectedThisMonth) * 100)) : 0;

  const overdue = data.payments.filter((p) => p.status !== "pago" && p.status !== "cancelado" && p.due_date < data.today);
  const overdueTotal = overdue.reduce((s, p) => s + Number(p.amount || 0), 0);

  // ====== Alertas ======
  const cutoff5 = addDaysISO(-5);
  const severelyOverdue = overdue.filter((p) => p.due_date < cutoff5);

  const in30 = addDaysISO(30);
  const expiringContracts = data.contracts.filter((c) =>
    c.status === "ativo" && c.end_date && c.end_date >= data.today && c.end_date <= in30,
  );

  const autoEnabled = Boolean(data.profile?.auto_charge_enabled);
  const daysBefore = Number(data.profile?.auto_charge_days_before ?? 3);
  const targetSendDate = addDaysISO(daysBefore);
  const pendingChargesToday = autoEnabled
    ? data.payments.filter((p) =>
        p.status === "pendente" &&
        p.due_date === targetSendDate &&
        !p.charge_sent_at &&
        !p.asaas_payment_id,
      )
    : [];

  const upcoming = data.payments
    .filter((p) => p.status !== "pago" && p.status !== "cancelado" && p.due_date >= data.today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  // Last 6 months chart
  const months: { key: string; label: string; recebido: number; despesas: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: monthLabel(d), recebido: 0, despesas: 0 });
  }
  const idx = new Map(months.map((m, i) => [m.key, i]));
  for (const p of data.payments) {
    if (!p.paid_date) continue;
    const k = p.paid_date.slice(0, 7);
    const i = idx.get(k);
    if (i != null) months[i].recebido += Number(p.paid_amount || 0);
  }
  for (const e of data.expenses) {
    const k = (e.expense_date as string).slice(0, 7);
    const i = idx.get(k);
    if (i != null) months[i].despesas += Number(e.amount || 0);
  }

  const hasAlerts = severelyOverdue.length > 0 || expiringContracts.length > 0 || pendingChargesToday.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua operação.</p>
      </div>

      {hasAlerts && (
        <div className="grid gap-3 md:grid-cols-3">
          {severelyOverdue.length > 0 && (
            <Alert color="red" icon={<AlertTriangle className="h-4 w-4" />} title={`${severelyOverdue.length} pagamento(s) vencido(s) há mais de 5 dias`}
              to="/payments">
              <ul className="mt-1 space-y-0.5">
                {severelyOverdue.slice(0, 3).map((p) => (
                  <li key={p.id} className="truncate">{p.contract?.property?.nickname ?? "Imóvel"} — venceu {formatDate(p.due_date)}</li>
                ))}
              </ul>
            </Alert>
          )}
          {expiringContracts.length > 0 && (
            <Alert color="orange" icon={<AlertCircle className="h-4 w-4" />} title={`${expiringContracts.length} contrato(s) vencendo em até 30 dias`}
              to="/contracts">
              <ul className="mt-1 space-y-0.5">
                {expiringContracts.slice(0, 3).map((c) => (
                  <li key={c.id} className="truncate">{c.property?.nickname ?? "Imóvel"} — {c.tenant?.full_name ?? "—"} ({formatDate(c.end_date!)})</li>
                ))}
              </ul>
            </Alert>
          )}
          {pendingChargesToday.length > 0 && (
            <Alert color="blue" icon={<Info className="h-4 w-4" />} title={`${pendingChargesToday.length} cobrança(s) deveriam ter sido enviadas hoje`}
              to="/payments">
              <p className="mt-1 text-xs">Automação está ativada mas estas cobranças ainda não foram disparadas.</p>
            </Alert>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Imóveis</CardTitle><Building2 className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data.properties.length}</div><p className="text-xs text-muted-foreground">{occupied} alugados</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Inquilinos</CardTitle><Users className="h-4 w-4 text-primary" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data.tenants.length}</div><p className="text-xs text-muted-foreground">{activeContracts} contratos ativos</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Recebido este mês</CardTitle><TrendingUp className="h-4 w-4 text-success" /></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{formatBRL(receivedThisMonth)}</div>
            <p className="text-xs text-muted-foreground">de {formatBRL(expectedThisMonth)} previstos</p>
            <div className="mt-2 h-2 w-full rounded bg-muted overflow-hidden">
              <div className="h-full bg-success transition-all" style={{ width: `${pctReceived}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Em atraso</CardTitle><Wallet className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatBRL(overdueTotal)}</div>
            <p className="text-xs text-muted-foreground">{overdue.length} pagamento(s)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip
                    formatter={(v: number) => formatBRL(Number(v))}
                    contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Legend />
                  <Bar dataKey="recebido" name="Recebido" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-primary" /> Próximos vencimentos</CardTitle></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento futuro.</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.contract?.property?.nickname ?? "Imóvel"}</div>
                      <div className="truncate text-xs text-muted-foreground">{p.contract?.tenant?.full_name ?? "—"} • {formatDate(p.due_date)}</div>
                    </div>
                    <Badge variant="secondary">{formatBRL(p.amount)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {overdue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-destructive" /> Em atraso ({overdue.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {overdue.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.contract?.property?.nickname ?? "Imóvel"} — vencido em {formatDate(p.due_date)}</span>
                  <Badge variant="destructive">{formatBRL(p.amount)}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Alert({ color, icon, title, to, children }: {
  color: "red" | "orange" | "blue";
  icon: React.ReactNode;
  title: string;
  to: "/payments" | "/contracts";
  children: React.ReactNode;
}) {
  const styles: Record<typeof color, string> = {
    red: "border-destructive/40 bg-destructive/10 text-destructive",
    orange: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    blue: "border-primary/40 bg-primary/10 text-primary",
  };
  return (
    <Link to={to} className={`block rounded-md border p-3 text-sm transition-opacity hover:opacity-90 ${styles[color]}`}>
      <div className="flex items-center gap-2 font-medium">{icon}{title}</div>
      <div className="text-xs opacity-90">{children}</div>
    </Link>
  );
}
