import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/blog-utils";

type Suggestion = { title: string; angle?: string };

export function AiTitleSuggester({ onPick }: { onPick: (title: string, slug: string) => void }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);

  const suggest = async (topicOverride?: string) => {
    setLoading(true);
    setItems([]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-article", {
        body: { action: "suggest_titles", topic: topicOverride ?? topic, count: 6 },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      setItems(((data as any)?.titles ?? []) as Suggestion[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sugerir títulos");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (o && items.length === 0 && !loading) {
      suggest("");
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Sparkles className="mr-2 h-4 w-4" /> Sugerir título com IA
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="end">
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Refinar por tema (opcional)</Label>
            <div className="mt-1 flex gap-2">
              <Input
                placeholder="Ex.: Lei do Inquilinato, IGP-M..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); suggest(); } }}
              />
              <Button type="button" size="sm" onClick={() => suggest()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
              </Button>
            </div>
          </div>
          {loading && (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando sugestões atuais...
            </div>
          )}
          {items.length > 0 && (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {items.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="w-full rounded-md border p-2 text-left text-sm hover:bg-accent"
                    onClick={() => { onPick(s.title, slugify(s.title)); setOpen(false); setItems([]); }}
                  >
                    <div className="font-medium leading-snug">{s.title}</div>
                    {s.angle && <div className="mt-0.5 text-xs text-muted-foreground">{s.angle}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
