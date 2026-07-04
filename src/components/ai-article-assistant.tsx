import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/blog-utils";

type Suggestion = { title: string; angle?: string };
export type GeneratedArticle = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
};

export function AiArticleAssistant({ onArticleReady }: { onArticleReady: (a: GeneratedArticle) => void }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [loadingSug, setLoadingSug] = useState(false);
  const [generatingIdx, setGeneratingIdx] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const suggest = async () => {
    setLoadingSug(true);
    setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-article", {
        body: { action: "suggest_titles", topic, count: 6 },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setSuggestions(((data as any)?.titles ?? []) as Suggestion[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sugerir títulos");
    } finally {
      setLoadingSug(false);
    }
  };

  const generate = async (s: Suggestion, idx: number) => {
    setGeneratingIdx(idx);
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-article", {
        body: { action: "generate_article", title: s.title, angle: s.angle ?? "" },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const a = data as GeneratedArticle;
      const finalTitle = (a.title && a.title.trim().length >= 20) ? a.title.trim() : s.title;
      onArticleReady({
        title: finalTitle,
        slug: a.slug && /^[a-z0-9-]{3,}$/.test(a.slug) ? a.slug : slugify(finalTitle),
        excerpt: a.excerpt,
        content: a.content,
      });
      toast.success("Artigo gerado! Revise antes de publicar.");
      setOpen(false);
      setSuggestions([]);
      setTopic("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar artigo");
    } finally {
      setGeneratingIdx(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="mr-2 h-4 w-4" /> Sugestões de IA
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Assistente de artigos com IA</DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <Label>Tema ou foco (opcional)</Label>
            <div className="mt-1 flex gap-2">
              <Input
                placeholder="Ex.: Lei do Inquilinato, IGP-M, financiamento, garantias..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); suggest(); } }}
              />
              <Button type="button" onClick={suggest} disabled={loadingSug}>
                {loadingSug ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sugerir</>}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Deixe em branco para receber temas variados sobre o mercado imobiliário.</p>
          </div>

          {loadingSug && (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Gerando sugestões...
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Escolha um título para gerar o artigo completo:</p>
              <ul className="space-y-2">
                {suggestions.map((s, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="min-w-0">
                      <div className="font-medium leading-snug">{s.title}</div>
                      {s.angle && <div className="mt-0.5 text-xs text-muted-foreground">{s.angle}</div>}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => generate(s, i)}
                      disabled={generatingIdx !== null}
                    >
                      {generatingIdx === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Wand2 className="mr-1 h-4 w-4" /> Gerar</>}
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">A geração leva alguns segundos. O artigo abrirá no editor como rascunho para você revisar e aprovar antes de publicar.</p>
            </div>
          )}

          {!loadingSug && suggestions.length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Clique em <b>Sugerir</b> para receber ideias de artigos.
            </div>
          )}
        </div>
        <DialogFooter className="border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
