import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Upload, FileDown, ImageIcon, ChevronDown } from "lucide-react";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  PHOTO_BUCKET,
  PHOTO_CATEGORIES,
  CATEGORY_LABEL,
  getSignedUrls,
  fetchAsDataUrl,
  type PhotoCategory,
} from "@/lib/photos";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/vistoria")({
  head: () => ({ meta: [{ title: "Vistoria — AlugaFlow" }] }),
  component: VistoriaPage,
});

type Property = { id: string; nickname: string; address: string };
type Contract = { id: string; property_id: string; tenant_id: string };
type Tenant = { id: string; full_name: string };
type Inspection = {
  id: string;
  property_id: string;
  contract_id: string | null;
  type: "entrada" | "saida";
  inspection_date: string;
  general_notes: string | null;
  created_at: string;
};
type InspectionPhoto = {
  id: string;
  inspection_id: string;
  storage_path: string;
  category: PhotoCategory;
  notes: string | null;
};
type PropertyPhoto = {
  id: string;
  storage_path: string;
  category: PhotoCategory;
};

function VistoriaPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [propertyId, setPropertyId] = useState<string>("");
  const [contractId, setContractId] = useState<string>("");
  const [type, setType] = useState<"entrada" | "saida">("entrada");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [generalNotes, setGeneralNotes] = useState("");
  const [draftPhotos, setDraftPhotos] = useState<
    { file: File; previewUrl: string; category: PhotoCategory; notes: string }[]
  >([]);

  const { data: properties = [] } = useQuery({
    queryKey: ["vistoria-properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id,nickname,address").order("nickname");
      if (error) throw error;
      return data as Property[];
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["vistoria-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("id,property_id,tenant_id");
      if (error) throw error;
      return data as Contract[];
    },
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ["vistoria-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id,full_name");
      if (error) throw error;
      return data as Tenant[];
    },
  });

  const propertyContracts = contracts.filter((c) => c.property_id === propertyId);

  const addFiles = (files: FileList) => {
    const next = Array.from(files).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      category: "sala" as PhotoCategory,
      notes: "",
    }));
    setDraftPhotos((prev) => [...prev, ...next]);
  };

  const resetForm = () => {
    draftPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setDraftPhotos([]);
    setGeneralNotes("");
    setContractId("");
    setType("entrada");
    setDate(new Date().toISOString().slice(0, 10));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!propertyId) throw new Error("Selecione o imóvel");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");

      const { data: ins, error: insErr } = await supabase
        .from("inspections")
        .insert({
          user_id: u.user.id,
          property_id: propertyId,
          contract_id: contractId || null,
          type,
          inspection_date: date,
          general_notes: generalNotes || null,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      for (const p of draftPhotos) {
        const ext = p.file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${u.user.id}/${propertyId}/inspections/${ins.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, p.file, { contentType: p.file.type });
        if (upErr) throw upErr;
        const { error: phErr } = await supabase.from("inspection_photos").insert({
          user_id: u.user.id,
          inspection_id: ins.id,
          storage_path: path,
          category: p.category,
          notes: p.notes || null,
        });
        if (phErr) throw phErr;
      }
    },
    onSuccess: () => {
      toast.success("Vistoria registrada");
      qc.invalidateQueries({ queryKey: ["inspections"] });
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Vistoria</h1>
        <p className="text-sm text-muted-foreground">Registre vistorias de entrada e saída com fotos e observações.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Nova vistoria</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Imóvel *</Label>
              <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); setContractId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.nickname}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Contrato</Label>
              <Select value={contractId} onValueChange={setContractId} disabled={!propertyId}>
                <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
                <SelectContent>
                  {propertyContracts.map((c) => {
                    const t = tenants.find((x) => x.id === c.tenant_id);
                    return <SelectItem key={c.id} value={c.id}>{t?.full_name ?? "Contrato"}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={(v) => setType(v as "entrada" | "saida")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {propertyId && <PropertyPhotoReference propertyId={propertyId} />}

          <div className="space-y-1">
            <Label>Observações gerais</Label>
            <Textarea rows={3} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} />
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Fotos por cômodo ({draftPhotos.length})</p>
              <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Adicionar fotos
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }}
              />
            </div>

            {draftPhotos.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-6 text-muted-foreground">
                <ImageIcon className="h-8 w-8" /><p className="text-xs">Nenhuma foto adicionada</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {draftPhotos.map((p, i) => (
                  <div key={i} className="space-y-2 rounded-md border p-2">
                    <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
                      <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                      <Button
                        type="button" size="icon" variant="destructive"
                        className="absolute right-1 top-1 h-7 w-7"
                        onClick={() => setDraftPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      ><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                    <Select
                      value={p.category}
                      onValueChange={(v) => setDraftPhotos((prev) => prev.map((x, idx) => idx === i ? { ...x, category: v as PhotoCategory } : x))}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PHOTO_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Textarea
                      rows={2} placeholder="Observação do cômodo"
                      value={p.notes}
                      onChange={(e) => setDraftPhotos((prev) => prev.map((x, idx) => idx === i ? { ...x, notes: e.target.value } : x))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetForm}>Limpar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !propertyId}>
              <Plus className="h-4 w-4" />{save.isPending ? "Salvando..." : "Registrar vistoria"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <InspectionHistory propertyId={propertyId} properties={properties} />
    </div>
  );
}

function PropertyPhotoReference({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(true);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const { data: photos = [] } = useQuery({
    queryKey: ["property-photos-ref", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_photos")
        .select("id, storage_path, category")
        .eq("property_id", propertyId);
      if (error) throw error;
      return data as PropertyPhoto[];
    },
  });

  useEffect(() => {
    if (photos.length === 0) { setUrls({}); return; }
    getSignedUrls(photos.map((p) => p.storage_path)).then(setUrls).catch(() => setUrls({}));
  }, [photos]);

  if (photos.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border bg-muted/30">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between p-3 text-sm font-medium">
          <span className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Fotos do imóvel (referência) — {photos.length}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {photos.map((p) => (
            <div key={p.id} className="space-y-1">
              <div className="aspect-square overflow-hidden rounded-md bg-background">
                {urls[p.storage_path] ? (
                  <img src={urls[p.storage_path]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground"><ImageIcon className="h-5 w-5" /></div>
                )}
              </div>
              <p className="truncate text-[10px] text-muted-foreground">{CATEGORY_LABEL[p.category] ?? p.category}</p>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function InspectionHistory({ propertyId, properties }: { propertyId: string; properties: Property[] }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["inspections", propertyId || "all"],
    queryFn: async () => {
      let q = supabase.from("inspections").select("*").order("inspection_date", { ascending: false });
      if (propertyId) q = q.eq("property_id", propertyId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Inspection[];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de vistorias {propertyId ? "deste imóvel" : "(todos os imóveis)"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma vistoria registrada.</p>
        ) : (
          data.map((ins) => {
            const prop = properties.find((p) => p.id === ins.property_id);
            return <InspectionRow key={ins.id} ins={ins} propertyName={prop?.nickname ?? "Imóvel"} propertyAddress={prop?.address ?? ""} />;
          })
        )}
      </CardContent>
    </Card>
  );
}

function InspectionRow({ ins, propertyName, propertyAddress }: { ins: Inspection; propertyName: string; propertyAddress: string }) {
  const qc = useQueryClient();
  const { data: photos = [] } = useQuery({
    queryKey: ["inspection-photos", ins.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspection_photos").select("*").eq("inspection_id", ins.id);
      if (error) throw error;
      return data as InspectionPhoto[];
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const paths = photos.map((p) => p.storage_path);
      if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
      const { error } = await supabase.from("inspections").delete().eq("id", ins.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inspections"] }); toast.success("Vistoria excluída"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const generatePdf = async () => {
    try {
      const urls = await getSignedUrls(photos.map((p) => p.storage_path));
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      let y = margin;

      doc.setFontSize(18); doc.text("Laudo de Vistoria", margin, y); y += 24;
      doc.setFontSize(11);
      doc.text(`Imóvel: ${propertyName}`, margin, y); y += 16;
      if (propertyAddress) { doc.text(`Endereço: ${propertyAddress}`, margin, y); y += 16; }
      doc.text(`Tipo: ${ins.type === "entrada" ? "Entrada" : "Saída"}`, margin, y); y += 16;
      doc.text(`Data: ${formatDate(ins.inspection_date)}`, margin, y); y += 20;

      if (ins.general_notes) {
        doc.setFont("helvetica", "bold"); doc.text("Observações gerais:", margin, y); y += 14;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(ins.general_notes, pageWidth - margin * 2);
        doc.text(lines, margin, y); y += lines.length * 12 + 8;
      }

      // group photos by category
      const groups: Record<string, InspectionPhoto[]> = {};
      photos.forEach((p) => { (groups[p.category] ||= []).push(p); });

      for (const cat of Object.keys(groups)) {
        if (y > pageHeight - 200) { doc.addPage(); y = margin; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(13);
        doc.text(CATEGORY_LABEL[cat as PhotoCategory] ?? cat, margin, y); y += 16;
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);

        for (const ph of groups[cat]) {
          if (y > pageHeight - 200) { doc.addPage(); y = margin; }
          const url = urls[ph.storage_path];
          if (url) {
            try {
              const dataUrl = await fetchAsDataUrl(url);
              const imgW = 200, imgH = 150;
              doc.addImage(dataUrl, "JPEG", margin, y, imgW, imgH, undefined, "FAST");
              if (ph.notes) {
                const noteLines = doc.splitTextToSize(ph.notes, pageWidth - margin * 2 - imgW - 12);
                doc.text(noteLines, margin + imgW + 12, y + 12);
              }
              y += imgH + 12;
            } catch {
              doc.text("(imagem indisponível)", margin, y); y += 14;
            }
          }
        }
        y += 8;
      }

      doc.save(`vistoria-${propertyName}-${ins.inspection_date}.pdf`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{propertyName}</span>
          <Badge variant={ins.type === "entrada" ? "default" : "secondary"}>
            {ins.type === "entrada" ? "Entrada" : "Saída"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(ins.inspection_date)} — {photos.length} foto(s)
        </p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={generatePdf}><FileDown className="h-4 w-4" /> PDF</Button>
        <Button size="sm" variant="ghost" onClick={() => del.mutate()}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
    </div>
  );
}
