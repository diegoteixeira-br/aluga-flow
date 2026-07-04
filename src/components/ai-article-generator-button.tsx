import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/blog-utils";

export type GeneratedArticleResult = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
};

export function AiArticleGeneratorButton({
  title,
  onGenerated,
}: {
  title: string;
  onGenerated: (a: GeneratedArticleResult) => void;
}) {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!title || title.trim().length < 5) {
      toast.error("Informe um título antes de gerar o artigo.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-blog-article", {
        body: { action: "generate_article", title: title.trim(), angle: "" },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      const a = data as GeneratedArticleResult;
      const finalTitle = a.title && a.title.trim().length >= 10 ? a.title.trim() : title.trim();
      onGenerated({
        title: finalTitle,
        slug: a.slug && /^[a-z0-9-]{3,}$/.test(a.slug) ? a.slug : slugify(finalTitle),
        excerpt: a.excerpt ?? "",
        content: a.content ?? "",
      });
      toast.success("Artigo gerado! Revise antes de publicar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar artigo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={generate} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
      Gerar artigo com IA
    </Button>
  );
}
