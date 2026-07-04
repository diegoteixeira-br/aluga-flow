import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PublicHeader, PublicFooter } from "./anuncios";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre nós — AlugaFlow" },
      { name: "description", content: "Conheça o AlugaFlow, a plataforma de aluguel direto entre proprietários e inquilinos." },
      { property: "og:title", content: "Sobre nós — AlugaFlow" },
      { property: "og:description", content: "Conheça o AlugaFlow." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />


      <section className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Sobre nós</h1>
        <div className="prose prose-slate mt-6 max-w-none text-muted-foreground">
          <p>
            O <strong>AlugaFlow</strong> nasceu para simplificar a vida de proprietários independentes e
            inquilinos no Brasil. Acreditamos que alugar um imóvel deve ser uma experiência direta,
            transparente e sem burocracia.
          </p>
          <p>
            Nossa plataforma reúne em um só lugar o portal de anúncios e as ferramentas de gestão:
            cadastro de imóveis e inquilinos, contratos com assinatura eletrônica, cobranças automáticas,
            controle de despesas e relatórios.
          </p>
          <p>
            Construímos o AlugaFlow para quem quer cuidar dos próprios aluguéis com profissionalismo,
            sem depender de intermediários nem pagar taxas abusivas.
          </p>
        </div>
        <div className="mt-8 flex gap-3">
          <Button asChild><Link to="/para-proprietarios">Conhecer a ferramenta</Link></Button>
        </div>

      </section>
      <PublicFooter />
    </div>
  );
}

