import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Menu, Mail } from "lucide-react";

export const Route = createFileRoute("/anuncios")({
  head: () => ({
    meta: [
      { title: "Imóveis para alugar — AlugaFlow" },
      { name: "description", content: "Encontre casas, apartamentos e imóveis comerciais para alugar diretamente com o proprietário." },
      { property: "og:title", content: "Imóveis para alugar — AlugaFlow" },
      { property: "og:description", content: "Portal de anúncios diretamente com proprietários." },
    ],
  }),
  component: () => <Outlet />,
});

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3">
        <Link to="/" className="shrink-0"><BrandLogo size={32} /></Link>

        {/* Desktop nav */}
        <nav className="hidden items-center justify-end gap-2 md:flex">
          <Button asChild variant="ghost" size="sm"><Link to="/blog">Blog</Link></Button>
          <Button asChild variant="ghost" size="sm"><Link to="/sobre">Sobre</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/para-proprietarios">Anunciar meu imóvel</Link></Button>
        </nav>
        <span className="md:hidden" />

        {/* Right cluster: Entrar always visible + hamburger on mobile */}
        <div className="flex items-center justify-end gap-2">
          <Button asChild size="sm"><Link to="/auth">Entrar</Link></Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col gap-1">
                <SheetClose asChild><Link to="/blog" className="rounded-md px-3 py-2 text-sm hover:bg-muted">Blog</Link></SheetClose>
                <SheetClose asChild><Link to="/sobre" className="rounded-md px-3 py-2 text-sm hover:bg-muted">Sobre</Link></SheetClose>
                <SheetClose asChild><Link to="/para-proprietarios" className="rounded-md px-3 py-2 text-sm hover:bg-muted">Anunciar meu imóvel</Link></SheetClose>
                <SheetClose asChild><Link to="/auth" className="mt-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Entrar</Link></SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <BrandLogo size={28} />
          <p className="mt-2 text-xs text-muted-foreground">Direto entre proprietários e inquilinos.</p>
          <div className="mt-4 space-y-0.5 text-[11px] leading-relaxed text-muted-foreground/70">
            <p>CNPJ: 63.266.334/0001-21</p>
            <p>Rua das Seriemas, 345 - Bairro: Villa Mariana</p>
            <p>Cáceres-MT | CEP: 78.210-414</p>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold">Navegar</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li><Link to="/blog">Blog</Link></li>
            <li><Link to="/sobre">Sobre</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Para proprietários</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li><Link to="/para-proprietarios">Anunciar meu imóvel</Link></li>
            <li><Link to="/auth">Já sou cliente → Entrar</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Contato</p>
          <a
            href="mailto:contato@alugaflow.com.br"
            className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" /> contato@alugaflow.com.br
          </a>
        </div>

      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>© 2026 AlugaFlow. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacidade" className="hover:text-foreground">Política de Privacidade</Link>
            <Link to="/termos" className="hover:text-foreground">Termos de Uso</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}