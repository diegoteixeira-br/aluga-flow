import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminListUsers, adminSendBroadcast, adminAiCompose } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { CheckCircle2, Send, Sparkles, Wand2, Loader2, ChevronsUpDown, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  component: AdminEmails,
});

type Row = { id: string; subject: string; target_plan: string; recipients_count: number; status: string; created_at: string };
type UserRow = { id: string; email: string; full_name?: string | null; plan?: string | null };
type Target = "all" | "free" | "investidor" | "imobiliaria" | "user";

function AdminEmails() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<Target>("all");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userOpen, setUserOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [history, setHistory] = useState<Row[]>([]);
  const [sending, setSending] = useState(false);

  // IA
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState("profissional e cordial");
  const [aiBusy, setAiBusy] = useState<"subject" | "body" | "improve" | null>(null);

  const load = async () => {
    const { data } = await supabase.from("admin_email_log").select("*").order("created_at", { ascending: false }).limit(50);
    setHistory((data ?? []) as Row[]);
  };
  useEffect(() => {
    load();
    adminListUsers()
      .then((rows) => setUsers((rows as unknown as UserRow[]) ?? []))
      .catch(() => { /* noop */ });
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users.slice(0, 50);
    return users
      .filter((u) =>
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [users, userSearch]);

  const onSend = async () => {
    if (!subject || !body) return toast.error("Preencha assunto e corpo");
    if (target === "user" && !selectedUser) return toast.error("Selecione um usuário");
    setSending(true);
    try {
      const r = await adminSendBroadcast({
        data: {
          subject, body, targetPlan: target,
          userId: target === "user" ? selectedUser!.id : undefined,
        },
      });
      toast.success(`Email enviado para ${r.recipients} destinatário(s)`);
      setSubject(""); setBody(""); setAiPrompt("");
      load();
    } catch (e) {
      toast.error((e as Error)?.message ?? "Erro");
    } finally { setSending(false); }
  };

  const runAi = async (mode: "subject" | "body" | "improve") => {
    if (mode !== "improve" && !aiPrompt.trim()) {
      return toast.error("Descreva brevemente o objetivo do e-mail para a IA.");
    }
    if (mode === "improve" && !subject && !body) {
      return toast.error("Escreva algo no assunto ou corpo para a IA melhorar.");
    }
    setAiBusy(mode);
    try {
      const r = await adminAiCompose({
        data: {
          mode,
          prompt: aiPrompt,
          currentSubject: subject,
          currentBody: body,
          tone: aiTone,
        },
      });
      const text = (r.text ?? "").trim();
      if (!text) throw new Error("IA não retornou conteúdo");
      if (mode === "subject") setSubject(text.replace(/^["']|["']$/g, "").slice(0, 200));
      else if (mode === "body") setBody(text);
      else {
        // improve: separa assunto e corpo se vier ambos; senão substitui corpo
        setBody(text);
        toast.success("Texto revisado pela IA");
        return;
      }
      toast.success(mode === "subject" ? "Assunto gerado" : "Corpo gerado");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Falha na IA");
    } finally {
      setAiBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Emails em massa</h1>
        <p className="text-sm text-muted-foreground">Comunique-se com seus usuários.</p>
      </div>

      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertTitle>Resend configurado</AlertTitle>
        <AlertDescription>
          Os e-mails são enviados imediatamente pelo Resend usando o remetente configurado em <code>RESEND_FROM_EMAIL</code>.
          Você pode disparar para todos, para um plano específico ou para um único usuário pesquisando pelo nome/e-mail.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Assistente de IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr,220px]">
            <div>
              <Label>Objetivo / briefing do e-mail</Label>
              <Textarea
                rows={3}
                placeholder="Ex.: Avisar usuários do plano Investidor sobre nova funcionalidade de cobrança via PIX."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
            </div>
            <div>
              <Label>Tom</Label>
              <Select value={aiTone} onValueChange={setAiTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="profissional e cordial">Profissional e cordial</SelectItem>
                  <SelectItem value="amigável e informal">Amigável e informal</SelectItem>
                  <SelectItem value="direto e objetivo">Direto e objetivo</SelectItem>
                  <SelectItem value="empático e acolhedor">Empático e acolhedor</SelectItem>
                  <SelectItem value="comercial e persuasivo">Comercial e persuasivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => runAi("subject")} disabled={aiBusy !== null}>
              {aiBusy === "subject" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Gerar assunto
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => runAi("body")} disabled={aiBusy !== null}>
              {aiBusy === "body" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Gerar corpo
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => runAi("improve")} disabled={aiBusy !== null}>
              {aiBusy === "improve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Corrigir/melhorar texto atual
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Novo envio</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Assunto</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div>
            <Label>Corpo do email</Label>
            <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Personalize usando variáveis: <code>{"{{nome}}"}</code>, <code>{"{{primeiro_nome}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{plano}}"}</code>. O logo da AlugaFlow é incluído automaticamente no topo.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Destinatários</Label>
              <Select value={target} onValueChange={(v) => { setTarget(v as Target); if (v !== "user") setSelectedUser(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  <SelectItem value="free">Plano Free</SelectItem>
                  <SelectItem value="investidor">Plano Investidor</SelectItem>
                  <SelectItem value="imobiliaria">Plano Imobiliária</SelectItem>
                  <SelectItem value="user">Usuário específico…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {target === "user" && (
              <div>
                <Label>Selecione o usuário</Label>
                <Popover open={userOpen} onOpenChange={setUserOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {selectedUser ? `${selectedUser.full_name || selectedUser.email} (${selectedUser.email})` : "Pesquisar por nome ou e-mail…"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Digite o nome ou e-mail…" value={userSearch} onValueChange={setUserSearch} />
                      <CommandList>
                        <CommandEmpty>Nenhum usuário.</CommandEmpty>
                        <CommandGroup>
                          {filteredUsers.map((u) => (
                            <CommandItem
                              key={u.id}
                              value={u.id}
                              onSelect={() => { setSelectedUser(u); setUserOpen(false); }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${selectedUser?.id === u.id ? "opacity-100" : "opacity-0"}`} />
                              <div className="flex flex-col">
                                <span className="text-sm">{u.full_name || u.email}</span>
                                <span className="text-xs text-muted-foreground">{u.email} • {u.plan ?? "—"}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={onSend} disabled={sending}>
              <Send className="mr-2 h-4 w-4" /> {sending ? "Enviando…" : "Enviar agora"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Assunto</TableHead><TableHead>Alvo</TableHead><TableHead>Destinatários</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {history.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum envio.</TableCell></TableRow> :
                history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.created_at)}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{r.subject}</TableCell>
                    <TableCell className="capitalize">{r.target_plan.startsWith("user:") ? "Usuário específico" : r.target_plan}</TableCell>
                    <TableCell>{r.recipients_count}</TableCell>
                    <TableCell className="capitalize">{r.status}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
