import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Save, Sparkles, Eye, Code } from "lucide-react";
import { adminLegalAiEdit } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/legais")({
  component: LegalPagesAdmin,
});

type Slug = "termos" | "privacidade";
const TITLES: Record<Slug, string> = { termos: "Termos de Uso", privacidade: "Política de Privacidade" };

function LegalPagesAdmin() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Páginas Legais</h1>
        <p className="text-sm text-muted-foreground">Edite os textos públicos exibidos em <code>/termos</code> e <code>/privacidade</code>. Use HTML simples.</p>
      </div>
      <Tabs defaultValue="termos">
        <TabsList>
          <TabsTrigger value="termos">Termos de Uso</TabsTrigger>
          <TabsTrigger value="privacidade">Política de Privacidade</TabsTrigger>
        </TabsList>
        <TabsContent value="termos"><LegalEditor slug="termos" /></TabsContent>
        <TabsContent value="privacidade"><LegalEditor slug="privacidade" /></TabsContent>
      </Tabs>
    </div>
  );
}

function LegalEditor({ slug }: { slug: Slug }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("legal_pages").select("content, updated_at").eq("slug", slug).maybeSingle();
      if (error) toast.error(error.message);
      setContent(data?.content ?? "");
      setUpdatedAt(data?.updated_at ?? null);
      setLoading(false);
    })();
  }, [slug]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("legal_pages").upsert({ slug, content, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Página salva com sucesso");
    setUpdatedAt(new Date().toISOString());
  };

  const runAi = async () => {
    if (!instruction.trim()) return toast.error("Descreva a alteração desejada");
    setAiBusy(true);
    try {
      const res = await adminLegalAiEdit({ data: { slug, currentContent: content, instruction } });
      setContent(res.content);
      setInstruction("");
      toast.success("Conteúdo atualizado pela IA. Revise e clique em Salvar.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>;

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Assistente de IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder='Ex: "Atualize a cláusula 4 para incluir regra de devolução em até 7 dias."'
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={aiBusy}
          />
          <div className="flex justify-end">
            <Button onClick={runAi} disabled={aiBusy || !instruction.trim()}>
              {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Aplicar com IA
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">A IA lê o conteúdo atual, aplica sua instrução e devolve o documento completo. Revise antes de salvar.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{TITLES[slug]}</CardTitle>
          {updatedAt && (
            <span className="text-xs text-muted-foreground">
              Atualizado em {new Date(updatedAt).toLocaleString("pt-BR")}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="edit">
            <TabsList>
              <TabsTrigger value="edit"><Code className="mr-1 h-3.5 w-3.5" /> HTML</TabsTrigger>
              <TabsTrigger value="preview"><Eye className="mr-1 h-3.5 w-3.5" /> Pré-visualização</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-3">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[500px] font-mono text-xs"
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-3">
              <div
                className="prose prose-sm max-w-none rounded-md border bg-card p-6"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </TabsContent>
          </Tabs>
          <div className="mt-4 flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
