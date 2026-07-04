import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, FileDown, Copy, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PropertyCover } from "@/components/property-cover";
import { downloadContractPDF, type ContractPDFData, type OwnerProfile, type ExtraCharge } from "@/lib/contract-pdf";
import { gerarContratoResidencial, gerarContratoLocacaoCompleto } from "@/lib/contract-templates";
import { TEMPLATE_LOCACAO_DINAMICO } from "@/lib/contract-tokens";
import { ContractEditor } from "@/components/contract-editor";
import { formatBRL, formatDate } from "@/lib/format";
import { createSignatureInvites } from "@/lib/signatures.functions";
import { createAsaasChargesForContract } from "@/lib/asaas.functions";

type TemplateId = "editor_dinamico" | "padrao_11" | "completo_20" | "residencial_20";
const TEMPLATES: Array<{ id: TemplateId; label: string; desc: string }> = [
  { id: "editor_dinamico", label: "Editor com campos dinâmicos", desc: "Edite o texto livremente, insira variáveis [token] e pré-visualize com os dados preenchidos." },
  { id: "padrao_11", label: "Padrão (11 cláusulas, Lei 8.245/91)", desc: "Modelo enxuto, cobre obrigações essenciais." },
  { id: "completo_20", label: "Locação completo (20 cláusulas) — Residencial/Comercial", desc: "Modelo robusto com LGPD, sinistros, sublocação, alienação e foro." },
  { id: "residencial_20", label: "Locação Residencial (20 cláusulas)", desc: "Modelo específico residencial com cláusulas estendidas." },
];

const STEPS = ["Imóvel", "Detalhes", "Participantes", "Garantia", "Documento", "Assinatura"] as const;

type WizardState = {
  property_id: string;
  contract_type: "residencial" | "comercial";
  months: number;
  start_date: string;
  end_date: string;
  rent_amount: number;
  due_day: number;
  adjustment_index: "nenhum" | "igpm" | "ipca";
  adjustment_frequency_months: number;
  extra_charges: ExtraCharge[];
  tenant_id: string;
  add_guarantor: boolean;
  guarantor_name: string;
  guarantor_cpf: string;
  guarantor_rg: string;
  guarantor_email: string;
  guarantor_phone: string;
  guarantor_address: string;
  guarantee_type: "sem_garantia" | "fiador" | "caucao" | "seguro_fianca";
  guarantee_months: number;
  signature_mode: "manual" | "eletronica";
  payment_method: "pix" | "asaas";
  deposit_amount: number;
  notes: string;
};

const initialState: WizardState = {
  property_id: "", contract_type: "residencial", months: 12,
  start_date: new Date().toISOString().slice(0, 10), end_date: "",
  rent_amount: 0, due_day: 5,
  adjustment_index: "igpm", adjustment_frequency_months: 12, extra_charges: [],
  tenant_id: "", add_guarantor: false,
  guarantor_name: "", guarantor_cpf: "", guarantor_rg: "", guarantor_email: "", guarantor_phone: "", guarantor_address: "",
  guarantee_type: "sem_garantia", guarantee_months: 1,
  signature_mode: "manual", payment_method: "pix", deposit_amount: 0, notes: "",
};

function addMonths(iso: string, months: number): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function ContractWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(initialState);
  const [templateId, setTemplateId] = useState<TemplateId>("editor_dinamico");
  const [editorText, setEditorText] = useState<string>(TEMPLATE_LOCACAO_DINAMICO);
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [signatureLinks, setSignatureLinks] = useState<Array<{ role: string; name: string; email: string; url: string }>>([]);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setStep(0); setState(initialState); setTemplateId("editor_dinamico");
      setEditorText(TEMPLATE_LOCACAO_DINAMICO);
      setCreatedContractId(null); setSignatureLinks([]);
    }
  }, [open]);

  // Auto-compute end_date from start + months
  useEffect(() => {
    if (state.start_date && state.months > 0) {
      const end = addMonths(state.start_date, state.months);
      if (end !== state.end_date) setState((s) => ({ ...s, end_date: end }));
    }
  }, [state.start_date, state.months]); // eslint-disable-line

  const { data: properties = [] } = useQuery({
    queryKey: ["properties", "wizard"],
    queryFn: async () => (await supabase.from("properties").select("id, nickname, address, city, state, type").order("nickname")).data ?? [],
  });
  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants", "wizard"],
    queryFn: async () => (await supabase.from("tenants").select("id, full_name, cpf, email").order("full_name")).data ?? [],
  });
  const { data: ownerProfile } = useQuery({
    queryKey: ["profile", "wizard"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { ...(data ?? {}), email: u.user.email ?? "" } as OwnerProfile & { email: string };
    },
  });

  const selectedProperty = properties.find((p) => p.id === state.property_id);
  const selectedTenant = tenants.find((t) => t.id === state.tenant_id);

  function patch<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  // Step validators
  const stepValidators: (() => string | null)[] = [
    () => state.property_id ? null : "Selecione um imóvel",
    () => {
      try {
        z.object({
          contract_type: z.enum(["residencial", "comercial"]),
          months: z.number().int().min(1).max(120),
          start_date: z.string().min(10),
          end_date: z.string().min(10),
          rent_amount: z.number().positive("Informe o valor do aluguel"),
          due_day: z.number().int().min(1).max(28),
        }).parse({
          contract_type: state.contract_type, months: state.months,
          start_date: state.start_date, end_date: state.end_date,
          rent_amount: state.rent_amount, due_day: state.due_day,
        });
        return null;
      } catch (e) { return (e as z.ZodError).errors[0]?.message ?? "Preencha os campos"; }
    },
    () => {
      if (!state.tenant_id) return "Selecione um inquilino";
      if (state.add_guarantor) {
        if (!state.guarantor_name || !state.guarantor_cpf) return "Preencha nome e CPF do fiador";
      }
      return null;
    },
    () => {
      if (state.guarantee_type === "caucao" && (state.guarantee_months < 1 || state.guarantee_months > 3)) return "Caução: 1 a 3 meses";
      if (state.guarantee_type === "fiador" && !state.add_guarantor) return "Volte ao passo 3 e adicione um fiador";
      return null;
    },
    () => null,
    () => null,
  ];

  function next() {
    const err = stepValidators[step]();
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  // Build contract payload for save / PDF
  const contractPayload = useMemo<ContractPDFData>(() => ({
    contract_type: state.contract_type,
    property: selectedProperty ? {
      nickname: selectedProperty.nickname, address: selectedProperty.address,
      city: selectedProperty.city, state: selectedProperty.state, type: selectedProperty.type,
    } : undefined,
    tenant: selectedTenant ? {
      full_name: selectedTenant.full_name, cpf: selectedTenant.cpf, email: selectedTenant.email,
    } : undefined,
    guarantor: state.add_guarantor ? {
      name: state.guarantor_name, cpf: state.guarantor_cpf, rg: state.guarantor_rg,
      email: state.guarantor_email, phone: state.guarantor_phone, address: state.guarantor_address,
    } : null,
    start_date: state.start_date, end_date: state.end_date,
    rent_amount: state.rent_amount, due_day: state.due_day,
    deposit_amount: state.deposit_amount,
    adjustment_index: state.adjustment_index,
    adjustment_frequency_months: state.adjustment_frequency_months,
    guarantee_type: state.guarantee_type,
    guarantee_months: state.guarantee_type === "caucao" ? state.guarantee_months : null,
    extra_charges: state.extra_charges,
    notes: state.notes,
  }), [state, selectedProperty, selectedTenant]);

  function previewPDF() {
    if (!ownerProfile) return;
    const name = selectedProperty?.nickname ?? "contrato";
    if (templateId === "completo_20") {
      gerarContratoLocacaoCompleto(contractPayload, ownerProfile).save(`contrato-${name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } else if (templateId === "residencial_20") {
      gerarContratoResidencial(contractPayload, ownerProfile).save(`contrato-${name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
    } else {
      downloadContractPDF(name, contractPayload, ownerProfile);
    }
  }

  // Save contract (creates payments via existing buildMonthlyPayments logic inline)
  const saveContract = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const payload = {
        user_id: u.user.id,
        property_id: state.property_id,
        tenant_id: state.tenant_id,
        start_date: state.start_date,
        end_date: state.end_date,
        rent_amount: state.rent_amount,
        due_day: state.due_day,
        deposit_amount: state.deposit_amount ?? 0,
        status: "ativo" as const,
        adjustment_index: state.adjustment_index,
        adjustment_frequency_months: state.adjustment_frequency_months,
        guarantee_type: state.guarantee_type,
        guarantee_months: state.guarantee_type === "caucao" ? state.guarantee_months : null,
        contract_type: state.contract_type,
        extra_charges: state.extra_charges,
        guarantor_name: state.add_guarantor ? state.guarantor_name : null,
        guarantor_cpf: state.add_guarantor ? state.guarantor_cpf : null,
        guarantor_rg: state.add_guarantor ? state.guarantor_rg : null,
        guarantor_email: state.add_guarantor ? state.guarantor_email : null,
        guarantor_phone: state.add_guarantor ? state.guarantor_phone : null,
        guarantor_address: state.add_guarantor ? state.guarantor_address : null,
        signature_mode: state.signature_mode,
        signature_status: state.signature_mode === "manual" ? "pendente" : "pendente",
        payment_method: state.payment_method,
        notes: state.notes || null,
      };
      const { data: ins, error } = await supabase.from("contracts").insert(payload).select("id").single();
      if (error) throw error;

      // payments
      const payments = buildMonthlyPayments({
        contract_id: ins.id, user_id: u.user.id,
        start_date: state.start_date, end_date: state.end_date,
        due_day: state.due_day, amount: state.rent_amount,
      });
      if (payments.length > 0) await supabase.from("payments").insert(payments);

      // Auto-criar cobranças ASAAS para todo o período do contrato
      let asaasCreated = 0; let asaasFailed = 0; let asaasErr = "";
      if (state.payment_method === "asaas" && payments.length > 0) {
        try {
          const r = await createAsaasChargesForContract({ data: { contractId: ins.id } });
          asaasCreated = r.created; asaasFailed = r.failed; asaasErr = r.errors.join(" | ");
        } catch (e) { asaasErr = (e as Error).message; asaasFailed = payments.length; }
      }
      return { id: ins.id, count: payments.length, asaasCreated, asaasFailed, asaasErr };
    },
    onSuccess: (r) => {
      setCreatedContractId(r.id);
      qc.invalidateQueries({ queryKey: ["contracts"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      toast.success(`Contrato criado — ${r.count} pagamentos gerados`);
      if (r.asaasCreated > 0) toast.success(`${r.asaasCreated} cobrança(s) criadas no ASAAS`);
      if (r.asaasFailed > 0) toast.error(`ASAAS: ${r.asaasFailed} falha(s) — ${r.asaasErr}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Send electronic signature invites
  const sendInvites = useMutation({
    mutationFn: async (contractId: string) => {
      const signers: Array<{ role: "locador" | "locatario" | "fiador"; name: string; email: string }> = [];
      if (ownerProfile?.full_name && ownerProfile.email) {
        signers.push({ role: "locador", name: ownerProfile.full_name, email: ownerProfile.email });
      }
      if (selectedTenant?.full_name && selectedTenant.email) {
        signers.push({ role: "locatario", name: selectedTenant.full_name, email: selectedTenant.email });
      }
      if (state.add_guarantor && state.guarantor_name && state.guarantor_email) {
        signers.push({ role: "fiador", name: state.guarantor_name, email: state.guarantor_email });
      }
      if (signers.length < 2) throw new Error("Cadastre email do proprietário (Configurações) e inquilino para enviar.");
      const res = await createSignatureInvites({ data: { contractId, signers } });
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      return res.signatures.map((s) => ({
        role: s.role, name: s.name, email: s.email,
        url: `${origin}/assinar/${s.token}`,
      }));
    },
    onSuccess: (links) => {
      setSignatureLinks(links);
      toast.success("Links de assinatura gerados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function finishManual() {
    await saveContract.mutateAsync();
    previewPDF();
    onOpenChange(false);
  }

  async function finishElectronic() {
    const r = await saveContract.mutateAsync();
    await sendInvites.mutateAsync(r.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            {STEPS.map((s, i) => (
              <div key={s} className={`flex items-center gap-1 ${i <= step ? "text-primary font-medium" : "text-muted-foreground"}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${i < step ? "bg-primary text-primary-foreground" : i === step ? "border-2 border-primary" : "border"}`}>
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{s}</span>
              </div>
            ))}
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} />
        </div>

        <div className="mt-4 min-h-[300px]">
          {step === 0 && <StepProperty properties={properties} value={state.property_id} onChange={(v) => patch("property_id", v)} />}
          {step === 1 && <StepDetails state={state} patch={patch} />}
          {step === 2 && <StepParticipants state={state} patch={patch} tenants={tenants} owner={ownerProfile ?? null} />}
          {step === 3 && <StepGuarantee state={state} patch={patch} />}
          {step === 4 && <StepDocument payload={contractPayload} owner={ownerProfile ?? null} onPreview={previewPDF} templateId={templateId} onTemplateChange={setTemplateId} editorText={editorText} onEditorTextChange={setEditorText} />}
          {step === 5 && (
            <StepSignature
              state={state}
              patch={patch}
              createdContractId={createdContractId}
              saving={saveContract.isPending}
              sending={sendInvites.isPending}
              links={signatureLinks}
              onManual={finishManual}
              onElectronic={finishElectronic}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>

        <div className="mt-6 flex justify-between border-t pt-4">
          <Button type="button" variant="outline" onClick={back} disabled={step === 0 || saveContract.isPending}>
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>Próximo <ChevronRight className="h-4 w-4" /></Button>
          ) : (
            <span />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== Steps =====

function StepProperty({ properties, value, onChange }: { properties: Array<{ id: string; nickname: string; address: string; city: string | null; state: string | null; type: string }>; value: string; onChange: (v: string) => void }) {
  if (properties.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-10">Cadastre um imóvel antes de criar um contrato.</p>;
  }
  return (
    <div>
      <h3 className="font-semibold mb-1">Escolha o imóvel</h3>
      <p className="text-sm text-muted-foreground mb-4">Selecione o imóvel que será locado neste contrato.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {properties.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent ${value === p.id ? "border-primary ring-2 ring-primary/30" : ""}`}
          >
            <PropertyCover propertyId={p.id} className="h-14 w-20 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate">{p.nickname}</p>
              <p className="text-xs text-muted-foreground truncate">{p.address}{p.city ? `, ${p.city}/${p.state ?? ""}` : ""}</p>
              <Badge variant="secondary" className="mt-1 capitalize text-[10px]">{p.type}</Badge>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepDetails({ state, patch }: { state: WizardState; patch: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  function addExtra() { patch("extra_charges", [...state.extra_charges, { label: "", amount: 0 }]); }
  function updateExtra(i: number, key: "label" | "amount", v: string) {
    const copy = [...state.extra_charges];
    copy[i] = { ...copy[i], [key]: key === "amount" ? Number(v) || 0 : v };
    patch("extra_charges", copy);
  }
  function removeExtra(i: number) { patch("extra_charges", state.extra_charges.filter((_, idx) => idx !== i)); }
  function quickAdd(label: string) {
    if (!state.extra_charges.find((e) => e.label === label)) {
      patch("extra_charges", [...state.extra_charges, { label, amount: 0 }]);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Detalhes do contrato</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={state.contract_type} onValueChange={(v) => patch("contract_type", v as WizardState["contract_type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="residencial">Residencial</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Prazo (meses) *</Label>
          <Input type="number" min={1} max={120} value={state.months} onChange={(e) => patch("months", Number(e.target.value) || 0)} />
        </div>
        <div className="space-y-1">
          <Label>Início *</Label>
          <Input type="date" value={state.start_date} onChange={(e) => patch("start_date", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Término (calculado)</Label>
          <Input type="date" value={state.end_date} onChange={(e) => patch("end_date", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Valor do aluguel (R$) *</Label>
          <Input type="number" step="0.01" value={state.rent_amount} onChange={(e) => patch("rent_amount", Number(e.target.value) || 0)} />
        </div>
        <div className="space-y-1">
          <Label>Dia do vencimento (1-28) *</Label>
          <Input type="number" min={1} max={28} value={state.due_day} onChange={(e) => patch("due_day", Number(e.target.value) || 1)} />
        </div>
        <div className="space-y-1">
          <Label>Índice de reajuste</Label>
          <Select value={state.adjustment_index} onValueChange={(v) => patch("adjustment_index", v as WizardState["adjustment_index"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Nenhum</SelectItem>
              <SelectItem value="igpm">IGP-M</SelectItem>
              <SelectItem value="ipca">IPCA</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Frequência reajuste (meses)</Label>
          <Input type="number" min={1} max={60} value={state.adjustment_frequency_months} onChange={(e) => patch("adjustment_frequency_months", Number(e.target.value) || 12)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Depósito caução adicional (R$)</Label>
          <Input type="number" step="0.01" value={state.deposit_amount} onChange={(e) => patch("deposit_amount", Number(e.target.value) || 0)} />
        </div>
      </div>

      <div className="space-y-2 pt-2">
        <Label className="text-base">Forma de cobrança</Label>
        <RadioGroup value={state.payment_method} onValueChange={(v) => patch("payment_method", v as WizardState["payment_method"])} className="grid gap-2 sm:grid-cols-2">
          <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent ${state.payment_method === "pix" ? "border-primary ring-2 ring-primary/30" : ""}`}>
            <RadioGroupItem value="pix" className="mt-1" />
            <div><p className="font-medium text-sm">PIX / Transferência</p><p className="text-xs text-muted-foreground">Cobrança manual. Você marca cada pagamento como pago.</p></div>
          </label>
          <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent ${state.payment_method === "asaas" ? "border-primary ring-2 ring-primary/30" : ""}`}>
            <RadioGroupItem value="asaas" className="mt-1" />
            <div><p className="font-medium text-sm">Boleto ASAAS (automático)</p><p className="text-xs text-muted-foreground">Ao salvar, cria cliente e gera cobranças para todo o período. Boleto enviado ao e-mail do inquilino.</p></div>
          </label>
        </RadioGroup>
      </div>


      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between">
          <Label className="text-base">Cobranças adicionais mensais</Label>
          <Button type="button" size="sm" variant="outline" onClick={addExtra}><Plus className="h-3 w-3" /> Adicionar</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {["IPTU", "Condomínio", "Água", "Luz", "Gás"].map((l) => (
            <Button key={l} type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => quickAdd(l)}>+ {l}</Button>
          ))}
        </div>
        {state.extra_charges.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma cobrança adicional.</p>
        ) : (
          <div className="space-y-2">
            {state.extra_charges.map((e, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Descrição (ex: IPTU)" value={e.label} onChange={(ev) => updateExtra(i, "label", ev.target.value)} />
                <Input type="number" step="0.01" placeholder="Valor" className="w-32" value={e.amount} onChange={(ev) => updateExtra(i, "amount", ev.target.value)} />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeExtra(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StepParticipants({ state, patch, tenants, owner }: {
  state: WizardState;
  patch: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  tenants: Array<{ id: string; full_name: string; cpf: string | null; email: string | null }>;
  owner: (OwnerProfile & { email?: string }) | null;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold mb-2">Proprietário (Locador)</h3>
        <Card><CardContent className="p-3 text-sm space-y-1">
          <p><span className="text-muted-foreground">Nome:</span> {owner?.full_name ?? "— (preencha em Configurações)"}</p>
          <p><span className="text-muted-foreground">CPF:</span> {owner?.cpf ?? "—"}</p>
          <p><span className="text-muted-foreground">E-mail:</span> {owner?.email ?? "—"}</p>
        </CardContent></Card>
      </div>

      <div>
        <h3 className="font-semibold mb-2">Inquilino (Locatário) *</h3>
        <Select value={state.tenant_id} onValueChange={(v) => patch("tenant_id", v)}>
          <SelectTrigger><SelectValue placeholder="Selecione um inquilino cadastrado" /></SelectTrigger>
          <SelectContent>
            {tenants.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}{t.cpf ? ` — CPF ${t.cpf}` : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Fiador (opcional)</h3>
          <Button type="button" size="sm" variant={state.add_guarantor ? "secondary" : "outline"} onClick={() => patch("add_guarantor", !state.add_guarantor)}>
            {state.add_guarantor ? "Remover fiador" : "+ Adicionar fiador"}
          </Button>
        </div>
        {state.add_guarantor && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Nome completo *" value={state.guarantor_name} onChange={(e) => patch("guarantor_name", e.target.value)} />
            <Input placeholder="CPF *" value={state.guarantor_cpf} onChange={(e) => patch("guarantor_cpf", e.target.value)} />
            <Input placeholder="RG" value={state.guarantor_rg} onChange={(e) => patch("guarantor_rg", e.target.value)} />
            <Input placeholder="Telefone" value={state.guarantor_phone} onChange={(e) => patch("guarantor_phone", e.target.value)} />
            <Input placeholder="E-mail" type="email" className="sm:col-span-2" value={state.guarantor_email} onChange={(e) => patch("guarantor_email", e.target.value)} />
            <Input placeholder="Endereço" className="sm:col-span-2" value={state.guarantor_address} onChange={(e) => patch("guarantor_address", e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
}

function StepGuarantee({ state, patch }: { state: WizardState; patch: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Tipo de garantia</h3>
      <RadioGroup value={state.guarantee_type} onValueChange={(v) => patch("guarantee_type", v as WizardState["guarantee_type"])} className="space-y-2">
        {[
          { v: "sem_garantia", l: "Sem garantia", d: "Locação sem exigência de garantia." },
          { v: "fiador", l: "Fiador", d: "Garantia prestada por terceiro (cadastrado no passo 3)." },
          { v: "caucao", l: "Caução em dinheiro", d: "Depósito de 1 a 3 aluguéis (art. 38 Lei 8.245/91)." },
          { v: "seguro_fianca", l: "Seguro fiança", d: "Apólice contratada pelo locatário em seguradora." },
        ].map((o) => (
          <label key={o.v} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent ${state.guarantee_type === o.v ? "border-primary ring-2 ring-primary/30" : ""}`}>
            <RadioGroupItem value={o.v} className="mt-1" />
            <div><p className="font-medium">{o.l}</p><p className="text-xs text-muted-foreground">{o.d}</p></div>
          </label>
        ))}
      </RadioGroup>
      {state.guarantee_type === "caucao" && (
        <div className="space-y-1 max-w-xs">
          <Label>Quantidade de meses (1-3)</Label>
          <Input type="number" min={1} max={3} value={state.guarantee_months} onChange={(e) => patch("guarantee_months", Math.min(3, Math.max(1, Number(e.target.value) || 1)))} />
          <p className="text-xs text-muted-foreground">Total: {formatBRL((state.guarantee_months || 0) * state.rent_amount)}</p>
        </div>
      )}
    </div>
  );
}

function StepDocument({
  payload, owner, onPreview, templateId, onTemplateChange, editorText, onEditorTextChange,
}: {
  payload: ContractPDFData;
  owner: OwnerProfile | null;
  onPreview: () => void;
  templateId: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  editorText: string;
  onEditorTextChange: (v: string) => void;
}) {
  const tpl = TEMPLATES.find((t) => t.id === templateId);
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Documento</h3>
      <p className="text-sm text-muted-foreground">Escolha o modelo de contrato. As variáveis serão preenchidas automaticamente com os dados das etapas anteriores.</p>

      <div className="space-y-2">
        <Label>Modelo de contrato</Label>
        <Select value={templateId} onValueChange={(v) => onTemplateChange(v as TemplateId)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TEMPLATES.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tpl && <p className="text-xs text-muted-foreground">{tpl.desc}</p>}
      </div>

      {templateId === "editor_dinamico" ? (
        <ContractEditor payload={payload} owner={owner} value={editorText} onChange={onEditorTextChange} />
      ) : (
        <>
          <Card><CardContent className="p-4 text-sm space-y-1">
            <p><b>Imóvel:</b> {payload.property?.nickname} — {payload.property?.address}</p>
            <p><b>Inquilino:</b> {payload.tenant?.full_name}</p>
            {payload.guarantor?.name && <p><b>Fiador:</b> {payload.guarantor.name}</p>}
            <p><b>Vigência:</b> {formatDate(payload.start_date)} a {formatDate(payload.end_date)}</p>
            <p><b>Aluguel:</b> {formatBRL(payload.rent_amount)} — venc. dia {payload.due_day}</p>
            {payload.extra_charges && payload.extra_charges.length > 0 && (
              <p><b>Cobranças extras:</b> {payload.extra_charges.map((e) => `${e.label} (${formatBRL(e.amount)})`).join(", ")}</p>
            )}
            <p><b>Garantia:</b> {payload.guarantee_type}</p>
          </CardContent></Card>
          <Button type="button" variant="outline" onClick={onPreview}>
            <FileDown className="h-4 w-4" /> Visualizar PDF
          </Button>
        </>
      )}
    </div>
  );
}

function StepSignature({
  state, patch, createdContractId, saving, sending, links, onManual, onElectronic, onClose,
}: {
  state: WizardState;
  patch: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
  createdContractId: string | null;
  saving: boolean;
  sending: boolean;
  links: Array<{ role: string; name: string; email: string; url: string }>;
  onManual: () => void;
  onElectronic: () => void;
  onClose: () => void;
}) {
  if (createdContractId && links.length > 0) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-green-700">Contrato criado — convites de assinatura prontos</h3>
        <p className="text-sm text-muted-foreground">
          Envie os links abaixo para cada signatário. (Quando o domínio de email do projeto for configurado, esses links serão enviados automaticamente por email.)
        </p>
        <div className="space-y-2">
          {links.map((l) => (
            <Card key={l.url}><CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-sm">
                  <p className="font-medium capitalize">{l.role} — {l.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{l.email}</p>
                  <p className="text-xs font-mono mt-1 truncate text-primary">{l.url}</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(l.url); toast.success("Link copiado"); }}>
                  <Copy className="h-3 w-3" /> Copiar
                </Button>
              </div>
            </CardContent></Card>
          ))}
        </div>
        <Button type="button" onClick={onClose} className="w-full">Concluir</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Como deseja coletar as assinaturas?</h3>
      <RadioGroup value={state.signature_mode} onValueChange={(v) => patch("signature_mode", v as WizardState["signature_mode"])} className="space-y-2">
        <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent ${state.signature_mode === "manual" ? "border-primary ring-2 ring-primary/30" : ""}`}>
          <RadioGroupItem value="manual" className="mt-1" />
          <div><p className="font-medium">Manual</p><p className="text-xs text-muted-foreground">Baixar o PDF e coletar as assinaturas presencialmente.</p></div>
        </label>
        <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent ${state.signature_mode === "eletronica" ? "border-primary ring-2 ring-primary/30" : ""}`}>
          <RadioGroupItem value="eletronica" className="mt-1" />
          <div>
            <p className="font-medium">Eletrônica</p>
            <p className="text-xs text-muted-foreground">Gera um link único por signatário. Cada um confirma identidade (nome completo + CPF) e assina digitalmente, com registro de IP e timestamp (MP 2.200-2/2001).</p>
          </div>
        </label>
      </RadioGroup>

      {state.signature_mode === "manual" ? (
        <Button type="button" onClick={onManual} disabled={saving} className="w-full">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : <><FileDown className="h-4 w-4" /> Criar contrato e baixar PDF</>}
        </Button>
      ) : (
        <Button type="button" onClick={onElectronic} disabled={saving || sending} className="w-full">
          {(saving || sending) ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando convites…</> : <><Send className="h-4 w-4" /> Criar contrato e gerar links de assinatura</>}
        </Button>
      )}
    </div>
  );
}

// ===== Helpers =====

function buildMonthlyPayments(args: {
  contract_id: string; user_id: string; start_date: string; end_date: string; due_day: number; amount: number;
}) {
  const out: Array<{ contract_id: string; user_id: string; reference_month: string; due_date: string; amount: number; status: "pendente" }> = [];
  const start = new Date(args.start_date + "T00:00:00");
  const end = new Date(args.end_date + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return out;
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= last) {
    const y = cur.getFullYear(), m = cur.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = Math.min(args.due_day, lastDay);
    const due = `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const ref = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    out.push({ contract_id: args.contract_id, user_id: args.user_id, reference_month: ref, due_date: due, amount: args.amount, status: "pendente" });
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}
