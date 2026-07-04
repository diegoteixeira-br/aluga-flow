import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { getPostBySlug } from "@/lib/posts.functions";
import { PublicFooter, PublicHeader } from "./anuncios";
import { formatDateBR, readingTime, renderContent } from "@/lib/blog-utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Share2, Link as LinkIcon } from "lucide-react";

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }) => {
    const res = await getPostBySlug({ data: { slug: params.slug } });
    if (!res.post) throw notFound();
    return res;
  },
  head: ({ params, loaderData }) => {
    const post = loaderData?.post;
    if (!post) return { meta: [{ title: "Artigo não encontrado" }] };
    return {
      meta: [
        { title: `${post.title} — Blog AlugaFlow` },
        { name: "description", content: post.excerpt },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.excerpt },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `/blog/${params.slug}` },
        ...(post.cover_image_url ? [{ property: "og:image", content: post.cover_image_url }] : []),
      ],
      links: [{ rel: "canonical", href: `/blog/${params.slug}` }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.excerpt,
          image: post.cover_image_url ? [post.cover_image_url] : undefined,
          datePublished: post.created_at,
          dateModified: post.updated_at,
          author: { "@type": "Person", name: post.author_name },
          publisher: { "@type": "Organization", name: "AlugaFlow" },
        }),
      }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Artigo não encontrado</h1>
        <Link to="/blog" className="mt-4 inline-block text-primary underline">Voltar ao blog</Link>
      </div>
      <PublicFooter />
    </div>
  ),
  errorComponent: () => (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Erro ao carregar o artigo</h1>
      </div>
      <PublicFooter />
    </div>
  ),
  component: PostPage,
});

function PostPage() {
  const { post, related } = Route.useLoaderData();

  const share = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `${post.title} — ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
  const copy = async () => {
    if (typeof window === "undefined") return;
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copiado!");
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <article className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/blog" className="text-sm text-muted-foreground hover:underline">← Voltar ao blog</Link>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-4xl">{post.title}</h1>
        <div className="mt-2 text-sm text-muted-foreground">
          Por {post.author_name} • {formatDateBR(post.created_at)} • {readingTime(post.content)} min de leitura
        </div>
        {post.cover_image_url && (
          <img src={post.cover_image_url} alt={post.title} className="mt-6 aspect-[16/9] w-full rounded-lg object-cover" />
        )}
        <div className="prose prose-neutral mt-6 max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: renderContent(post.content) }} />

        <div className="mt-8 flex flex-wrap gap-2 border-t pt-6">
          <Button variant="outline" size="sm" onClick={share}><Share2 className="mr-2 h-4 w-4" /> WhatsApp</Button>
          <Button variant="outline" size="sm" onClick={copy}><LinkIcon className="mr-2 h-4 w-4" /> Copiar link</Button>
        </div>

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold">Artigos relacionados</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {related.map((r: { id: string; slug: string; title: string; cover_image_url: string | null; created_at: string }) => (
                <Link key={r.id} to="/blog/$slug" params={{ slug: r.slug }} className="group overflow-hidden rounded-lg border bg-card">
                  {r.cover_image_url && <div className="aspect-[16/10] overflow-hidden bg-muted"><img src={r.cover_image_url} alt={r.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" /></div>}
                  <div className="p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold">{r.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateBR(r.created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
      <PublicFooter />
    </div>
  );
}
