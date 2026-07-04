import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listPublishedPosts } from "@/lib/posts.functions";
import { PublicFooter, PublicHeader } from "./anuncios";
import { formatDateBR, readingTime } from "@/lib/blog-utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog AlugaFlow — Notícias do mercado imobiliário" },
      { name: "description", content: "Artigos, dicas e novidades sobre o mercado imobiliário em Cáceres-MT e no Brasil." },
      { property: "og:title", content: "Blog AlugaFlow" },
      { property: "og:description", content: "Notícias do mercado imobiliário." },
      { property: "og:url", content: "/blog" },
    ],
    links: [{ rel: "canonical", href: "/blog" }],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const { data } = useQuery({
    queryKey: ["blog-posts", page],
    queryFn: () => listPublishedPosts({ data: { page, pageSize } }),
  });
  const posts = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Blog AlugaFlow</h1>
          <p className="mt-2 text-muted-foreground">Notícias e dicas sobre o mercado imobiliário.</p>
        </div>
        {posts.length === 0 ? (
          <p className="text-muted-foreground">Nenhum artigo publicado ainda.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.id} to="/blog/$slug" params={{ slug: p.slug }} className="group overflow-hidden rounded-lg border bg-card transition hover:shadow-md">
                {p.cover_image_url && (
                  <div className="aspect-[16/10] overflow-hidden bg-muted">
                    <img src={p.cover_image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                  </div>
                )}
                <div className="p-4">
                  <h2 className="line-clamp-2 font-semibold leading-tight">{p.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>
                  <p className="mt-3 text-xs text-muted-foreground">{formatDateBR(p.created_at)} • {readingTime(p.excerpt)} min de leitura</p>
                </div>
              </Link>
            ))}
          </div>
        )}
        {pages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="text-sm">Página {page} de {pages}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
