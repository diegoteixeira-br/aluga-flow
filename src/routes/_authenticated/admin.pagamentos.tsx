import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CreditCard, ShieldCheck, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/pagamentos")({
  component: AdminPayments,
});

function AdminPayments() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pagamentos / Stripe</h1>
        <p className="text-sm text-muted-foreground">Integração de checkout e assinaturas.</p>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Integração segura recomendada</AlertTitle>
        <AlertDescription>
          O AlugaFlow usa o Stripe nativo do Lovable: o checkout, webhooks e atualização automática de plano são gerenciados sem expor chaves no frontend. Todas as chaves ficam em <strong>Supabase Secrets</strong> e nunca no código.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Como funciona</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>1. Usuário clica em "Assinar Investidor" na landing page.</p>
          <p>2. O servidor cria uma sessão de checkout no Stripe (Secret Key fica no backend).</p>
          <p>3. Após pagamento aprovado, o webhook do Stripe atualiza automaticamente o plano do usuário.</p>
          <p>4. O cancelamento também é processado via webhook.</p>
          <p className="rounded-md border bg-muted/30 p-3 text-xs">
            <strong>Para ativar:</strong> habilite o Stripe nativo do Lovable (sem precisar pedir chaves) ou cadastre suas próprias chaves em <code>Configurações → Secrets</code> com os nomes <code>STRIPE_SECRET_KEY</code> e <code>STRIPE_WEBHOOK_SECRET</code>.
          </p>
          <Button asChild variant="outline" size="sm">
            <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">
              Dashboard do Stripe <ExternalLink className="ml-2 h-3 w-3" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
