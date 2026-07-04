import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Check, Sparkles, Crown, ArrowUp, ArrowDown, Building2, Calendar } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { getMySubscription, createCheckoutSession, scheduleDowngrade } from "@/lib/subscriptions.functions";
import { CancelSubscriptionDialog } from "@/components/cancel-subscription-dialog";
import { useMyPlan } from "@/components/plan-limit-guard";
import { ShieldAlert } from "lucide-react";

type Search = { upgrade?: "success" | "cancel" };

export const Route = createFileRoute("/_authenticated/minha-conta/plano")({
  head: () => ({ meta: [{ title: "Meu plano — AlugaFlow" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({
    upgrade: s.upgrade === "success" || s.upgrade === "cancel" ? s.upgrade : undefined,
  }),
  component: PlanPage,
});

const RANK: Record<string, number> = { free: 0, investidor: 1, imobiliaria: 2 };

const PLAN_BADGE: Record<string, { label: string; cls: string; icon: typeof Sparkles }> = {
  free: { label: "Gratuito", cls: "bg-slate-200 text-slate-700 hover:bg-slate-200", icon: Building2 },
  investidor: { label: "Investidor", cls: "bg-primary text-primary-foreground hover:bg-primary", icon: Sparkles },
  imobiliaria: { label: "Imobiliária", cls: "bg-amber-500 text-white hover:bg-amber-500", icon: Crown },
};

function PlanPage() {
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/minha-conta/plano" });
  const { data: planInfo, isLoading: planLoading } = useMyPlan();
  const getSub = getMySubscription;
  const checkout = createCheckoutSession;
  const downgrade = scheduleDowngrade;

  const [successOpen, setSuccessOpen] = useState(false);
  const [downgradePlan, setDowngradePlan] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    if (search.upgrade === "success") {
      setSuccessOpen(true);
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
      qc.invalidateQueries({ queryKey: ["my-plan"] });
    }
  }, [search.upgrade, qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => getSub({}),
    staleTime: 10_000,
  });

  const upgradeMut = useMutation({
    mutationFn: async (planId: "investidor" | "imobiliaria") => {
      const res = await checkout({ data: { planId, origin: window.location.origin } });
      window.location.href = res.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downgradeMut = useMutation({
    mutationFn: async (planId: "free" | "investidor") => downgrade({ data: { newPlan: planId } }),
    onSuccess: () => {
      toast.success("Downgrade agendado. Você manterá os recursos atuais até o fim do período.");
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
      setDowngradePlan(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <div className="text-muted-foreground">Carregando seu plano…</div>;
  }

  const currentPlan = data.plan;
  const badge = PLAN_BADGE[currentPlan] ?? PLAN_BADGE.free;
  const sub = data.subscription;
  const currentPlanData = data.plans.find((p) => p.id === currentPlan);
  const limits = {
    properties: currentPlanData?.max_properties as number | null,
    listings: currentPlanData?.max_listings as number | null,
  };

  if (planInfo?.role === "member") {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-amber-600" /> Acesso restrito</CardTitle>
            <CardDescription>O gerenciamento de plano está disponível apenas para o dono da conta.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Você está acessando como membro de equipe. Para alterar o plano, entre em contato com o administrador da conta.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (planLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu plano</h1>
        <p className="text-sm text-muted-foreground">Gerencie sua assinatura, faça upgrade ou downgrade.</p>
      </div>

      {/* Current plan summary */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <badge.icon className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Plano atual</CardTitle>
                <CardDescription>Detalhes da sua assinatura</CardDescription>
              </div>
            </div>
            <Badge className={badge.cls + " text-sm px-3 py-1"}>{badge.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Início: {formatDate(sub?.created_at ?? null)}</span>
            </div>
            {sub?.current_period_end && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {sub.cancel_at_period_end
                    ? `Acesso pago até: ${formatDate(sub.current_period_end)}`
                    : `Próxima cobrança: ${formatDate(sub.current_period_end)}`}
                </span>
              </div>
            )}
            {sub?.status === "scheduled_downgrade" && sub.scheduled_plan && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-800 text-xs">
                Downgrade agendado para <strong>{PLAN_BADGE[sub.scheduled_plan]?.label ?? sub.scheduled_plan}</strong> ao fim do período.
              </p>
            )}
            {sub?.status === "past_due" && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-xs">
                Pagamento em atraso. Atualize seu método de pagamento.
              </p>
            )}
          </div>
          <div className="space-y-3">
            <UsageBar label="Imóveis cadastrados" current={data.usage.properties} max={limits.properties} />
            <UsageBar label="Anúncios ativos" current={data.usage.listings} max={limits.listings} />
          </div>
        </CardContent>
      </Card>

      {/* Plans grid */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Compare os planos</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {data.plans.map((p) => {
            const isCurrent = p.id === currentPlan;
            const isUpgrade = RANK[p.id] > RANK[currentPlan];
            const isDowngrade = RANK[p.id] < RANK[currentPlan];
            const benefits = Array.isArray(p.benefits) ? (p.benefits as string[]) : [];
            const promoActive = p.promo_price && p.promo_until && new Date(p.promo_until) > new Date();
            const price = promoActive ? p.promo_price : p.price;
            return (
              <Card key={p.id} className={isCurrent ? "border-primary shadow-md" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.name}</CardTitle>
                    {isCurrent && <Badge className="bg-primary">Seu plano atual</Badge>}
                  </div>
                  <div className="mt-2">
                    {Number(p.price) === 0 ? (
                      <span className="text-3xl font-bold">Grátis</span>
                    ) : (
                      <div>
                        <span className="text-3xl font-bold">{formatBRL(price)}</span>
                        <span className="text-sm text-muted-foreground">/mês</span>
                        {promoActive && (
                          <span className="ml-2 text-sm text-muted-foreground line-through">{formatBRL(p.price)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-1.5 text-sm">
                    {benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <Button disabled variant="outline" className="w-full">Plano atual</Button>
                  ) : isUpgrade ? (
                    <Button
                      className="w-full"
                      onClick={() => upgradeMut.mutate(p.id as "investidor" | "imobiliaria")}
                      disabled={upgradeMut.isPending}
                    >
                      <ArrowUp className="h-4 w-4" />
                      {upgradeMut.isPending ? "Redirecionando…" : "Fazer upgrade"}
                    </Button>
                  ) : isDowngrade ? (
                    <Button variant="outline" className="w-full" onClick={() => setDowngradePlan(p.id)}>
                      <ArrowDown className="h-4 w-4" />
                      Fazer downgrade
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cancel section */}
      {currentPlan !== "free" && sub?.status !== "scheduled_downgrade" && (
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-base">Cancelar assinatura</CardTitle>
            <CardDescription>
              Você manterá acesso aos recursos pagos até o fim do período atual.
              Após isso, sua conta volta para o plano Gratuito automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setCancelOpen(true)}>
              Cancelar minha assinatura
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Upgrade realizado com sucesso!
            </DialogTitle>
            <DialogDescription>
              Seus novos recursos já estão disponíveis. Aproveite!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setSuccessOpen(false)}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!downgradePlan} onOpenChange={(o) => !o && setDowngradePlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar downgrade</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Você perderá acesso a recursos do plano <strong>{badge.label}</strong>.
              Seu plano muda ao final do período pago atual e você continua usando os recursos atuais até lá.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => downgradePlan && downgradeMut.mutate(downgradePlan as "free" | "investidor")}
            >
              Confirmar downgrade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CancelSubscriptionDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        periodEnd={sub?.current_period_end ?? null}
      />
    </div>
  );
}

function UsageBar({ label, current, max }: { label: string; current: number; max: number | null }) {
  const unlimited = max === null || max === undefined;
  const pct = unlimited ? 0 : Math.min(100, Math.round((current / Math.max(max, 1)) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {current} {unlimited ? "(ilimitado)" : `de ${max}`}
        </span>
      </div>
      {!unlimited && <Progress value={pct} className="h-2" />}
    </div>
  );
}
