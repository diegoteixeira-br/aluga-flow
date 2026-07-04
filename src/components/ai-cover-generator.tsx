import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { streamImage } from "@/lib/stream-image";
import { uploadBlogCover } from "@/lib/blog-cover.functions";
import { supabase } from "@/integrations/supabase/client";

const GENERATE_COVER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-blog-cover`;

type Style = "foto" | "ilustracao" | "minimalista";

const styleHints: Record<Style, string> = {
  foto: "Fotografia profissional editorial, iluminação natural, alta nitidez, cores realistas, proporção 16:9",
  ilustracao: "Ilustração digital moderna, traços limpos, paleta vibrante mas elegante, estilo editorial, proporção 16:9",
  minimalista: "Composição minimalista, fundo neutro, poucos elementos, design clean e moderno, proporção 16:9",
};

export function AiCoverGenerator({ title, onCoverReady }: { title?: string; onCoverReady: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<Style>("foto");
  const [prompt, setPrompt] = useState("");
  const [b64, setB64] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const upload = uploadBlogCover;

  const suggested = title
    ? `Imagem de capa para artigo de blog imobiliário brasileiro sobre "${title}". ${styleHints[style]}.`
    : `Imagem de capa para artigo de blog imobiliário brasileiro. ${styleHints[style]}.`;

  const effectivePrompt = prompt.trim() || suggested;

  const generate = async () => {
    setB64(null);
    setIsFinal(false);
    setStreaming(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      await streamImage(
        GENERATE_COVER_URL,
        effectivePrompt,
        (data, final) => {
          setB64(data);
          if (final) setIsFinal(true);
        },
        token ? { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } : undefined,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar imagem");
    } finally {
      setStreaming(false);
    }
  };

  const use = async () => {
    if (!b64) return;
    setSaving(true);
    try {
      const { url } = await upload({ data: { base64: b64 } });
      onCoverReady(url);
      toast.success("Capa salva!");
      setOpen(false);
      setB64(null);
      setIsFinal(false);
      setPrompt("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="mt-2">
          <Sparkles className="mr-2 h-4 w-4" /> Gerar capa com IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Gerar capa com IA</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Estilo</Label>
            <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="foto">Fotografia</SelectItem>
                <SelectItem value="ilustracao">Ilustração</SelectItem>
                <SelectItem value="minimalista">Minimalista</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prompt (deixe em branco para usar a sugestão)</Label>
            <Textarea
              rows={3}
              placeholder={suggested}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">Descreva a cena, estilo, cores e clima desejados em português.</p>
          </div>

          {b64 && (
            <div className="overflow-hidden rounded-lg border bg-muted">
              <img
                src={`data:image/png;base64,${b64}`}
                alt="Prévia"
                className={`h-auto w-full transition-[filter] duration-300 ${isFinal ? "" : "blur-2xl"}`}
              />
            </div>
          )}
          {streaming && !b64 && (
            <div className="flex items-center justify-center rounded-lg border bg-muted p-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando imagem...
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={streaming || saving}>Fechar</Button>
          <Button type="button" variant="secondary" onClick={generate} disabled={streaming || saving}>
            {streaming ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando</> : b64 ? "Gerar outra" : "Gerar"}
          </Button>
          <Button type="button" onClick={use} disabled={!b64 || !isFinal || saving || streaming}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando</> : "Usar esta capa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
