import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — AlugaFlow" },
      { name: "description", content: "Termos de Uso da plataforma AlugaFlow — SaaS de gestão imobiliária." },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  const [content, setContent] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("legal_pages").select("content, updated_at").eq("slug", "termos").maybeSingle();
      setContent(data?.content ?? "");
      setUpdatedAt(data?.updated_at ?? null);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/"><BrandLogo size={32} /></Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Termos de Uso</h1>
        {updatedAt && (
          <p className="mt-2 text-sm text-muted-foreground">
            Última atualização: {new Date(updatedAt).toLocaleDateString("pt-BR")}
          </p>
        )}

        {loading ? (
          <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div
            className="prose prose-sm mt-8 max-w-none space-y-6 text-sm leading-relaxed text-foreground"
            dangerouslySetInnerHTML={{ __html: content ?? "" }}
          />
        )}
      </main>
    </div>
  );
}
