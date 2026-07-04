import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { fetchCep, maskCepInput } from "@/lib/viacep";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, FileText, X, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import {
  TENANT_DOC_TYPES, TENANT_DOC_LABEL, type TenantDocType,
  uploadTenantDoc, getTenantDocSignedUrl, deleteTenantDocFile, maskCPF,
} from "@/lib/tenant-docs";

export const Route = createFileRoute("/_authenticated/tenants")({
  head: () => ({ meta: [{ title: "Inquilinos — AlugaFlow" }] }),
  component: TenantsPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Obrigatório").max(120),
  cpf: z.string().trim().max(20).optional().or(z.literal("")),
  rg: z.string().trim().max(30).optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  marital_status: z.string().trim().max(40).optional().or(z.literal("")),
  occupation: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
  address_street: z.string().trim().max(160).optional().or(z.literal("")),
  address_number: z.string().trim().max(20).optional().or(z.literal("")),
  address_neighborhood: z.string().trim().max(80).optional().or(z.literal("")),
  address_city: z.string().trim().max(80).optional().or(z.literal("")),
  address_state: z.string().trim().max(2).optional().or(z.literal("")),
  address_zip: z.string().trim().max(15).optional().or(z.literal("")),
  guarantor_name: z.string().trim().max(120).optional().or(z.literal("")),
  guarantor_cpf: z.string().trim().max(20).optional().or(z.literal("")),
  guarantor_phone: z.string().trim().max(30).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;
type Tenant = FormValues & { id: string };
type TenantDoc = {
  id: string; tenant_id: string; doc_type: TenantDocType;
  file_path: string; file_name: string | null;
};

const EMPTY: FormValues = {
  full_name: "", cpf: "", rg: "", birth_date: "", marital_status: "", occupation: "",
  phone: "", whatsapp: "", email: "",
  address_street: "", address_number: "", address_neighborhood: "",
  address_city: "", address_state: "", address_zip: "",
  guarantor_name: "", guarantor_cpf: "", guarantor_phone: "", notes: "",
};

function TenantsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").order("full_name");
      if (error) throw error;
      return data as Tenant[];
    },
  });

  const { data: docCounts = {} } = useQuery({
    queryKey: ["tenant-doc-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_documents")
        .select("tenant_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data as { tenant_id: string }[]).forEach((d) => {
        map[d.tenant_id] = (map[d.tenant_id] || 0) + 1;
      });
      return map;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["tenant-doc-counts"] });
      toast.success("Inquilino excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inquilinos</h1>
          <p className="text-sm text-muted-foreground">{data.length} cadastrado(s)</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo inquilino
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Carregando...</p>
          ) : data.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Nenhum inquilino cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-center">Documentos</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((t) => {
                  const count = docCounts[t.id] || 0;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.full_name}</TableCell>
                      <TableCell>{maskCPF(t.cpf)}</TableCell>
                      <TableCell>{t.phone || t.whatsapp || "—"}</TableCell>
                      <TableCell className="text-center">
                        {count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[color:var(--color-success,#22C55E)]">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-xs">{count}</span>
                          </span>
                        ) : (
                          <XCircle className="mx-auto h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir inquilino?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del.mutate(t.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TenantDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function TenantDialog({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (b: boolean) => void; editing: Tenant | null }) {
  const qc = useQueryClient();
  const numberRef = useRef<HTMLInputElement>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: editing
      ? { ...EMPTY, ...editing }
      : EMPTY,
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const payload = {
        ...values,
        birth_date: values.birth_date || null,
        email: values.email || null,
        user_id: u.user.id,
      };
      if (editing) {
        const { error } = await supabase.from("tenants").update(payload).eq("id", editing.id);
        if (error) throw error;
        return editing.id;
      } else {
        const { data, error } = await supabase.from("tenants").insert(payload).select("id").single();
        if (error) throw error;
        return (data as { id: string }).id;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(editing ? "Inquilino atualizado" : "Inquilino criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar inquilino" : "Novo inquilino"}</DialogTitle>
          <DialogDescription>
            Preencha os dados do inquilino. Os documentos podem ser anexados após salvar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">Dados pessoais</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Nome completo *</Label>
                <Input {...form.register("full_name")} />
                {form.formState.errors.full_name && (
                  <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
                )}
              </div>
              <div className="space-y-1"><Label>CPF</Label><Input {...form.register("cpf")} /></div>
              <div className="space-y-1"><Label>RG</Label><Input {...form.register("rg")} /></div>
              <div className="space-y-1"><Label>Data de nascimento</Label><Input type="date" {...form.register("birth_date")} /></div>
              <div className="space-y-1">
                <Label>Estado civil</Label>
                <Select
                  value={form.watch("marital_status") || ""}
                  onValueChange={(v) => form.setValue("marital_status", v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                    <SelectItem value="casado">Casado(a)</SelectItem>
                    <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                    <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                    <SelectItem value="uniao_estavel">União estável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2"><Label>Profissão</Label><Input {...form.register("occupation")} /></div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">Contato</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1"><Label>Telefone principal</Label><Input {...form.register("phone")} /></div>
              <div className="space-y-1"><Label>WhatsApp</Label><Input {...form.register("whatsapp")} /></div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input type="email" {...form.register("email")} />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">Endereço atual</h3>
            <p className="text-xs text-muted-foreground">Digite o CEP primeiro — Rua, Bairro, Cidade e UF serão preenchidos automaticamente.</p>
            <div className="grid gap-3 sm:grid-cols-6">
              <div className="space-y-1 sm:col-span-2">
                <Label>CEP</Label>
                <div className="relative">
                  <Input
                    {...form.register("address_zip")}
                    maxLength={9}
                    placeholder="00000-000"
                    onChange={async (e) => {
                      const masked = maskCepInput(e.target.value);
                      form.setValue("address_zip", masked, { shouldDirty: true });
                      const digits = masked.replace(/\D/g, "");
                      if (digits.length === 8) {
                        setCepLoading(true);
                        const data = await fetchCep(digits);
                        setCepLoading(false);
                        if (data) {
                          form.setValue("address_street", data.logradouro || "", { shouldDirty: true });
                          form.setValue("address_neighborhood", data.bairro || "", { shouldDirty: true });
                          form.setValue("address_city", data.localidade || "", { shouldDirty: true });
                          form.setValue("address_state", (data.uf || "").toUpperCase(), { shouldDirty: true });
                          setTimeout(() => numberRef.current?.focus(), 50);
                        } else {
                          toast.error("CEP não encontrado");
                        }
                      }
                    }}
                  />
                  {cepLoading && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">…</span>
                  )}
                </div>
              </div>
              <div className="space-y-1 sm:col-span-4"><Label>Rua</Label><Input {...form.register("address_street")} /></div>
              <div className="space-y-1 sm:col-span-1"><Label>Número *</Label><Input {...(() => { const r = form.register("address_number"); return { ...r, ref: (el: HTMLInputElement | null) => { r.ref(el); numberRef.current = el; } }; })()} /></div>
              <div className="space-y-1 sm:col-span-3"><Label>Bairro</Label><Input {...form.register("address_neighborhood")} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>Cidade</Label><Input {...form.register("address_city")} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>UF</Label><Input maxLength={2} {...form.register("address_state")} /></div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">Fiador (opcional)</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1"><Label>Nome</Label><Input {...form.register("guarantor_name")} /></div>
              <div className="space-y-1"><Label>CPF</Label><Input {...form.register("guarantor_cpf")} /></div>
              <div className="space-y-1"><Label>Telefone</Label><Input {...form.register("guarantor_phone")} /></div>
            </div>
          </section>

          <section className="space-y-1">
            <Label>Observações</Label>
            <Textarea rows={3} {...form.register("notes")} />
          </section>

          {editing && (
            <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold text-primary">Documentos anexados</h3>
              <TenantDocsManager tenantId={editing.id} />
            </section>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TenantDocsManager({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [uploadingType, setUploadingType] = useState<TenantDocType | null>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["tenant-docs", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_documents")
        .select("id, tenant_id, doc_type, file_path, file_name")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TenantDoc[];
    },
  });

  const upload = useMutation({
    mutationFn: async ({ file, docType }: { file: File; docType: TenantDocType }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const path = await uploadTenantDoc({ userId: u.user.id, tenantId, file });
      const { error } = await supabase.from("tenant_documents").insert({
        user_id: u.user.id, tenant_id: tenantId, doc_type: docType,
        file_path: path, file_name: file.name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-docs", tenantId] });
      qc.invalidateQueries({ queryKey: ["tenant-doc-counts"] });
      toast.success("Documento enviado");
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setUploadingType(null),
  });

  const del = useMutation({
    mutationFn: async (doc: TenantDoc) => {
      await deleteTenantDocFile(doc.file_path);
      const { error } = await supabase.from("tenant_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-docs", tenantId] });
      qc.invalidateQueries({ queryKey: ["tenant-doc-counts"] });
      toast.success("Documento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {TENANT_DOC_TYPES.map((t) => (
          <label
            key={t}
            className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> {TENANT_DOC_LABEL[t]}
            </span>
            <input
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              disabled={upload.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setUploadingType(t);
                upload.mutate({ file, docType: t });
              }}
            />
            {uploadingType === t && <span className="text-xs text-muted-foreground">Enviando…</span>}
          </label>
        ))}
      </div>

      {docs.length > 0 && (
        <ul className="space-y-1">
          {docs.map((d) => <TenantDocRow key={d.id} doc={d} onDelete={() => del.mutate(d)} />)}
        </ul>
      )}
    </div>
  );
}

function TenantDocRow({ doc, onDelete }: { doc: TenantDoc; onDelete: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getTenantDocSignedUrl(doc.file_path)
      .then((u) => { if (active) setUrl(u); })
      .catch(() => {});
    return () => { active = false; };
  }, [doc.file_path]);

  return (
    <li className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-primary" />
        <span className="shrink-0 font-medium">{TENANT_DOC_LABEL[doc.doc_type]}:</span>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="truncate text-primary underline">
            {doc.file_name || "abrir"}
          </a>
        ) : (
          <span className="truncate text-muted-foreground">{doc.file_name || "—"}</span>
        )}
      </div>
      <Button type="button" size="icon" variant="ghost" onClick={onDelete}>
        <X className="h-4 w-4 text-destructive" />
      </Button>
    </li>
  );
}
