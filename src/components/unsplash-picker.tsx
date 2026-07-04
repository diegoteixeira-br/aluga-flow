import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Photo = {
  id: string;
  description: string;
  thumb: string;
  regular: string;
  full: string;
  downloadLocation: string;
  user: { name: string; username: string; link: string };
};

function keywordsFromTitle(t?: string | null) {
  if (!t) return "imóvel aluguel";
  const stop = new Set(["de","da","do","das","dos","a","o","as","os","e","ou","em","no","na","para","por","com","um","uma","que","ao","à","às","seu","sua","seus","suas","2024","2025","2026"]);
  const words = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(w=>w && w.length>2 && !stop.has(w));
  return (words.slice(0, 4).join(" ") || "imóvel aluguel").trim();
}

export function UnsplashPicker({ title, onSelect }: { title?: string | null; onSelect: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Photo[]>([]);
  const [picking, setPicking] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const q = keywordsFromTitle(title);
      setQuery(q);
      void runSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runSearch = async (q: string) => {
    setLoading(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("unsplash-search", {
        body: { action: "search", query: q, page: 1 },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setResults(((data as any)?.results ?? []) as Photo[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na busca");
    } finally {
      setLoading(false);
    }
  };

  const pick = async (p: Photo) => {
    setPicking(p.id);
    try {
      // Track download per Unsplash API guidelines (fire-and-forget)
      if (p.downloadLocation) {
        supabase.functions.invoke("unsplash-search", {
          body: { action: "track_download", downloadUrl: p.downloadLocation },
        }).catch(() => {});
      }
      onSelect(p.regular);
      toast.success(`Imagem de ${p.user?.name ?? "Unsplash"} selecionada`);
      setOpen(false);
    } finally {
      setPicking(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <ImageIcon className="mr-2 h-4 w-4" /> Buscar no Unsplash
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Banco de imagens grátis (Unsplash)</DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <Label>Buscar por palavras-chave</Label>
            <div className="mt-1 flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(query); } }}
                placeholder="Ex.: contrato aluguel, imóvel, chaves casa..."
              />
              <Button type="button" onClick={() => runSearch(query)} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="mr-1 h-4 w-4" />Buscar</>}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Pré-preenchido com base no título do artigo. Edite e busque novamente se quiser outros resultados.</p>
          </div>

          {loading && (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Buscando...
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="group relative overflow-hidden rounded-md border text-left transition hover:ring-2 hover:ring-primary disabled:opacity-50"
                  onClick={() => pick(p)}
                  disabled={picking !== null}
                  title={p.description || "Selecionar"}
                >
                  <img src={p.thumb} alt={p.description} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                    Foto: {p.user?.name}
                  </div>
                  {picking === p.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {!loading && results.length === 0 && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum resultado. Tente outras palavras-chave.
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Imagens fornecidas por <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="underline">Unsplash</a>, uso gratuito conforme a licença Unsplash.
          </p>
        </div>
        <DialogFooter className="border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
