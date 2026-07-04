import { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Upload, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PHOTO_CATEGORIES,
  CATEGORY_LABEL,
  MAX_PHOTOS_PER_PROPERTY,
  type PhotoCategory,
  uploadPropertyPhoto,
  getSignedUrls,
  deletePhotoFile,
} from "@/lib/photos";

type PhotoRow = {
  id: string;
  property_id: string;
  storage_path: string;
  category: PhotoCategory;
  caption: string | null;
  sort_order: number;
};

export function PropertyPhotos({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["property-photos", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_photos")
        .select("*")
        .eq("property_id", propertyId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as PhotoRow[];
    },
  });

  const { data: urls = {} } = useQuery({
    queryKey: ["property-photos-urls", propertyId, photos.map((p) => p.storage_path).join(",")],
    queryFn: () => getSignedUrls(photos.map((p) => p.storage_path)),
    enabled: photos.length > 0,
  });

  const remaining = Math.max(0, MAX_PHOTOS_PER_PROPERTY - photos.length);

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      let uploaded = 0;
      for (const f of files) {
        const path = await uploadPropertyPhoto({ userId: u.user.id, propertyId, file: f });
        const { error } = await supabase.from("property_photos").insert({
          user_id: u.user.id,
          property_id: propertyId,
          storage_path: path,
          category: "fachada" as PhotoCategory,
        });
        if (error) {
          await deletePhotoFile(path).catch(() => {});
          throw error;
        }
        uploaded++;
      }
      return uploaded;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["property-photos", propertyId] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["property-cover"] });
      toast.success(`${n} foto(s) enviada(s)`);
    },
    onError: (e: Error) => {
      console.error("[property-photos] upload error", e);
      toast.error(e.message || "Falha ao enviar foto");
    },
  });

  const setCategory = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: PhotoCategory }) => {
      const { error } = await supabase.from("property_photos").update({ category }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property-photos", propertyId] });
      qc.invalidateQueries({ queryKey: ["property-cover"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (p: PhotoRow) => {
      const { error } = await supabase.from("property_photos").delete().eq("id", p.id);
      if (error) throw error;
      await deletePhotoFile(p.storage_path);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property-photos", propertyId] });
      qc.invalidateQueries({ queryKey: ["property-cover"] });
      toast.success("Foto excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">Fotos do imóvel</p>
          <p className="text-xs text-muted-foreground">
            {photos.length}/{MAX_PHOTOS_PER_PROPERTY} — primeira marcada como "Fachada" será a capa
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending || photos.length >= MAX_PHOTOS_PER_PROPERTY}
        >
          <Upload className="h-4 w-4" /> Enviar
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (picked.length === 0) return;
            const toUpload = picked.slice(0, remaining);
            if (toUpload.length === 0) {
              toast.error(`Limite de ${MAX_PHOTOS_PER_PROPERTY} fotos atingido`);
              return;
            }
            if (picked.length > toUpload.length) {
              toast.info(`Apenas ${toUpload.length} foto(s) serão enviadas (limite ${MAX_PHOTOS_PER_PROPERTY})`);
            }
            upload.mutate(toUpload);
          }}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-6 text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
          <p className="text-xs">Nenhuma foto enviada</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((p) => (
            <div key={p.id} className="space-y-1">
              <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                {urls[p.storage_path] ? (
                  <img src={urls[p.storage_path]} alt={p.category} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">...</div>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={() => remove.mutate(p)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Select value={p.category} onValueChange={(v) => setCategory.mutate({ id: p.id, category: v as PhotoCategory })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PHOTO_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
