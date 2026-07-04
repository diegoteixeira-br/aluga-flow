import { BrandLogo } from "@/components/brand-logo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { PasswordInput } from "@/components/password-input";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MailCheck } from "lucide-react";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Entrar — AlugaFlow" }] }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
const maskCPF = (s: string) => onlyDigits(s).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const maskCNPJ = (s: string) => onlyDigits(s).slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
function isValidCPF(cpf: string) {
  const d = onlyDigits(cpf);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(d[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10) r = 0; if (r !== parseInt(d[9])) return false;
  s = 0; for (let i = 0; i < 10; i++) s += parseInt(d[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10) r = 0; return r === parseInt(d[10]);
}
function isValidCNPJ(cnpj: string) {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const calc = (base: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + parseInt(base[i]) * w, 0);
    const r = sum % 11; return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
  return calc(d.slice(0,12), w1) === parseInt(d[12]) && calc(d.slice(0,13), w2) === parseInt(d[13]);
}

const signUpSchema = signInSchema.extend({
  full_name: z.string().trim().min(2, "Informe seu nome").max(100),
  profile_type: z.enum(["owner", "broker"], { errorMap: () => ({ message: "Selecione o tipo de perfil" }) }),
  document: z.string().min(1, "Informe o CPF ou CNPJ").refine((v) => {
    const d = onlyDigits(v);
    return (d.length === 11 && isValidCPF(d)) || (d.length === 14 && isValidCNPJ(d));
  }, "CPF ou CNPJ inválido"),
  creci: z.string().optional(),
  accept_terms: z.literal(true, { errorMap: () => ({ message: "Você precisa aceitar os Termos e a Política de Privacidade" }) }),
}).superRefine((val, ctx) => {
  if (val.profile_type === "broker" && !val.creci?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["creci"], message: "CRECI obrigatório para corretores" });
  }
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">(mode === "signup" ? "signup" : "signin");

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center">
          <BrandLogo size={48} />
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Bem-vindo</CardTitle>
            <CardDescription>Acesse sua conta ou crie uma nova.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-4"><SignInForm /></TabsContent>
              <TabsContent value="signup" className="mt-4"><SignUpForm onDone={() => setTab("signin")} /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const onSubmit = async (values: z.infer<typeof signInSchema>) => {
    setNeedsConfirm(null);
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("not confirmed") || msg.includes("email not confirmed")) {
        setNeedsConfirm(values.email);
        return;
      }
      toast.error("Falha no login: " + error.message);
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/dashboard" });
  };
  const resend = async () => {
    if (!needsConfirm) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: needsConfirm,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setResending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Enviamos um novo link de confirmação para " + needsConfirm);
  };
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {needsConfirm && (
        <Alert>
          <MailCheck className="h-4 w-4" />
          <AlertTitle>Confirme seu e-mail para entrar</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Enviamos um link de confirmação para <b>{needsConfirm}</b>. Verifique sua caixa de entrada e a pasta de spam.</p>
            <Button type="button" size="sm" variant="outline" onClick={resend} disabled={resending}>
              {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
        {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <PasswordInput id="password" autoComplete="current-password" {...form.register("password")} />
        {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Entrando..." : "Entrar"}
      </Button>
      <ForgotPasswordDialog defaultEmail={form.watch("email")} />
    </form>
  );
}

function ForgotPasswordDialog({ defaultEmail }: { defaultEmail?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (open) setEmail(defaultEmail ?? ""); }, [open, defaultEmail]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Informe seu e-mail"); return; }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Enviamos um link de recuperação para seu e-mail.");
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="block w-full text-center text-xs text-primary hover:underline">
          Esqueci minha senha
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recuperar senha</DialogTitle>
          <DialogDescription>Informe seu e-mail para receber o link de redefinição.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="recover_email">E-mail</Label>
            <Input id="recover_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>{submitting ? "Enviando..." : "Enviar link"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SignUpForm({ onDone }: { onDone: () => void }) {
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { full_name: "", email: "", password: "", profile_type: "owner", document: "", creci: "", accept_terms: false as unknown as true },
  });
  const profileType = form.watch("profile_type");
  const documentValue = form.watch("document") || "";
  const docDigits = onlyDigits(documentValue);
  const docIsCNPJ = docDigits.length > 11;
  const onSubmit = async (values: z.infer<typeof signUpSchema>) => {
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: values.full_name,
          profile_type: values.profile_type,
          document: onlyDigits(values.document),
          creci: values.creci?.trim() || null,
          accepted_terms_at: new Date().toISOString(),
        },
      },
    });
    if (error) { toast.error("Falha no cadastro: " + error.message); return; }
    // Sem sessão = confirmação por e-mail ativada
    if (data.user && !data.session) {
      setPendingEmail(values.email);
      return;
    }
    toast.success("Conta criada com sucesso!");
    onDone();
  };
  const resend = async () => {
    if (!pendingEmail) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setResending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Novo link enviado para " + pendingEmail);
  };

  if (pendingEmail) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Confirme seu e-mail</h3>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de ativação para <b>{pendingEmail}</b>.<br />
            Abra o e-mail e clique no botão de confirmação para ativar sua conta.
          </p>
        </div>
        <div className="rounded-md border bg-muted/30 p-3 text-left text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Não recebeu?</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Verifique a pasta de <b>spam</b> ou <b>promoções</b>.</li>
            <li>Confirme se digitou o e-mail correto.</li>
            <li>O link pode levar até 1 minuto para chegar.</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" onClick={resend} disabled={resending}>
            {resending ? "Reenviando..." : "Reenviar e-mail de confirmação"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => { setPendingEmail(null); onDone(); }}>
            Já confirmei — ir para o login
          </Button>
        </div>
      </div>
    );
  }

  const accepted = form.watch("accept_terms");
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Alert>
        <MailCheck className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Após criar sua conta, você receberá um <b>e-mail de confirmação</b>. É preciso clicar no link para ativar o acesso.
        </AlertDescription>
      </Alert>
      <div className="space-y-2">
        <Label htmlFor="full_name">Nome completo</Label>
        <Input id="full_name" {...form.register("full_name")} />
        {form.formState.errors.full_name && <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Tipo de perfil</Label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { v: "owner", label: "Proprietário Direto", desc: "Administro meus imóveis" },
            { v: "broker", label: "Corretor/Imobiliária", desc: "Atuo profissionalmente" },
          ] as const).map((opt) => (
            <button
              type="button"
              key={opt.v}
              onClick={() => form.setValue("profile_type", opt.v, { shouldValidate: true })}
              className={`rounded-md border p-3 text-left text-xs transition ${profileType === opt.v ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-muted-foreground">{opt.desc}</div>
            </button>
          ))}
        </div>
        {form.formState.errors.profile_type && <p className="text-xs text-destructive">{form.formState.errors.profile_type.message as string}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="document">CPF ou CNPJ</Label>
        <Input
          id="document"
          inputMode="numeric"
          placeholder="000.000.000-00 ou 00.000.000/0000-00"
          value={documentValue}
          onChange={(e) => {
            const digits = onlyDigits(e.target.value);
            const masked = digits.length > 11 ? maskCNPJ(digits) : maskCPF(digits);
            form.setValue("document", masked, { shouldValidate: true });
          }}
        />
        <p className="text-[11px] text-muted-foreground">{docIsCNPJ ? "Formato CNPJ" : "Formato CPF"} — usado para verificação anti-fraude.</p>
        {form.formState.errors.document && <p className="text-xs text-destructive">{form.formState.errors.document.message}</p>}
      </div>
      {profileType === "broker" && (
        <div className="space-y-2">
          <Label htmlFor="creci">CRECI</Label>
          <Input id="creci" placeholder="Ex.: 123456-F/SP" {...form.register("creci")} />
          {form.formState.errors.creci && <p className="text-xs text-destructive">{form.formState.errors.creci.message as string}</p>}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email2">E-mail</Label>
        <Input id="email2" type="email" autoComplete="email" {...form.register("email")} />
        {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password2">Senha</Label>
        <PasswordInput id="password2" autoComplete="new-password" {...form.register("password")} />
        {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
      </div>
      <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
        <input
          id="accept_terms"
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-primary"
          checked={Boolean(accepted)}
          onChange={(e) => form.setValue("accept_terms", e.target.checked as unknown as true, { shouldValidate: true })}
        />
        <Label htmlFor="accept_terms" className="text-xs font-normal leading-snug text-muted-foreground">
          Li e concordo com os{" "}
          <Link to="/termos" target="_blank" className="text-primary underline">Termos de Uso</Link>{" "}
          e com a{" "}
          <Link to="/privacidade" target="_blank" className="text-primary underline">Política de Privacidade</Link>.
        </Label>
      </div>
      {form.formState.errors.accept_terms && <p className="text-xs text-destructive">{form.formState.errors.accept_terms.message as string}</p>}
      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || !accepted}>
        {form.formState.isSubmitting ? "Criando..." : "Criar conta"}
      </Button>
    </form>
  );
}
