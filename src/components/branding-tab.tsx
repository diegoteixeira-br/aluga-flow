import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Image as ImageIcon, FileText, Files, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type ProfileBranding = {
  id: string;
  logo_url: string | null;
  watermark_url: string | null;
  pdf_header: string | null;
  pdf_footer: string | null;
};

async function uploadFile(userId: string, file: File, kind: "logo" | "watermark") {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${userId}/${kind}.${ext}`;
  const { error } = await supabase.storage.from("branding").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/png",
  });
  if (error) throw error;
  return path;
}

async function signedUrl(path: string | null) {
  if (!path) return null;
  const { data } = await supabase.storage.from("branding").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function BrandingTab() {
  const qc = useQueryClient();
  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [dirty, setDirty] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", "branding"],
    queryFn: async (): Promise<ProfileBranding> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { data, error } = await supabase
        .from("profiles")
        .select("id, logo_url, watermark_url, pdf_header, pdf_footer")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileBranding;
    },
  });

  const { data: logoUrl } = useQuery({
    queryKey: ["branding-url", "logo", profile?.logo_url],
    queryFn: () => signedUrl(profile?.logo_url ?? null),
    enabled: !!profile?.logo_url,
  });
  const { data: watermarkUrl } = useQuery({
    queryKey: ["branding-url", "watermark", profile?.watermark_url],
    queryFn: () => signedUrl(profile?.watermark_url ?? null),
    enabled: !!profile?.watermark_url,
  });

  useEffect(() => {
    if (profile) {
      setHeader(profile.pdf_header ?? "");
      setFooter(profile.pdf_footer ?? "");
      setDirty(false);
    }
  }, [profile]);

  const uploadMut = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: "logo" | "watermark" }) => {
      if (file.size > 2 * 1024 * 1024) throw new Error("Arquivo maior que 2 MB");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const path = await uploadFile(u.user.id, file, kind);
      const patch = (kind === "logo" ? { logo_url: path } : { watermark_url: path }) as never;
      const { error } = await supabase.from("profiles").update(patch).eq("id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", "branding"] });
      toast.success("Imagem enviada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: async (kind: "logo" | "watermark") => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      
      const path = kind === "logo" ? profile?.logo_url : profile?.watermark_url;
      if (path) await supabase.storage.from("branding").remove([path]);
      const patch = (kind === "logo" ? { logo_url: null } : { watermark_url: null }) as never;
      const { error } = await supabase.from("profiles").update(patch).eq("id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", "branding"] });
      toast.success("Imagem removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveText = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { error } = await supabase
        .from("profiles")
        .update({ pdf_header: header || null, pdf_footer: footer || null })
        .eq("id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", "branding"] });
      setDirty(false);
      toast.success("Alterações salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identidade visual</CardTitle>
        <CardDescription>
          Configure logotipo, marca d'água, cabeçalho e rodapé. Esses elementos aparecem nos PDFs de contratos, recibos e
          documentos exportados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="logo" className="space-y-4">
          <TabsList>
            <TabsTrigger value="logo"><ImageIcon className="h-4 w-4" />Logotipo</TabsTrigger>
            <TabsTrigger value="contratos"><FileText className="h-4 w-4" />Contratos</TabsTrigger>
            <TabsTrigger value="documentos"><Files className="h-4 w-4" />Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="logo">
            <UploadSlot
              title="Logotipo da organização"
              description="Aparece no cabeçalho de contratos, faturas e documentos exportados em PDF. PNG com até 400×400 px e 2 MB. Fundo transparente recomendado."
              previewUrl={logoUrl ?? null}
              onUpload={(file) => uploadMut.mutate({ file, kind: "logo" })}
              onRemove={profile?.logo_url ? () => removeMut.mutate("logo") : undefined}
              uploading={uploadMut.isPending}
            />
          </TabsContent>

          <TabsContent value="contratos" className="space-y-4">
            <UploadSlot
              title="Marca d'água"
              description="Imagem semitransparente aplicada ao fundo de todas as páginas. PNG com até 400×400 px. Prefira imagens claras e de baixo contraste."
              previewUrl={watermarkUrl ?? null}
              onUpload={(file) => uploadMut.mutate({ file, kind: "watermark" })}
              onRemove={profile?.watermark_url ? () => removeMut.mutate("watermark") : undefined}
              uploading={uploadMut.isPending}
            />

            <div className="space-y-2">
              <Label>Texto do cabeçalho</Label>
              <Textarea
                rows={3}
                placeholder="Exibido em largura total no topo de cada página."
                value={header}
                onChange={(e) => { setHeader(e.target.value); setDirty(true); }}
              />
            </div>

            <div className="space-y-2">
              <Label>Texto do rodapé</Label>
              <Textarea
                rows={3}
                placeholder="Exibido no canto inferior esquerdo. A numeração de páginas fica à direita."
                value={footer}
                onChange={(e) => { setFooter(e.target.value); setDirty(true); }}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <p className="text-sm text-muted-foreground">
                {dirty ? "Você tem alterações não salvas." : "Todas as alterações estão salvas."}
              </p>
              <Button type="button" onClick={() => saveText.mutate()} disabled={!dirty || saveText.isPending}>
                {saveText.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="documentos">
            <p className="text-sm text-muted-foreground">
              Os mesmos cabeçalho, rodapé e marca d'água configurados na aba <strong>Contratos</strong> são aplicados aos
              demais documentos (faturas, recibos e vistorias) exportados em PDF.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function UploadSlot({
  title, description, previewUrl, onUpload, onRemove, uploading,
}: {
  title: string;
  description: string;
  previewUrl: string | null;
  onUpload: (file: File) => void;
  onRemove?: () => void;
  uploading: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-3">
        <div>
          <h4 className="font-semibold">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm hover:bg-accent">
            <Upload className="h-4 w-4" />
            {uploading ? "Enviando..." : "Adicionar arquivo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          {onRemove ? (
            <Button type="button" variant="outline" size="sm" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />Remover
            </Button>
          ) : null}
        </div>
      </div>
      <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-center min-h-32">
        {previewUrl ? (
          <img src={previewUrl} alt={title} className="max-h-32 object-contain" />
        ) : (
          <p className="text-xs text-muted-foreground">Sem imagem enviada</p>
        )}
      </div>
    </div>
  );
}
