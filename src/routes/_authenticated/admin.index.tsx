import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAdminMetrics } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Megaphone, TrendingUp, UserPlus, DollarSign } from "lucide-react";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const fn = getAdminMetrics;
  const { data, isLoading } = useQuery({ queryKey: ["admin-metrics"], queryFn: () => fn() });

  const m = (data ?? {}) as Record<string, unknown>;
  const planCounts = (m.plan_counts ?? {}) as Record<string, number>;

  const cards = [
    { label: "Usuários totais", value: m.total_users ?? 0, icon: Users },
    { label: "Novos (30 dias)", value: m.new_users_30d ?? 0, icon: UserPlus },
    { label: "Imóveis anunciados", value: m.total_properties ?? 0, icon: Building2 },
    { label: "Leads recebidos", value: m.total_leads ?? 0, icon: Megaphone },
    { label: "Receita estimada/mês", value: formatBRL(Number(m.estimated_monthly_revenue ?? 0)), icon: DollarSign },
    { label: "Plano free / pago", value: `${planCounts.free ?? 0} / ${(planCounts.investidor ?? 0) + (planCounts.imobiliaria ?? 0)}`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Visão geral</h1>
        <p className="text-sm text-muted-foreground">Métricas em tempo real do AlugaFlow.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "…" : String(c.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Distribuição por plano</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {["free", "investidor", "imobiliaria"].map((p) => (
            <div key={p} className="rounded-md border p-4">
              <div className="text-xs uppercase text-muted-foreground">{p}</div>
              <div className="text-2xl font-bold">{planCounts[p] ?? 0}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
