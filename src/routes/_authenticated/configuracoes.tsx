import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, MapPin, Landmark, Zap, Bell, Palette, ShieldCheck, UserCog } from "lucide-react";
import { BrandingTab } from "@/components/branding-tab";
import { SecurityTab } from "@/components/security-tab";
import { TeamTab } from "@/components/team-tab";
import { useMyPlan } from "@/components/plan-limit-guard";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";



export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — AlugaFlow" }] }),
  component: ConfigPage,
});

const schema = z.object({
  full_name: z.string().min(1, "Obrigatório").max(150),
  phone: z.string().max(30).optional().or(z.literal("")),
  cpf: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").max(200).optional().or(z.literal("")),
  address_street: z.string().max(200).optional().or(z.literal("")),
  address_number: z.string().max(20).optional().or(z.literal("")),
  address_neighborhood: z.string().max(120).optional().or(z.literal("")),
  address_city: z.string().max(120).optional().or(z.literal("")),
  address_uf: z.string().max(2).optional().or(z.literal("")),
  address_zip: z.string().max(15).optional().or(z.literal("")),
  bank_name: z.string().max(120).optional().or(z.literal("")),
  bank_agency: z.string().max(30).optional().or(z.literal("")),
  bank_account: z.string().max(30).optional().or(z.literal("")),
  pix_key: z.string().max(200).optional().or(z.literal("")),
  asaas_api_key: z.string().max(500).optional().or(z.literal("")),
  asaas_environment: z.enum(["sandbox", "production"]),
  auto_charge_enabled: z.boolean(),
  auto_charge_days_before: z.coerce.number().int().min(1).max(15),
  auto_charge_message: z.string().max(500).optional().or(z.literal("")),
});
type Values = z.infer<typeof schema>;

function ConfigPage() {
  const qc = useQueryClient();
  const [testing, setTesting] = useState(false);
  const { data: planInfo } = useMyPlan();
  const isMember = planInfo?.role === "member";
  const showTeamTab = (planInfo?.maxUsers ?? 1) > 1 && !isMember;
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "pessoal";
    const params = new URLSearchParams(window.location.search);
    return params.has("currentPassword") || params.has("newPassword") || params.has("confirm")
      ? "seguranca"
      : "pessoal";
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sensitiveParams = ["currentPassword", "newPassword", "confirm"];
    const hasSensitiveParams = sensitiveParams.some((param) => params.has(param));
    if (!hasSensitiveParams) return;

    sensitiveParams.forEach((param) => params.delete(param));
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`,
    );
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { data, error } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (error) throw error;
      return { profile: data, email: u.user.email ?? "", userId: u.user.id };
    },
  });

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "", phone: "", cpf: "", email: "",
      address_street: "", address_number: "", address_neighborhood: "",
      address_city: "", address_uf: "", address_zip: "",
      bank_name: "", bank_agency: "", bank_account: "", pix_key: "",
      asaas_api_key: "", asaas_environment: "sandbox",
      auto_charge_enabled: false, auto_charge_days_before: 3, auto_charge_message: "",
    },
  });

  useEffect(() => {
    if (!data) return;
    const p = (data.profile ?? {}) as Partial<Values> & Record<string, unknown>;
    form.reset({
      full_name: (p.full_name as string) ?? "",
      phone: (p.phone as string) ?? "",
      cpf: (p.cpf as string) ?? "",
      email: (p.email as string) ?? data.email ?? "",
      address_street: (p.address_street as string) ?? "",
      address_number: (p.address_number as string) ?? "",
      address_neighborhood: (p.address_neighborhood as string) ?? "",
      address_city: (p.address_city as string) ?? "",
      address_uf: (p.address_uf as string) ?? "",
      address_zip: (p.address_zip as string) ?? "",
      bank_name: (p.bank_name as string) ?? "",
      bank_agency: (p.bank_agency as string) ?? "",
      bank_account: (p.bank_account as string) ?? "",
      pix_key: (p.pix_key as string) ?? "",
      asaas_api_key: (p.asaas_api_key as string) ?? "",
      asaas_environment: ((p.asaas_environment as Values["asaas_environment"]) ?? "sandbox"),
      auto_charge_enabled: Boolean(p.auto_charge_enabled),
      auto_charge_days_before: Number(p.auto_charge_days_before ?? 3),
      auto_charge_message: (p.auto_charge_message as string) ?? "",
    });
  }, [data, form]);

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const payload: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        if (typeof val === "boolean" || typeof val === "number") payload[k] = val;
        else payload[k] = val === "" || val == null ? null : String(val);
      }
      const { error } = await supabase.from("profiles").update(payload as never).eq("id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Configurações salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testSend = async () => {
    if (!data?.userId) return;
    setTesting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("send-charges", {
        body: { user_id: data.userId },
      });
      if (error) throw error;
      const r = res as { created?: number; failed?: number; results?: Array<{ checked?: number }> };
      const checked = r.results?.[0]?.checked ?? 0;
      toast.success(`Teste concluído — ${checked} pagamento(s) elegível(is), ${r.created ?? 0} cobrança(s) criada(s), ${r.failed ?? 0} falha(s)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados do proprietário, bancários e integração ASAAS.</p>
      </div>

      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap justify-center h-auto gap-1 w-full">
            <TabsTrigger value="pessoal" className="gap-1.5"><User className="h-4 w-4" />Dados pessoais</TabsTrigger>
            <TabsTrigger value="endereco" className="gap-1.5"><MapPin className="h-4 w-4" />Endereço</TabsTrigger>
            {!isMember && <TabsTrigger value="bancario" className="gap-1.5"><Landmark className="h-4 w-4" />Dados bancários</TabsTrigger>}
            {!isMember && <TabsTrigger value="asaas" className="gap-1.5"><Zap className="h-4 w-4" />Integração ASAAS</TabsTrigger>}
            {!isMember && <TabsTrigger value="automacao" className="gap-1.5"><Bell className="h-4 w-4" />Automação</TabsTrigger>}
            {!isMember && <TabsTrigger value="identidade" className="gap-1.5"><Palette className="h-4 w-4" />Identidade visual</TabsTrigger>}
            <TabsTrigger value="seguranca" className="gap-1.5"><ShieldCheck className="h-4 w-4" />Segurança</TabsTrigger>
            {showTeamTab && <TabsTrigger value="equipe" className="gap-1.5"><UserCog className="h-4 w-4" />Equipe</TabsTrigger>}
          </TabsList>

          <TabsContent value="pessoal">
            <Card>
              <CardHeader><CardTitle>Dados pessoais</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome completo *" error={form.formState.errors.full_name?.message}><Input {...form.register("full_name")} /></Field>
                <Field label="CPF"><Input {...form.register("cpf")} placeholder="000.000.000-00" /></Field>
                <Field label="Telefone"><Input {...form.register("phone")} /></Field>
                <Field label="E-mail">
                  <Input
                    type="email"
                    value={form.watch("email") ?? ""}
                    readOnly
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Para alterar o e-mail, acesse a aba <strong>Segurança</strong>.
                  </p>
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="endereco">
            <Card>
              <CardHeader><CardTitle>Endereço</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-6">
                <div className="sm:col-span-4"><Field label="Rua"><Input {...form.register("address_street")} /></Field></div>
                <div className="sm:col-span-2"><Field label="Número"><Input {...form.register("address_number")} /></Field></div>
                <div className="sm:col-span-3"><Field label="Bairro"><Input {...form.register("address_neighborhood")} /></Field></div>
                <div className="sm:col-span-2"><Field label="Cidade"><Input {...form.register("address_city")} /></Field></div>
                <div className="sm:col-span-1"><Field label="UF"><Input maxLength={2} {...form.register("address_uf")} /></Field></div>
                <div className="sm:col-span-2"><Field label="CEP"><Input {...form.register("address_zip")} /></Field></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bancario">
            <Card>
              <CardHeader><CardTitle>Dados bancários</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Banco"><Input {...form.register("bank_name")} /></Field>
                <Field label="Agência"><Input {...form.register("bank_agency")} /></Field>
                <Field label="Conta"><Input {...form.register("bank_account")} /></Field>
                <Field label="Chave PIX"><Input {...form.register("pix_key")} /></Field>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="asaas">
            <Card>
              <CardHeader>
                <CardTitle>Integração ASAAS</CardTitle>
                <CardDescription>
                  Use o ASAAS para emitir cobranças com <strong>boleto + PIX (QR Code no mesmo documento)</strong> e baixa automática quando pago.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <AsaasPlanGate />
                <div className="sm:col-span-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
                  <p className="font-medium">Ainda não tem conta no ASAAS?</p>
                  <p className="mt-1 text-muted-foreground">
                    Abra a sua usando nosso link de parceiro — é grátis para criar e você só paga a taxa por cobrança emitida.
                  </p>
                  <a
                    href="https://www.asaas.com/r/bfe686ed-5f21-4af9-8959-5b1523325d93"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Abrir conta no ASAAS
                  </a>
                </div>
                <div className="sm:col-span-2 rounded-md border bg-muted/40 p-3 text-sm space-y-2">
                  <p className="font-medium">URL do Webhook (configure no painel do ASAAS)</p>
                  <p className="text-xs text-muted-foreground">
                    No ASAAS, vá em <strong>Integrações → Webhooks</strong> e cadastre a URL abaixo para receber a baixa automática das cobranças pagas (boleto e PIX).
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="flex-1 min-w-0 break-all rounded bg-background border px-2 py-1 text-xs">
                      https://fmifbxrqbwkyjgkgceyh.supabase.co/functions/v1/asaas-webhook
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText("https://fmifbxrqbwkyjgkgceyh.supabase.co/functions/v1/asaas-webhook");
                        toast.success("URL copiada");
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A identificação do proprietário é automática: cada cobrança criada pelo AlugaFlow guarda o <code>asaas_payment_id</code> vinculado ao seu pagamento, e o webhook usa esse ID para baixar o pagamento correto — não importa de qual conta ASAAS o evento veio.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <Field label="ASAAS API Key">
                    <Input type="password" autoComplete="off" placeholder="$aact_..." {...form.register("asaas_api_key")} />
                  </Field>
                </div>
                <Field label="Ambiente">
                  <Select value={form.watch("asaas_environment")} onValueChange={(v) => form.setValue("asaas_environment", v as Values["asaas_environment"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox (teste)</SelectItem>
                      <SelectItem value="production">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automacao">
            <Card>
              <CardHeader>
                <CardTitle>Automação de cobranças</CardTitle>
                <CardDescription>
                  Quando ativada, o sistema verifica diariamente os pagamentos pendentes e gera a cobrança no ASAAS X dias antes do vencimento.
                  O ASAAS envia o boleto e PIX por e-mail diretamente ao inquilino.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border p-3 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium">Enviar cobranças automaticamente</p>
                    <p className="text-xs text-muted-foreground">Requer chave ASAAS configurada na aba anterior.</p>
                  </div>
                  <Switch
                    checked={form.watch("auto_charge_enabled")}
                    onCheckedChange={(b) => form.setValue("auto_charge_enabled", b)}
                  />
                </div>
                <Field label="Dias antes do vencimento">
                  <Select
                    value={String(form.watch("auto_charge_days_before"))}
                    onValueChange={(v) => form.setValue("auto_charge_days_before", Number(v))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 5, 7].map((d) => <SelectItem key={d} value={String(d)}>{d} dia(s)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Mensagem personalizada (anexada à descrição da cobrança)">
                    <Textarea
                      rows={3}
                      placeholder="Ex.: Olá, segue o boleto referente ao aluguel. Em caso de dúvidas, fale conosco no WhatsApp."
                      {...form.register("auto_charge_message")}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Button type="button" variant="outline" onClick={testSend} disabled={testing}>
                    <PlayCircle className="h-4 w-4" />
                    {testing ? "Testando..." : "Testar envio agora"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="identidade">
            <BrandingTab />
          </TabsContent>

          <TabsContent value="seguranca">
            <SecurityTab />
          </TabsContent>

          {showTeamTab && (
            <TabsContent value="equipe">
              <TeamTab />
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end sticky bottom-0 bg-background/80 backdrop-blur py-3">
          <Button type="button" onClick={form.handleSubmit((v) => save.mutate(v))} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar configurações"}</Button>
        </div>
      </div>
    </div>

  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function AsaasPlanGate() {
  const { data } = useMyPlan();
  if (!data || data.plan !== "free") return null;
  return (
    <div className="sm:col-span-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="font-medium flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-600" /> Recurso do plano Investidor</p>
      <p className="mt-1 text-amber-900/80">A integração ASAAS está disponível a partir do plano Investidor. Faça upgrade para emitir cobranças automáticas.</p>
      <Link to="/minha-conta/plano" className="mt-2 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Ver planos
      </Link>
    </div>
  );
}
