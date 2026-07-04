import { supabase } from "@/integrations/supabase/client";

export const PHOTO_BUCKET = "property-photos";

export const PHOTO_CATEGORIES = [
  "fachada",
  "sala",
  "sala_jantar",
  "quarto",
  "suite",
  "cozinha",
  "cozinha_americana",
  "banheiro",
  "lavabo",
  "area_servico",
  "area_externa",
  "varanda",
  "garagem",
  "quintal",
  "piscina",
  "churrasqueira",
  "escritorio",
  "closet",
  "vistoria_entrada",
  "vistoria_saida",
  "outro",
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<PhotoCategory, string> = {
  fachada: "Fachada",
  sala: "Sala",
  sala_jantar: "Sala de Jantar",
  quarto: "Quarto",
  suite: "Suíte",
  cozinha: "Cozinha",
  cozinha_americana: "Cozinha Americana",
  banheiro: "Banheiro",
  lavabo: "Lavabo",
  area_servico: "Área de Serviço",
  area_externa: "Área Externa",
  varanda: "Varanda / Sacada",
  garagem: "Garagem",
  quintal: "Quintal",
  piscina: "Piscina",
  churrasqueira: "Churrasqueira",
  escritorio: "Escritório",
  closet: "Closet",
  vistoria_entrada: "Vistoria Entrada",
  vistoria_saida: "Vistoria Saída",
  outro: "Outro",
};

export const MAX_PHOTOS_PER_PROPERTY = 30;

export async function uploadPropertyPhoto(params: {
  userId: string;
  propertyId: string;
  file: File;
}): Promise<string> {
  const { userId, propertyId, file } = params;
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${propertyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  return path;
}

export async function getSignedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, 3600);
  if (error) throw error;
  const map: Record<string, string> = {};
  data?.forEach((d) => {
    if (d.signedUrl && d.path) map[d.path] = d.signedUrl;
  });
  return map;
}

export async function deletePhotoFile(path: string) {
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

export async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
