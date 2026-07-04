import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

import { KeyRound, ShieldCheck, Mail, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteAccount } from "@/lib/account.functions";

const schema = z.object({
  currentPassword: z.string().min(1, "Informe sua senha atual"),
  newPassword: z.string().min(8, "Mínimo de 8 caracteres"),
  confirm: z.string().min(8, "Mínimo de 8 caracteres"),
})
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "As senhas não conferem" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "A nova senha deve ser diferente da atual" });

type Values = z.infer<typeof schema>;

export function SecurityTab() {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  const onSubmit = async (v: Values) => {
    setSubmitting(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user?.email) throw new Error("Sessão inválida. Faça login novamente.");
      const email = userData.user.email;

      // Reautenticação: confirma a senha atual antes de alterar
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: v.currentPassword,
      });
      if (signInErr) throw new Error("Senha atual incorreta.");

      // Aguarda a sessão reautenticada ficar ativa antes de atualizar a senha
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      if (!sessionData.session) throw new Error("Não foi possível validar a sessão. Tente novamente.");

      const { error } = await supabase.auth.updateUser({ password: v.newPassword });
      if (error) throw error;

      toast.success("Senha alterada com sucesso. Faça login novamente com a nova senha.");
      form.reset();

      window.setTimeout(async () => {
        // Encerra a sessão depois do aviso aparecer, para entrar novamente com a nova senha
        await supabase.auth.signOut();
        window.location.assign("/auth");
      }, 1800);
    } catch (e) {
      console.error("[security-tab] alterar senha falhou:", e);
      toast.error((e as Error).message || "Não foi possível alterar a senha.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <CurrentEmailCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" />Alterar senha</CardTitle>
          <CardDescription>
            Para sua segurança, confirme sua senha atual antes de definir uma nova.
            Se esqueceu, saia e use "Esqueci minha senha" na tela de login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Senha atual</Label>
              <PasswordInput autoComplete="current-password" {...form.register("currentPassword")} />
              {form.formState.errors.currentPassword ? (
                <p className="text-xs text-destructive">{form.formState.errors.currentPassword.message}</p>
              ) : null}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Nova senha</Label>
              <PasswordInput autoComplete="new-password" {...form.register("newPassword")} />
              {form.formState.errors.newPassword ? (
                <p className="text-xs text-destructive">{form.formState.errors.newPassword.message}</p>
              ) : null}
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Confirmar nova senha</Label>
              <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
              {form.formState.errors.confirm ? (
                <p className="text-xs text-destructive">{form.formState.errors.confirm.message}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Alterar senha"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Autenticação em duas etapas</CardTitle>
          <CardDescription>
            Proteja sua conta com um código temporário gerado por apps como Google Authenticator ou Authy.
            Em breve disponível neste painel.
          </CardDescription>
        </CardHeader>
      </Card>

      <DeleteAccountCard />
    </div>
  );
}

function CurrentEmailCard() {
  const [email, setEmail] = useState("");
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />E-mail da conta</CardTitle>
        <CardDescription>
          E-mail atual: <span className="font-medium">{email || "—"}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <p>
            O e-mail é a identidade da conta e está vinculado a todos os seus dados (imóveis,
            contratos, pagamentos, documentos). Por motivo de segurança e integridade, não é
            possível alterar o e-mail desta conta.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DeleteAccountCard() {
  const navigate = useNavigate();
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const runDelete = deleteAccount;

  const onConfirm = async () => {
    setSubmitting(true);
    try {
      await runDelete();
      toast.success("Sua conta e todos os dados foram excluídos.");
      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível excluir a conta.");
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-4 w-4" />Excluir conta
        </CardTitle>
        <CardDescription>
          Esta ação é <strong>permanente</strong> e <strong>não pode ser desfeita</strong>. Serão apagados:
          imóveis, fotos, inquilinos, documentos, contratos, pagamentos, despesas, vistorias, leads,
          anúncios e o seu cadastro. Recomendamos exportar seus relatórios antes de prosseguir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText(""); }}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />Excluir minha conta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />Tem certeza absoluta?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <p>
                    Ao confirmar, <strong>todos os seus dados</strong> serão excluídos imediatamente
                    e de forma <strong>irreversível</strong>:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Imóveis, fotos e anúncios publicados</li>
                    <li>Inquilinos e documentos enviados</li>
                    <li>Contratos, assinaturas e PDFs</li>
                    <li>Pagamentos, despesas e relatórios</li>
                    <li>Vistorias e fotos por cômodo</li>
                    <li>Leads recebidos pelos anúncios</li>
                    <li>Identidade visual, perfil e credenciais de acesso</li>
                  </ul>
                  <p>Para confirmar, digite <strong>EXCLUIR</strong> abaixo:</p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="EXCLUIR"
                    autoComplete="off"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmText !== "EXCLUIR" || submitting}
                onClick={(e) => { e.preventDefault(); onConfirm(); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {submitting ? "Excluindo..." : "Excluir definitivamente"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}


