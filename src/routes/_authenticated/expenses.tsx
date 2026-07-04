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
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatBRL, formatDate, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Despesas — AlugaFlow" }] }),
  component: ExpensesPage,
});

const CATEGORIES = ["manutencao", "iptu", "condominio", "seguro", "reforma", "administracao", "outro"] as const;
const CATEGORY_LABEL: Record<string, string> = {
  manutencao: "Manutenção", iptu: "IPTU", condominio: "Condomínio",
  seguro: "Seguro", reforma: "Reforma", administracao: "Administração", outro: "Outro",
};

const schema = z.object({
  property_id: z.string().uuid().optional().or(z.literal("")),
  category: z.enum(CATEGORIES),
  description: z.string().trim().min(1, "Obrigatório").max(255),
  amount: z.coerce.number().min(0),
  expense_date: z.string().min(1, "Obrigatório"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;
type Expense = FormValues & { id: string; property?: { nickname: string } | null };

function ExpensesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Expense | null>(null);
  const [open, setOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, property:properties(nickname)")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Expense[];
    },
  });

  const total = data.reduce((s, e) => s + Number(e.amount || 0), 0);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Despesa excluída"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Despesas</h1>
          <p className="text-sm text-muted-foreground">
            {data.length} lançamento(s) — Total: <span className="font-semibold text-destructive">{formatBRL(total)}</span>
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> Nova despesa</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <p className="p-6 text-muted-foreground">Carregando...</p>
          : data.length === 0 ? <p className="p-6 text-center text-muted-foreground">Nenhuma despesa registrada.</p>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead><TableHead>Imóvel</TableHead>
                <TableHead>Valor</TableHead><TableHead className="w-[100px]">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.expense_date)}</TableCell>
                    <TableCell className="font-medium">{e.description}</TableCell>
                    <TableCell>{CATEGORY_LABEL[e.category]}</TableCell>
                    <TableCell>{e.property?.nickname ?? "—"}</TableCell>
                    <TableCell className="text-destructive">{formatBRL(e.amount)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del.mutate(e.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
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

      <ExpenseDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function ExpenseDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (b: boolean) => void; editing: Expense | null }) {
  const qc = useQueryClient();
  const { data: properties = [] } = useQuery({
    queryKey: ["properties", "select"],
    queryFn: async () => (await supabase.from("properties").select("id, nickname").order("nickname")).data ?? [],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: editing ? {
      property_id: editing.property_id ?? "", category: editing.category,
      description: editing.description, amount: editing.amount,
      expense_date: editing.expense_date, notes: editing.notes ?? "",
    } : {
      property_id: "", category: "outro", description: "",
      amount: 0, expense_date: todayISO(), notes: "",
    },
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const payload = {
        ...values,
        property_id: values.property_id || null,
        user_id: u.user.id,
      };
      if (editing) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "Despesa atualizada" : "Despesa criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{editing ? "Editar despesa" : "Nova despesa"}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Descrição *</Label>
            <Input {...form.register("description")} placeholder="Ex: Troca de torneira" />
            {form.formState.errors.description && <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v as FormValues["category"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Imóvel (opcional)</Label>
            <Select value={form.watch("property_id") || "none"} onValueChange={(v) => form.setValue("property_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.nickname}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Valor (R$) *</Label><Input type="number" step="0.01" {...form.register("amount")} /></div>
          <div className="space-y-1"><Label>Data *</Label><Input type="date" {...form.register("expense_date")} /></div>
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
