import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls } from "@/lib/photos";

export function PropertyCover({ propertyId, className = "h-12 w-16" }: { propertyId: string; className?: string }) {
  const { data: url } = useQuery({
    queryKey: ["property-cover", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_photos")
        .select("storage_path,category,created_at")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const cover = data.find((p) => p.category === "fachada") ?? data[0];
      if (!cover) return null;
      const urls = await getSignedUrls([cover.storage_path]);
      return urls[cover.storage_path] ?? null;
    },
  });

  return (
    <div className={`${className} overflow-hidden rounded-md border bg-muted flex items-center justify-center`}>
      {url ? (
        <img src={url} alt="Capa do imóvel" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );
}
