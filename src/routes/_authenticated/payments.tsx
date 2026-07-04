import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CheckCircle2, Send, ExternalLink, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createAsaasChargeForPayment } from "@/lib/asaas.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatBRL, formatDate, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Pagamentos — AlugaFlow" }] }),
  component: PaymentsPage,
});

const STATUSES = ["pendente", "pago", "atrasado", "cancelado"] as const;
const METHODS = ["pix", "boleto", "transferencia", "dinheiro", "cartao", "outro"] as const;

const schema = z.object({
  contract_id: z.string().uuid("Selecione um contrato"),
  reference_month: z.string().min(1, "Obrigatório"),
  due_date: z.string().min(1, "Obrigatório"),
  amount: z.coerce.number().min(0),
  paid_amount: z.coerce.number().min(0).optional(),
  paid_date: z.string().optional().or(z.literal("")),
  status: z.enum(STATUSES),
  method: z.enum(METHODS).optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;
type Payment = FormValues & {
  id: string;
  asaas_payment_id?: string | null;
  asaas_invoice_url?: string | null;
  charge_sent_at?: string | null;
  contract?: { property_id?: string; property?: { nickname: string }; tenant?: { full_name: string } };
};

function statusOf(p: Payment): string {
  if (p.status === "pago" || p.status === "cancelado") return p.status;
  if (p.due_date < todayISO()) return "atrasado";
  return "pendente";
}
const VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pago: "default", pendente: "outline", atrasado: "destructive", cancelado: "secondary",
};

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function PaymentsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Payment | null>(null);
  const [open, setOpen] = useState(false);

  const now = new Date();
  const [fMonth, setFMonth] = useState<string>(String(now.getMonth() + 1)); // 1-12 or "all"
  const [fYear, setFYear] = useState<string>(String(now.getFullYear()));
  const [fStatus, setFStatus] = useState<string>("all");
  const [fProperty, setFProperty] = useState<string>("all");

  const { data: properties = [] } = useQuery({
    queryKey: ["payments-properties"],
    queryFn: async () => (await supabase.from("properties").select("id,nickname").order("nickname")).data ?? [],
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, contract:contracts(property_id, property:properties(nickname), tenant:tenants(full_name))")
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Payment[];
    },
  });

  const filtered = useMemo(() => data.filter((p) => {
    const d = p.due_date;
    if (fYear !== "all" && d.slice(0, 4) !== fYear) return false;
    if (fMonth !== "all" && d.slice(5, 7) !== String(fMonth).padStart(2, "0")) return false;
    if (fStatus !== "all" && statusOf(p) !== fStatus) return false;
    if (fProperty !== "all" && p.contract?.property_id !== fProperty) return false;
    return true;
  }), [data, fYear, fMonth, fStatus, fProperty]);

  const summary = useMemo(() => {
    let previsto = 0, recebido = 0, atrasado = 0;
    for (const p of filtered) {
      if (p.status === "cancelado") continue;
      previsto += Number(p.amount || 0);
      if (p.status === "pago") recebido += Number(p.paid_amount || p.amount || 0);
      else if (p.due_date < todayISO()) atrasado += Number(p.amount || 0);
    }
    return { previsto, recebido, atrasado };
  }, [filtered]);

  const years = useMemo(() => {
    const ys = new Set<string>([String(now.getFullYear())]);
    data.forEach((p) => ys.add(p.due_date.slice(0, 4)));
    return Array.from(ys).sort().reverse();
  }, [data, now]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments"] }); toast.success("Pagamento excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (p: Payment) => {
      const { error } = await supabase.from("payments").update({
        status: "pago",
        paid_date: todayISO(),
        paid_amount: p.amount,
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments"] }); toast.success("Pagamento confirmado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendCharge = useMutation({
    mutationFn: async (id: string) => {
      const r = await createAsaasChargeForPayment({ data: { paymentId: id } });
      // marca data de envio
      await supabase.from("payments").update({ charge_sent_at: new Date().toISOString() }).eq("id", id);
      return r;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      toast.success(r.reused ? "Cobrança já existente no ASAAS" : "Cobrança gerada no ASAAS");
      if (r.invoiceUrl) window.open(r.invoiceUrl, "_blank", "noopener");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pagamentos</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {data.length} lançamento(s)</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Novo pagamento</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Previsto</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatBRL(summary.previsto)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Recebido</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">{formatBRL(summary.recebido)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Atrasado</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{formatBRL(summary.atrasado)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="space-y-1">
            <Label className="text-xs">Mês</Label>
            <Select value={fMonth} onValueChange={setFMonth}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MONTHS_PT.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Select value={fYear} onValueChange={setFYear}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Imóvel</Label>
            <Select value={fProperty} onValueChange={setFProperty}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.nickname}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <p className="p-6 text-muted-foreground">Carregando...</p>
          : filtered.length === 0 ? <p className="p-6 text-center text-muted-foreground">Nenhum pagamento no filtro.</p>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Imóvel / Inquilino</TableHead><TableHead>Referência</TableHead>
                <TableHead>Vencimento</TableHead><TableHead>Valor</TableHead>
                <TableHead>Pago em</TableHead><TableHead>Status</TableHead>
                <TableHead className="w-[170px]">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const s = statusOf(p);
                  const sent = !!(p.asaas_payment_id || p.charge_sent_at);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.contract?.property?.nickname ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.contract?.tenant?.full_name ?? "—"}</div>
                      </TableCell>
                      <TableCell>{formatDate(p.reference_month)}</TableCell>
                      <TableCell>{formatDate(p.due_date)}</TableCell>
                      <TableCell>{formatBRL(p.amount)}</TableCell>
                      <TableCell>{p.paid_date ? formatDate(p.paid_date) : "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={VARIANT[s]} className="capitalize w-fit">{s}</Badge>
                          {sent && (
                            <Badge variant="secondary" className="w-fit gap-1 text-[10px]">
                              <MailCheck className="h-3 w-3" /> Cobrança enviada
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {s !== "pago" && s !== "cancelado" && (
                            <Button size="icon" variant="ghost" onClick={() => markPaid.mutate(p)} title="Marcar como pago">
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            </Button>
                          )}
                          {s !== "pago" && s !== "cancelado" && (
                            p.asaas_invoice_url ? (
                              <Button size="icon" variant="ghost" asChild title="Abrir cobrança ASAAS">
                                <a href={p.asaas_invoice_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 text-primary" /></a>
                              </Button>
                            ) : (
                              <Button size="icon" variant="ghost" onClick={() => sendCharge.mutate(p.id)} disabled={sendCharge.isPending} title="Enviar cobrança no ASAAS">
                                <Send className="h-4 w-4 text-primary" />
                              </Button>
                            )
                          )}
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Excluir pagamento?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del.mutate(p.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
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

      <PaymentDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function PaymentDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (b: boolean) => void; editing: Payment | null }) {
  const qc = useQueryClient();
  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts", "select"],
    queryFn: async () => (await supabase.from("contracts").select("id, rent_amount, due_day, property:properties(nickname), tenant:tenants(full_name)").eq("status", "ativo")).data ?? [],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: editing ? {
      contract_id: editing.contract_id, reference_month: editing.reference_month,
      due_date: editing.due_date, amount: editing.amount,
      paid_amount: editing.paid_amount ?? undefined, paid_date: editing.paid_date ?? "",
      status: editing.status, method: editing.method, notes: editing.notes ?? "",
    } : {
      contract_id: "", reference_month: todayISO().slice(0, 7) + "-01",
      due_date: todayISO(), amount: 0, status: "pendente", notes: "",
    },
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const payload = {
        ...values,
        paid_amount: values.paid_amount || null,
        paid_date: values.paid_date || null,
        method: values.method || null,
        user_id: u.user.id,
      };
      if (editing) {
        const { error } = await supabase.from("payments").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "Pagamento atualizado" : "Pagamento criado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Editar pagamento" : "Novo pagamento"}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Contrato *</Label>
            <Select value={form.watch("contract_id")} onValueChange={(v) => {
              form.setValue("contract_id", v);
              const c = contracts.find((x) => x.id === v);
              if (c && !editing) form.setValue("amount", Number(c.rent_amount));
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {(c.property as { nickname?: string } | null)?.nickname ?? "?"} — {(c.tenant as { full_name?: string } | null)?.full_name ?? "?"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.contract_id && <p className="text-xs text-destructive">{form.formState.errors.contract_id.message}</p>}
          </div>
          <div className="space-y-1"><Label>Mês de referência *</Label><Input type="date" {...form.register("reference_month")} /></div>
          <div className="space-y-1"><Label>Vencimento *</Label><Input type="date" {...form.register("due_date")} /></div>
          <div className="space-y-1"><Label>Valor (R$) *</Label><Input type="number" step="0.01" {...form.register("amount")} /></div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v as FormValues["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Valor pago (R$)</Label><Input type="number" step="0.01" {...form.register("paid_amount")} /></div>
          <div className="space-y-1"><Label>Data do pagamento</Label><Input type="date" {...form.register("paid_date")} /></div>
          <div className="space-y-1">
            <Label>Forma de pagamento</Label>
            <Select value={form.watch("method") ?? ""} onValueChange={(v) => form.setValue("method", v as FormValues["method"])}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2"><Label>Observações</Label><Textarea rows={3} {...form.register("notes")} /></div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
