import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Building2, Users, FileText, Wallet, Check, Camera, BarChart3, ShieldCheck, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/para-proprietarios")({
  head: () => ({
    meta: [
      { title: "Para proprietários — AlugaFlow" },
      { name: "description", content: "Gestão completa de aluguéis: imóveis, inquilinos, contratos e cobrança automática. Conheça a ferramenta e os planos." },
      { property: "og:title", content: "Para proprietários — AlugaFlow" },
      { property: "og:description", content: "Gestão completa de aluguéis em um só lugar." },
    ],
  }),
  component: Page,
});

const FEATURES = [
  { icon: Building2, title: "Imóveis", desc: "Cadastre e organize sua carteira com fotos e detalhes." },
  { icon: Users, title: "Inquilinos", desc: "Dados completos, documentos e fiador." },
  { icon: FileText, title: "Contratos", desc: "Modelos prontos e assinatura digital." },
  { icon: Wallet, title: "Pagamentos", desc: "Cobrança automática via ASAAS e PIX." },
  { icon: Camera, title: "Vistorias", desc: "Vistoria por cômodo com geração de PDF." },
  { icon: BarChart3, title: "Relatórios", desc: "Receitas, despesas e exportação CSV." },
  { icon: ShieldCheck, title: "Portal de anúncios", desc: "Divulgue seus imóveis e receba leads." },
  { icon: FileText, title: "Documentos prontos", desc: "Distrato, confissão de dívida e mais." },
];

type DbPlan = { id: string; name: string; price: number; promo_price: number | null; promo_until: string | null; active: boolean; benefits: unknown; sort_order: number; max_users?: number | null };

function isPromoActive(p: DbPlan) {
  if (p.promo_price == null) return false;
  if (!p.promo_until) return true;
  return new Date(p.promo_until) >= new Date();
}

function Page() {
  const { user } = useAuth();
  const { data: plans = [] } = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").eq("active", true).order("sort_order");
      if (error) throw error;
      return (data ?? []) as DbPlan[];
    },
    staleTime: 30_000,
  });
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3">
          <Link to="/" className="shrink-0"><BrandLogo size={32} /></Link>
          <nav className="hidden items-center justify-end gap-2 md:flex">
            <Button asChild variant="ghost" size="sm"><Link to="/">Imóveis</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/sobre">Sobre</Link></Button>
          </nav>
          <span className="md:hidden" />
          <div className="flex items-center justify-end gap-2">
            <Button asChild size="sm"><Link to={user ? "/dashboard" : "/auth"}>{user ? "Painel" : "Entrar"}</Link></Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
                <nav className="mt-4 flex flex-col gap-1">
                  <SheetClose asChild><Link to="/" className="rounded-md px-3 py-2 text-sm hover:bg-muted">Imóveis</Link></SheetClose>
                  <SheetClose asChild><Link to="/blog" className="rounded-md px-3 py-2 text-sm hover:bg-muted">Blog</Link></SheetClose>
                  <SheetClose asChild><Link to="/sobre" className="rounded-md px-3 py-2 text-sm hover:bg-muted">Sobre</Link></SheetClose>
                  <SheetClose asChild><Link to="/para-proprietarios" className="rounded-md px-3 py-2 text-sm hover:bg-muted">Para proprietários</Link></SheetClose>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-background py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Para proprietários</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-5xl">Gestão completa dos seus aluguéis</h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground md:text-lg">
            Anuncie grátis e ainda controle imóveis, contratos, pagamentos e despesas em um só lugar — sem planilhas, sem dor de cabeça.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Começar grátis</Link></Button>
            <Button asChild size="lg" variant="outline"><a href="#planos">Ver planos</a></Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Tudo o que você precisa</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Da captação do inquilino à cobrança do aluguel.</p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plans */}
      <section id="planos" className="bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Planos e preços</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Escolha o plano certo para o seu momento.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {plans.map((p, idx) => {
              const highlight = idx === 1;
              const promo = isPromoActive(p);
              const effective = promo ? (p.promo_price as number) : p.price;
              const baseBenefits = (Array.isArray(p.benefits) ? (p.benefits as string[]) : [])
                .filter((b) => !/m[uú]ltiplos\s+acessos/i.test(b));
              const extraUsers = (p.max_users ?? 1) - 1;
              const benefits = extraUsers > 0
                ? [...baseBenefits, `Múltiplos acessos (+${extraUsers} usuário${extraUsers > 1 ? "s" : ""})`]
                : baseBenefits;
              const isFree = Number(p.price) === 0;
              const cta = isFree ? "Começar grátis" : `Assinar ${p.name}`;
              return (
                <div key={p.id} className={`rounded-lg border bg-card p-6 ${highlight ? "border-primary shadow-lg ring-1 ring-primary" : ""}`}>
                  {highlight && <div className="mb-3 inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Mais popular</div>}
                  <h3 className="text-xl font-semibold">{p.name}</h3>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{isFree ? "R$ 0" : formatBRL(effective)}</span>
                    <span className="text-sm text-muted-foreground">{isFree ? "para sempre" : "/mês"}</span>
                    {promo && <span className="text-sm text-muted-foreground line-through">{formatBRL(p.price)}</span>}
                  </div>
                  <ul className="mt-6 space-y-2 text-sm">
                    {benefits.map((f) => (
                      <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" />{f}</li>
                    ))}
                  </ul>
                  <Button asChild className="mt-6 w-full" variant={highlight ? "default" : "outline"}>
                    <Link to="/auth" search={{ mode: "signup" }}>{cta}</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Pronto para simplificar sua gestão?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Crie sua conta gratuita em menos de 1 minuto.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Criar conta grátis</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/">Ver imóveis</Link></Button>
        </div>
      </section>

      <footer className="border-t bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2"><BrandLogo size={20} /> © 2025 AlugaFlow</div>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground">Imóveis</Link>
            <Link to="/sobre" className="hover:text-foreground">Sobre</Link>
            
          </div>
        </div>
      </footer>
    </div>
  );
}
