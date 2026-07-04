import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/format";
import { toast } from "sonner";
import { Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/planos")({
  component: AdminPlans,
});

type Plan = {
  id: string; name: string; price: number; promo_price: number | null; promo_until: string | null;
  active: boolean; benefits: string[]; sort_order: number;
  max_properties: number | null; max_listings: number | null;
  asaas_enabled: boolean; advanced_reports: boolean; max_users: number;
};

function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("plans").select("*").order("sort_order");
    setPlans((data ?? []).map((p) => ({ ...p, benefits: Array.isArray(p.benefits) ? p.benefits : [] })) as Plan[]);
  };
  useEffect(() => { load(); }, []);

  const update = (id: string, patch: Partial<Plan>) => setPlans((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const save = async (p: Plan) => {
    setSavingId(p.id);
    try {
      const { error } = await supabase.from("plans").update({
        name: p.name, price: p.price, promo_price: p.promo_price, promo_until: p.promo_until,
        active: p.active, benefits: p.benefits,
        max_properties: p.max_properties, max_listings: p.max_listings,
        asaas_enabled: p.asaas_enabled, advanced_reports: p.advanced_reports, max_users: p.max_users,
      }).eq("id", p.id);
      if (error) { toast.error(error.message); return; }

      // Sincroniza com Stripe automaticamente (cria/atualiza Product e Price)
      if (Number(p.price) > 0) {
        const { data: sync, error: syncErr } = await supabase.functions.invoke("sync-plan-stripe", {
          body: { planId: p.id },
        });
        if (syncErr || (sync && (sync as { error?: string }).error)) {
          const msg = (sync as { error?: string })?.error || syncErr?.message || "Erro ao sincronizar com Stripe";
          toast.error(`Salvo, mas falhou ao sincronizar Stripe: ${msg}`);
        } else {
          toast.success(`Plano "${p.name}" salvo e sincronizado com Stripe`);
        }
      } else {
        toast.success(`Plano "${p.name}" salvo`);
      }
      await load();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Planos e preços</h1>
        <p className="text-sm text-muted-foreground">Edite valores, promoções e benefícios.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{p.name}</CardTitle>
              <div className="flex items-center gap-2"><Switch checked={p.active} onCheckedChange={(v) => update(p.id, { active: v })} /><Label>Ativo</Label></div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={p.name} onChange={(e) => update(p.id, { name: e.target.value })} /></div>
                <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={p.price} onChange={(e) => update(p.id, { price: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Preço promocional</Label><Input type="number" step="0.01" value={p.promo_price ?? ""} onChange={(e) => update(p.id, { promo_price: e.target.value ? Number(e.target.value) : null })} /></div>
                <div><Label>Promoção válida até</Label><Input type="date" value={p.promo_until ?? ""} onChange={(e) => update(p.id, { promo_until: e.target.value || null })} /></div>
              </div>
              <div>
                <Label>Benefícios (um por linha)</Label>
                <Textarea rows={4} value={p.benefits.join("\n")} onChange={(e) => update(p.id, { benefits: e.target.value.split("\n").filter(Boolean) })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Máx. imóveis (vazio = ilimitado)</Label><Input type="number" value={p.max_properties ?? ""} onChange={(e) => update(p.id, { max_properties: e.target.value ? Number(e.target.value) : null })} /></div>
                <div><Label>Máx. anúncios (vazio = ilimitado)</Label><Input type="number" value={p.max_listings ?? ""} onChange={(e) => update(p.id, { max_listings: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-end gap-2"><Switch checked={p.asaas_enabled} onCheckedChange={(v) => update(p.id, { asaas_enabled: v })} /><Label>ASAAS</Label></div>
                <div className="flex items-end gap-2"><Switch checked={p.advanced_reports} onCheckedChange={(v) => update(p.id, { advanced_reports: v })} /><Label>Relatórios</Label></div>
                <div><Label>Máx. usuários</Label><Input type="number" value={p.max_users} onChange={(e) => update(p.id, { max_users: Number(e.target.value) || 1 })} /></div>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                ✓ Sincronização automática com Stripe ativada — Produto e preço são criados/atualizados ao salvar.
              </div>
              <div className="rounded-md border bg-muted/30 p-4">
                <div className="text-xs text-muted-foreground">Prévia na landing page</div>
                <div className="mt-2 text-lg font-bold">{p.name}</div>
                <div className="mt-1">
                  {p.promo_price ? (
                    <>
                      <span className="text-2xl font-bold text-primary">{formatBRL(p.promo_price)}</span>
                      <span className="ml-2 text-sm text-muted-foreground line-through">{formatBRL(p.price)}</span>
                      <Badge className="ml-2">Promoção</Badge>
                    </>
                  ) : (
                    <span className="text-2xl font-bold">{formatBRL(p.price)}<span className="text-sm font-normal text-muted-foreground">/mês</span></span>
                  )}
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {p.benefits.filter((b) => !/m[uú]ltiplos\s+acessos/i.test(b)).map((b, i) => <li key={i} className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" />{b}</li>)}
                  {p.max_users > 1 && (
                    <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-600" />{`Múltiplos acessos (+${p.max_users - 1} usuário${p.max_users - 1 > 1 ? "s" : ""})`}</li>
                  )}
                </ul>
              </div>
              <Button onClick={() => save(p)} disabled={savingId === p.id} className="w-full">
                {savingId === p.id ? "Salvando e sincronizando Stripe..." : "Salvar alterações"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
