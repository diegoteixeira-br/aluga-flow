import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LeadInterestDialog } from "@/components/lead-interest-dialog";
import { Bed, Bath, Maximize, MapPin, Phone, ArrowLeft, MessageCircle } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { getPhotoUrls } from "@/lib/public-photos";
import { PublicHeader, PublicFooter } from "./anuncios";

export const Route = createFileRoute("/anuncios/$id")({
  loader: async ({ params }) => {
    const { data: prop } = await supabase
      .from("properties")
      .select("ad_title, nickname, ad_description, notes, city, state, neighborhood, type, bedrooms, rent_amount")
      .eq("id", params.id)
      .eq("listed_public", true)
      .maybeSingle();
    if (!prop) return null;
    let coverUrl: string | null = null;
    const { data: cover } = await supabase
      .from("property_photos")
      .select("storage_path")
      .eq("property_id", params.id)
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (cover?.storage_path) {
      const urls = await getPhotoUrls([cover.storage_path], { width: 1200, quality: 80 });
      coverUrl = urls[cover.storage_path] ?? null;
    }
    return { prop, coverUrl };
  },
  head: ({ params, loaderData }) => {
    const path = `/anuncios/${params.id}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "Anúncio não encontrado — AlugaFlow" },
          { name: "robots", content: "noindex" },
        ],
        links: [{ rel: "canonical", href: path }],
      };
    }
    const { prop, coverUrl } = loaderData;
    const title = `${prop.ad_title ?? prop.nickname} — Aluguel em ${prop.city}/${prop.state} | AlugaFlow`;
    const rawDesc = prop.ad_description || prop.notes || `${prop.type ?? "Imóvel"} ${prop.bedrooms ? `com ${prop.bedrooms} quartos ` : ""}para alugar em ${[prop.neighborhood, prop.city, prop.state].filter(Boolean).join(", ")} por R$ ${Number(prop.rent_amount ?? 0).toLocaleString("pt-BR")}/mês.`;
    const description = rawDesc.replace(/\s+/g, " ").trim().slice(0, 160);
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { property: "og:url", content: path },
      { property: "product:price:amount", content: String(prop.rent_amount ?? "") },
      { property: "product:price:currency", content: "BRL" },
      { name: "twitter:card", content: coverUrl ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (coverUrl) {
      meta.push({ property: "og:image", content: coverUrl });
      meta.push({ name: "twitter:image", content: coverUrl });
    }
    return { meta, links: [{ rel: "canonical", href: path }] };
  },
  component: AnuncioDetail,
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Erro ao carregar anúncio</h1>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
        <Button asChild className="mt-6"><Link to="/anuncios">Voltar para anúncios</Link></Button>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Anúncio não encontrado</h1>
        <Button asChild className="mt-6"><Link to="/anuncios">Voltar</Link></Button>
      </div>
    </div>
  ),
});

function AnuncioDetail() {
  const { id } = Route.useParams();
  const [openLead, setOpenLead] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-listing", id],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: prop, error } = await supabase
        .from("properties")
        .select("id, user_id, ad_title, nickname, ad_description, notes, address, city, state, neighborhood, zip_code, type, bedrooms, bathrooms, area_m2, rent_amount, listed_public, contact_phone, show_contact_public")
        .eq("id", id)
        .eq("listed_public", true)
        .maybeSingle();
      if (error) throw error;
      if (!prop) throw notFound();

      const [{ data: photos }, { data: owner }] = await Promise.all([
        supabase.from("property_photos").select("storage_path, category, sort_order").eq("property_id", id).order("sort_order"),
        supabase.from("profiles").select("full_name, public_phone, show_phone_public").eq("id", prop.user_id).maybeSingle(),
      ]);
      const paths = (photos ?? []).map((p) => p.storage_path);
      const [thumbUrls, fullUrls] = await Promise.all([
        getPhotoUrls(paths, { width: 480, quality: 75 }),
        getPhotoUrls(paths, { width: 1600, quality: 85 }),
      ]);
      const photoList = (photos ?? []).map((p) => ({
        ...p,
        url: thumbUrls[p.storage_path],
        fullUrl: fullUrls[p.storage_path],
      }));
      return { prop, photos: photoList, owner: owner ?? null };
    },
  });


  if (isLoading) {
    return <div className="min-h-screen bg-background"><PublicHeader /><p className="p-10 text-center">Carregando...</p></div>;
  }
  if (isError || !data) {
    return <div className="min-h-screen bg-background"><PublicHeader /><p className="p-10 text-center">Anúncio não encontrado.</p></div>;
  }

  const { prop, photos, owner } = data;
  const description = prop.ad_description || prop.notes || "Entre em contato com o proprietário para mais informações.";

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <div className="mx-auto max-w-6xl px-4 py-6">
        <Button asChild variant="ghost" size="sm" className="mb-3"><Link to="/anuncios"><ArrowLeft className="h-4 w-4" /> Voltar</Link></Button>


        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{prop.ad_title ?? prop.nickname}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              <MapPin className="mr-1 inline h-4 w-4" />
              {[prop.address, prop.neighborhood, prop.city, prop.state].filter(Boolean).join(", ")}
            </p>

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full border px-3 py-1 capitalize">{prop.type}</span>
              <span className="flex items-center gap-1 rounded-full border px-3 py-1"><Bed className="h-4 w-4" /> {prop.bedrooms ?? 0} quartos</span>
              <span className="flex items-center gap-1 rounded-full border px-3 py-1"><Bath className="h-4 w-4" /> {prop.bathrooms ?? 0} banheiros</span>
              {prop.area_m2 ? <span className="flex items-center gap-1 rounded-full border px-3 py-1"><Maximize className="h-4 w-4" /> {prop.area_m2} m²</span> : null}
            </div>

            <div className="mt-6">
              <h2 className="text-lg font-semibold">Descrição</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>

            {photos.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold">Fotos do imóvel ({photos.length})</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {photos.map((p, i) => (
                    <button type="button" key={i} onClick={() => setLightboxIdx(i)} className="aspect-square overflow-hidden rounded-lg bg-muted cursor-zoom-in">
                      {p.url && <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">Valor do aluguel</p>
                <p className="text-3xl font-bold text-primary">{formatBRL(prop.rent_amount)}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                <Button className="mt-4 w-full" size="lg" onClick={() => setOpenLead(true)}>Tenho interesse</Button>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  Preencha seu pré-cadastro (dados pessoais e documentos) para o proprietário avaliar e adiantar o contrato.
                </p>
              </CardContent>
            </Card>

            <LeadInterestDialog
              open={openLead}
              onOpenChange={setOpenLead}
              propertyId={prop.id}
              ownerUserId={prop.user_id}
              propertyTitle={prop.ad_title ?? prop.nickname}
            />


            {(() => {
              const phone = (prop.show_contact_public && prop.contact_phone)
                ? prop.contact_phone
                : (owner?.show_phone_public && owner?.public_phone) ? owner.public_phone : null;
              if (!phone) return null;
              const digits = phone.replace(/\D/g, "");
              const waNumber = digits.length === 11 || digits.length === 10 ? `55${digits}` : digits;
              const waMsg = encodeURIComponent(`Olá! Gostaria de agendar uma visita ao imóvel "${prop.ad_title ?? prop.nickname}" anunciado no AlugaFlow.`);
              return (
                <Card>
                  <CardContent className="p-5">
                    <p className="text-sm font-semibold">Agendar visita</p>
                    {owner?.full_name && <p className="mt-1 text-sm text-muted-foreground">{owner.full_name}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">Fale rápido com o proprietário para tirar dúvidas ou marcar uma visita.</p>
                    <a href={`tel:${phone}`} className="mt-3 flex items-center gap-2 text-sm text-primary hover:underline">
                      <Phone className="h-4 w-4" /> {phone}
                    </a>
                    <Button asChild className="mt-3 w-full gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                      <a href={`https://wa.me/${waNumber}?text=${waMsg}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-4 w-4" /> Chamar no WhatsApp
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </div>
      </div>


      <Dialog open={lightboxIdx !== null} onOpenChange={(o) => !o && setLightboxIdx(null)}>
        <DialogContent className="max-w-5xl border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Foto do imóvel</DialogTitle>
          {lightboxIdx !== null && photos[lightboxIdx]?.fullUrl && (
            <div className="relative">
              <img src={photos[lightboxIdx].fullUrl} alt="" className="mx-auto max-h-[85vh] w-auto rounded-lg object-contain" />
              {photos.length > 1 && (
                <>
                  <button type="button" onClick={() => setLightboxIdx((i) => (i! - 1 + photos.length) % photos.length)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"><ChevronLeft className="h-6 w-6" /></button>
                  <button type="button" onClick={() => setLightboxIdx((i) => (i! + 1) % photos.length)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"><ChevronRight className="h-6 w-6" /></button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{lightboxIdx + 1} / {photos.length}</div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PublicFooter />
    </div>
  );
}
