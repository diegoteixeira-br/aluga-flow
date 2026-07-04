import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatBRL } from "@/lib/format";
import { PropertyPhotos } from "@/components/property-photos";
import { PropertyCover } from "@/components/property-cover";
import { UpgradeRequiredDialog, useCheckLimit, type PlanLimit } from "@/components/plan-limit-guard";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({ meta: [{ title: "Imóveis — AlugaFlow" }] }),
  component: PropertiesPage,
});

const TYPES = ["apartamento", "casa", "comercial", "kitnet", "terreno", "outro"] as const;
const STATUSES = ["disponivel", "alugado", "manutencao", "inativo"] as const;

const schema = z.object({
  nickname: z.string().trim().min(1, "Obrigatório").max(100),
  address: z.string().trim().min(1, "Obrigatório").max(255),
  neighborhood: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(2).optional().or(z.literal("")),
  zip_code: z.string().trim().max(10).optional().or(z.literal("")),
  type: z.enum(TYPES),
  bedrooms: z.coerce.number().int().min(0).max(50),
  bathrooms: z.coerce.number().int().min(0).max(50),
  area_m2: z.coerce.number().min(0).max(100000).optional(),
  rent_amount: z.coerce.number().min(0),
  status: z.enum(STATUSES),
  notes: z.string().max(2000).optional().or(z.literal("")),
  listed_public: z.boolean().optional(),
  ad_title: z.string().trim().max(120).optional().or(z.literal("")),
  ad_description: z.string().max(2000).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;
type Property = FormValues & { id: string };

const STATUS_LABEL: Record<string, string> = { disponivel: "Disponível", alugado: "Alugado", manutencao: "Manutenção", inativo: "Inativo" };
const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  alugado: "default", disponivel: "secondary", manutencao: "outline", inativo: "destructive",
};

function PropertiesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Property | null>(null);
  const [open, setOpen] = useState(false);
  const [limitBlock, setLimitBlock] = useState<PlanLimit | null>(null);
  const checkLimit = useCheckLimit();

  const handleNew = async () => {
    const r = await checkLimit("properties");
    if (!r.allowed) { setLimitBlock(r); return; }
    setEditing(null); setOpen(true);
  };

  const { data = [], isLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Property[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["properties"] }); toast.success("Imóvel excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Imóveis</h1>
          <p className="text-sm text-muted-foreground">{data.length} cadastrado(s)</p>
        </div>
        <Button onClick={handleNew}><Plus className="h-4 w-4" /> Novo imóvel</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Carregando...</p>
          ) : data.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Nenhum imóvel cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Foto</TableHead>
                  <TableHead>Apelido</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Aluguel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell><PropertyCover propertyId={p.id} /></TableCell>
                    <TableCell className="font-medium">{p.nickname}</TableCell>
                    <TableCell className="text-sm">{p.address}</TableCell>
                    <TableCell className="capitalize">{p.type}</TableCell>
                    <TableCell>{formatBRL(p.rent_amount)}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir imóvel?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del.mutate(p.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PropertyDialog open={open} onOpenChange={setOpen} editing={editing} />
      <UpgradeRequiredDialog
        open={!!limitBlock}
        onOpenChange={(o) => !o && setLimitBlock(null)}
        current={limitBlock?.current}
        max={limitBlock?.max}
        description={`Você já cadastrou ${limitBlock?.current} de ${limitBlock?.max} imóveis permitidos no plano ${limitBlock?.plan}. Faça upgrade para cadastrar mais.`}
      />
    </div>
  );
}

function PropertyDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (b: boolean) => void; editing: Property | null }) {
  const qc = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: editing ?? {
      nickname: "", address: "", neighborhood: "", city: "", state: "", zip_code: "",
      type: "apartamento", bedrooms: 0, bathrooms: 0, area_m2: undefined,
      rent_amount: 0, status: "disponivel", notes: "",
      listed_public: false, ad_title: "", ad_description: "",
    },
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const payload = { ...values, area_m2: values.area_m2 || null, user_id: u.user.id };
      if (editing) {
        const { error } = await supabase.from("properties").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("properties").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      toast.success(editing ? "Imóvel atualizado" : "Imóvel criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar imóvel" : "Novo imóvel"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Apelido *</Label>
            <Input {...form.register("nickname")} placeholder="Ex: Apto Centro 502" />
            {form.formState.errors.nickname && <p className="text-xs text-destructive">{form.formState.errors.nickname.message}</p>}
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Endereço *</Label>
            <Input {...form.register("address")} />
            {form.formState.errors.address && <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>}
          </div>
          <div className="space-y-1"><Label>Cidade</Label><Input {...form.register("city")} /></div>
          <div className="space-y-1"><Label>Bairro</Label><Input {...form.register("neighborhood")} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>UF</Label><Input maxLength={2} {...form.register("state")} /></div>
            <div className="space-y-1"><Label>CEP</Label><Input {...form.register("zip_code")} /></div>
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={form.watch("type")} onValueChange={(v) => form.setValue("type", v as FormValues["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as FormValues["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Quartos</Label><Input type="number" min={0} {...form.register("bedrooms")} /></div>
          <div className="space-y-1"><Label>Banheiros</Label><Input type="number" min={0} {...form.register("bathrooms")} /></div>
          <div className="space-y-1"><Label>Área (m²)</Label><Input type="number" step="0.01" {...form.register("area_m2")} /></div>
          <div className="space-y-1"><Label>Valor do aluguel (R$) *</Label><Input type="number" step="0.01" {...form.register("rent_amount")} /></div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea rows={3} {...form.register("notes")} />
          </div>

          <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Anunciar no portal público</p>
                <p className="text-xs text-muted-foreground">O imóvel aparecerá na página inicial pública para qualquer pessoa.</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={!!form.watch("listed_public")}
                onChange={(e) => form.setValue("listed_public", e.target.checked)}
              />
            </div>
            <div className="space-y-1">
              <Label>Título do anúncio</Label>
              <Input {...form.register("ad_title")} placeholder="Ex: Apto 2 quartos no Centro" maxLength={120} />
            </div>
            <div className="space-y-1">
              <Label>Descrição para o anúncio</Label>
              <Textarea rows={3} {...form.register("ad_description")} placeholder="Descreva o imóvel, diferenciais, localização..." maxLength={2000} />
            </div>
          </div>

          <div className="sm:col-span-2">
            {editing ? (
              <PropertyPhotos propertyId={editing.id} />
            ) : (
              <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                Salve o imóvel para adicionar fotos.
              </p>
            )}
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
