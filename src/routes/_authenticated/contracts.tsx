import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, FileDown, Send, ShieldCheck, FileMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createAsaasChargesForContract } from "@/lib/asaas.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBRL, formatDate } from "@/lib/format";
import { ContractWizard } from "@/components/contract-wizard";
import { downloadContractPDF, type ContractPDFData, type OwnerProfile, type SignatureFooter } from "@/lib/contract-pdf";
import { baixarDistrato, type DistratoData } from "@/lib/contract-templates";

export const Route = createFileRoute("/_authenticated/contracts")({
  head: () => ({ meta: [{ title: "Contratos — AlugaFlow" }] }),
  component: ContractsPage,
});

type Contract = Omit<ContractPDFData, "guarantor"> & {
  id: string;
  property_id: string;
  tenant_id: string;
  status: string;
  signature_mode: string;
  signature_status: string;
  signed_at: string | null;
  guarantor_name: string | null;
  guarantor_cpf: string | null;
  guarantor_rg: string | null;
  guarantor_email: string | null;
  guarantor_phone: string | null;
  guarantor_address: string | null;
};

function displayStatus(c: Contract) {
  if (c.signature_status === "assinado" && c.signature_mode === "eletronica")
    return { label: "Assinado digitalmente", className: "bg-blue-600 hover:bg-blue-600 text-white" };
  if (c.signature_status === "assinado")
    return { label: "Assinado", className: "bg-green-700 hover:bg-green-700 text-white" };
  if (c.signature_status === "parcial")
    return { label: "Assinatura parcial", className: "bg-amber-500 hover:bg-amber-500 text-white" };
  if (c.status !== "ativo")
    return { label: "Encerrado", className: "bg-gray-500 hover:bg-gray-500 text-white" };
  const end = new Date(c.end_date + "T00:00:00");
  const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: "Encerrado", className: "bg-gray-500 hover:bg-gray-500 text-white" };
  if (days <= 30) return { label: "A vencer em 30 dias", className: "bg-orange-500 hover:bg-orange-500 text-white" };
  return { label: "Ativo", className: "bg-green-600 hover:bg-green-600 text-white" };
}

function monthsBetween(s: string, e: string): number {
  const a = new Date(s + "T00:00:00"), b = new Date(e + "T00:00:00");
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1);
}
function monthsRemaining(endISO: string): number {
  const e = new Date(endISO + "T00:00:00");
  const now = new Date();
  if (isNaN(e.getTime())) return 0;
  const diff = (e.getFullYear() - now.getFullYear()) * 12 + (e.getMonth() - now.getMonth());
  return Math.max(0, diff);
}

function ContractsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [distratoFor, setDistratoFor] = useState<Contract | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          id, property_id, tenant_id, start_date, end_date, rent_amount, due_day, deposit_amount,
          status, adjustment_index, adjustment_frequency_months, guarantee_type, guarantee_months,
          contract_type, extra_charges, notes, signature_mode, signature_status, signed_at,
          guarantor_name, guarantor_cpf, guarantor_rg, guarantor_email, guarantor_phone, guarantor_address,
          property:properties(nickname,address,city,state,zip_code,type,bedrooms,area_m2),
          tenant:tenants(full_name,cpf,rg,email,phone,address_street,address_number,address_neighborhood,address_city,address_state)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Contract[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("contracts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contracts"] }); qc.invalidateQueries({ queryKey: ["payments"] }); toast.success("Contrato excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function loadOwner(): Promise<OwnerProfile & { email: string }> {
    const { data: u } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", u.user!.id).maybeSingle();
    return { ...(profile ?? {}), email: u.user?.email ?? "—" } as OwnerProfile & { email: string };
  }

  function toPayload(c: Contract): ContractPDFData {
    return {
      contract_type: c.contract_type, property: c.property, tenant: c.tenant,
      guarantor: c.guarantor_name ? {
        name: c.guarantor_name, cpf: c.guarantor_cpf, rg: c.guarantor_rg,
        email: c.guarantor_email, phone: c.guarantor_phone, address: c.guarantor_address,
      } : null,
      start_date: c.start_date, end_date: c.end_date,
      rent_amount: c.rent_amount, due_day: c.due_day, deposit_amount: c.deposit_amount,
      adjustment_index: c.adjustment_index, adjustment_frequency_months: c.adjustment_frequency_months,
      guarantee_type: c.guarantee_type, guarantee_months: c.guarantee_months,
      extra_charges: c.extra_charges, notes: c.notes,
    };
  }

  async function downloadPDF(c: Contract) {
    try {
      const owner = await loadOwner();
      let signatures: SignatureFooter[] | undefined;
      if (c.signature_status === "assinado" || c.signature_status === "parcial") {
        const { data: sigs } = await supabase
          .from("contract_signatures")
          .select("role, signed_name, signed_cpf, signed_at, signer_ip")
          .eq("contract_id", c.id)
          .not("signed_at", "is", null);
        signatures = (sigs ?? []).map((s) => ({
          role: s.role as SignatureFooter["role"],
          name: s.signed_name ?? "",
          cpf: s.signed_cpf ?? "",
          signed_at: s.signed_at ?? "",
          ip: s.signer_ip,
        }));
      }
      downloadContractPDF(c.property?.nickname ?? "contrato", toPayload(c), owner, signatures);
    } catch (e) { toast.error((e as Error).message); }
  }

  const sendCharges = useMutation({
    mutationFn: async (id: string) => createAsaasChargesForContract({ data: { contractId: id } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      if (r.created > 0) toast.success(`${r.created} cobrança(s) gerada(s) no ASAAS`);
      if (r.failed > 0) toast.error(`${r.failed} cobrança(s) falharam: ${r.errors.join(" | ")}`);
      if (r.created === 0 && r.failed === 0) toast.message("Nenhuma cobrança pendente para gerar.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground">{data.length} cadastrado(s)</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo contrato</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <p className="p-6 text-muted-foreground">Carregando...</p>
          : data.length === 0 ? <p className="p-6 text-center text-muted-foreground">Nenhum contrato cadastrado.</p>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Imóvel</TableHead><TableHead>Inquilino</TableHead>
                <TableHead>Vigência</TableHead><TableHead>Aluguel</TableHead>
                <TableHead>Status</TableHead><TableHead className="w-[200px]">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((c) => {
                  const s = displayStatus(c);
                  const isActive = c.status === "ativo" && new Date(c.end_date + "T00:00:00").getTime() >= Date.now();
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.property?.nickname ?? "—"}</TableCell>
                      <TableCell>{c.tenant?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-sm">{formatDate(c.start_date)} → {formatDate(c.end_date)}</TableCell>
                      <TableCell>{formatBRL(c.rent_amount)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge className={s.className}>{s.label}</Badge>
                          {c.signature_mode === "eletronica" && c.signature_status !== "assinado" && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Assinatura eletrônica</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" title="Ver contrato PDF" onClick={() => downloadPDF(c)}><FileDown className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" title="Gerar cobranças ASAAS" onClick={() => sendCharges.mutate(c.id)} disabled={sendCharges.isPending}><Send className="h-4 w-4" /></Button>
                          {isActive && (
                            <Button size="icon" variant="ghost" title="Gerar distrato" onClick={() => setDistratoFor(c)}><FileMinus className="h-4 w-4" /></Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
                                <AlertDialogDescription>Os pagamentos e assinaturas vinculados também serão removidos.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del.mutate(c.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
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

      <ContractWizard open={open} onOpenChange={setOpen} />
      {distratoFor && (
        <DistratoDialog
          contract={distratoFor}
          onClose={() => setDistratoFor(null)}
          loadOwner={loadOwner}
          toPayload={toPayload}
        />
      )}
    </div>
  );
}

function DistratoDialog({
  contract, onClose, loadOwner, toPayload,
}: {
  contract: Contract;
  onClose: () => void;
  loadOwner: () => Promise<OwnerProfile & { email: string }>;
  toPayload: (c: Contract) => ContractPDFData;
}) {
  const totalMeses = monthsBetween(contract.start_date, contract.end_date);
  const restantes = monthsRemaining(contract.end_date);
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [aplicarMulta, setAplicarMulta] = useState(restantes > 0);
  const [devolverCaucao, setDevolverCaucao] = useState((contract.deposit_amount ?? 0) > 0);
  const [caucaoValor, setCaucaoValor] = useState(contract.deposit_amount ?? 0);
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);

  const multaPreview = aplicarMulta && totalMeses > 0
    ? (contract.rent_amount / totalMeses) * restantes
    : 0;

  async function gerar() {
    setLoading(true);
    try {
      const owner = await loadOwner();
      const dist: DistratoData = {
        end_date: endDate,
        meses_restantes: restantes,
        aplicar_multa: aplicarMulta,
        devolver_caucao: devolverCaucao,
        caucao_valor: caucaoValor,
        observacoes: obs,
      };
      baixarDistrato(contract.property?.nickname ?? "contrato", toPayload(contract), owner, dist);
      toast.success("Distrato gerado");
      onClose();
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open onOpenChange={(b) => !b && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Gerar distrato</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <p><b>Contrato:</b> {contract.property?.nickname} · {contract.tenant?.full_name}</p>
            <p className="text-muted-foreground text-xs mt-1">
              Vigência original: {formatDate(contract.start_date)} → {formatDate(contract.end_date)} ({totalMeses} meses) · {restantes} mês(es) restantes
            </p>
          </div>
          <div className="space-y-1">
            <Label>Data de encerramento</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={aplicarMulta} onCheckedChange={(b) => setAplicarMulta(Boolean(b))} />
            <span>Aplicar multa por rescisão antecipada — proporcional: <b>{formatBRL(multaPreview)}</b></span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={devolverCaucao} onCheckedChange={(b) => setDevolverCaucao(Boolean(b))} />
            <span>Devolver caução ao inquilino</span>
          </label>
          {devolverCaucao && (
            <div className="space-y-1">
              <Label>Valor da caução (R$)</Label>
              <Input type="number" step="0.01" value={caucaoValor} onChange={(e) => setCaucaoValor(Number(e.target.value) || 0)} />
            </div>
          )}
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: vistoria de saída realizada, sem pendências." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={gerar} disabled={loading}><FileDown className="h-4 w-4" /> Baixar distrato</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
