import { Link } from "@tanstack/react-router";
import { memo, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bed, Bath, Maximize, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/format";
import { getPhotoUrls } from "@/lib/public-photos";
import { useDebounce } from "@/hooks/use-debounce";

const PAGE_SIZE = 12;
const TYPES = ["apartamento", "casa", "comercial", "kitnet", "terreno", "outro"] as const;

type Listing = {
  id: string;
  ad_title: string | null;
  nickname: string;
  ad_description: string | null;
  address: string;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: number | null;
  rent_amount: number;
  cover_path?: string | null;
  cover_url?: string;
};

type PublicListingsProps = {
  variant?: "home" | "page";
};

export function PublicListings({ variant = "page" }: PublicListingsProps) {
  const isHome = variant === "home";
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [type, setType] = useState<string>("todos");
  const [bedrooms, setBedrooms] = useState<string>("todos");
  const [bathrooms, setBathrooms] = useState<string>("todos");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [page, setPage] = useState(1);

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["public-listings"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, ad_title, nickname, ad_description, address, city, state, neighborhood, type, bedrooms, bathrooms, area_m2, rent_amount")
        .eq("listed_public", true)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const props = (data ?? []) as Listing[];
      if (props.length) {
        const ids = props.map((p) => p.id);
        const { data: photos } = await supabase
          .from("property_photos")
          .select("property_id, storage_path, category, sort_order")
          .in("property_id", ids)
          .order("sort_order", { ascending: true });
        const byProp = new Map<string, string>();
        for (const ph of photos ?? []) {
          if (!byProp.has(ph.property_id)) byProp.set(ph.property_id, ph.storage_path);
          if (ph.category === "fachada") byProp.set(ph.property_id, ph.storage_path);
        }
        const paths = Array.from(byProp.values());
        const urls = await getPhotoUrls(paths, { width: 480, quality: 75 });
        props.forEach((p) => {
          const path = byProp.get(p.id);
          p.cover_path = path ?? null;
          p.cover_url = path ? urls[path] : undefined;
        });
      }
      return props;
    },
  });

  const dCity = useDebounce(city, 400);
  const dNeighborhood = useDebounce(neighborhood, 400);
  const dMinPrice = useDebounce(minPrice, 400);
  const dMaxPrice = useDebounce(maxPrice, 400);

  const filtered = useMemo(() => {
    return listings.filter((p) => {
      const citySearch = dCity.toLowerCase();
      if (citySearch && !(p.city ?? "").toLowerCase().includes(citySearch) && !(p.neighborhood ?? "").toLowerCase().includes(citySearch)) return false;
      if (dNeighborhood && !(p.neighborhood ?? "").toLowerCase().includes(dNeighborhood.toLowerCase())) return false;
      if (type !== "todos" && p.type !== type) return false;
      if (bedrooms !== "todos") {
        const n = parseInt(bedrooms, 10);
        const b = p.bedrooms ?? 0;
        if (bedrooms === "4" ? b < 4 : b !== n) return false;
      }
      if (!isHome && bathrooms !== "todos") {
        const n = parseInt(bathrooms, 10);
        const b = p.bathrooms ?? 0;
        if (bathrooms === "4" ? b < 4 : b !== n) return false;
      }
      if (dMinPrice && p.rent_amount < parseFloat(dMinPrice)) return false;
      if (dMaxPrice && p.rent_amount > parseFloat(dMaxPrice)) return false;
      return true;
    });
  }, [listings, dCity, dNeighborhood, type, bedrooms, bathrooms, dMinPrice, dMaxPrice, isHome]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <section className={isHome ? "relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background py-12 md:py-16" : "border-b bg-muted/30 py-8"}>
        <div className={isHome ? "mx-auto max-w-5xl px-4 text-center" : "mx-auto max-w-6xl px-4"}>
          <h1 className={isHome ? "text-3xl font-bold tracking-tight md:text-5xl" : "text-2xl font-bold tracking-tight md:text-3xl"}>
            {isHome ? "Encontre seu próximo lar" : "Imóveis para alugar"}
          </h1>
          <p className={isHome ? "mx-auto mt-3 max-w-2xl text-muted-foreground" : "mt-1 text-sm text-muted-foreground"}>
            Aluguel direto com o proprietário, sem intermediários.
          </p>

          <div className={isHome ? "mx-auto mt-8 grid gap-3 rounded-2xl border bg-card p-4 text-left shadow-lg md:grid-cols-6" : "mt-6 grid gap-3 rounded-xl border bg-background p-4 shadow-sm md:grid-cols-4"}>
            <div className={isHome ? "space-y-1 md:col-span-2" : "space-y-1"}>
              <Label>{isHome ? "Cidade ou bairro" : "Cidade"}</Label>
              <Input value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} placeholder={isHome ? "Ex: Cáceres, Centro..." : "Ex: Cáceres"} />
            </div>
            {!isHome && (
              <div className="space-y-1">
                <Label>Bairro</Label>
                <Input value={neighborhood} onChange={(e) => { setNeighborhood(e.target.value); setPage(1); }} placeholder="Ex: Centro" />
              </div>
            )}
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Quartos</Label>
              <Select value={bedrooms} onValueChange={(v) => { setBedrooms(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Qualquer</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!isHome && (
              <div className="space-y-1">
                <Label>Banheiros</Label>
                <Select value={bathrooms} onValueChange={(v) => { setBathrooms(v); setPage(1); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Qualquer</SelectItem>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>{isHome ? "Mín (R$)" : "Valor mínimo (R$)"}</Label>
              <Input type="number" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>{isHome ? "Máx (R$)" : "Valor máximo (R$)"}</Label>
              <Input type="number" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} placeholder="∞" />
            </div>
            <div className={isHome ? "md:col-span-6" : "flex items-end"}>
              <Button className="w-full gap-2" size={isHome ? "lg" : "default"} onClick={() => setPage(1)}>
                <Search className="h-4 w-4" /> {isHome ? "Buscar imóveis" : "Buscar"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        {isHome ? (
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Imóveis disponíveis</h2>
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Carregando..." : `${filtered.length} imóvel(is) encontrado(s)`}
              </p>
            </div>
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted-foreground">
            {isLoading ? "Carregando..." : `${filtered.length} imóvel(is) encontrado(s)`}
          </p>
        )}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-full overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <CardContent className="space-y-2 p-4">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : pageItems.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            Nenhum imóvel encontrado com esses filtros.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((p) => <ListingCard key={p.id} item={p} />)}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        )}
      </section>
    </>
  );
}

const ListingCard = memo(function ListingCard({ item: p }: { item: Listing }) {
  return (
    <Link to="/anuncios/$id" params={{ id: p.id }} className="group block">
      <Card className="h-full overflow-hidden transition hover:shadow-md">
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
          {p.cover_url ? (
            <img
              src={p.cover_url}
              alt={p.ad_title ?? p.nickname}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition group-hover:scale-105"
            />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">Sem foto</div>
          )}
        </div>
        <CardContent className="p-4">
          <div className="text-lg font-bold text-primary">
            {formatBRL(p.rent_amount)}
            <span className="text-xs font-normal text-muted-foreground">/mês</span>
          </div>
          <h3 className="mt-1 line-clamp-1 font-semibold">{p.ad_title ?? p.nickname}</h3>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            <MapPin className="mr-1 inline h-3 w-3" />
            {[p.neighborhood, p.city, p.state].filter(Boolean).join(", ") || p.address}
          </p>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {p.bedrooms ?? 0}</span>
            <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {p.bathrooms ?? 0}</span>
            {p.area_m2 ? <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" /> {p.area_m2} m²</span> : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});
