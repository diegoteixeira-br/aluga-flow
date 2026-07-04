import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMyPlan } from "@/components/plan-limit-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Member = { id: string; full_name: string | null; email: string | null; role: string; created_at: string };

export function TeamTab() {
  const { data: plan } = useMyPlan();
  const qc = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);

  const list = useQuery({
    queryKey: ["team", "members"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("team", { body: { action: "list" } });
      if (error) throw error;
      return ((data as { members?: Member[] })?.members ?? []) as Member[];
    },
  });

  const maxUsers = plan?.maxUsers ?? 1;
  const memberLimit = Math.max(0, maxUsers - 1); // owner counts as 1
  const current = list.data?.length ?? 0;
  const atLimit = current >= memberLimit;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> Equipe</CardTitle>
        <CardDescription>
          Gerencie sub-usuários (membros) da sua conta. Eles fazem login com e-mail e senha próprios e acessam os mesmos dados da conta principal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {current} de {memberLimit} membro(s) cadastrado(s).
          </p>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button onClick={() => setOpenCreate(true)} disabled={atLimit} size="sm">
                    <Plus className="h-4 w-4" /> Adicionar usuário
                  </Button>
                </span>
              </TooltipTrigger>
              {atLimit && (
                <TooltipContent>Limite do plano atingido</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {list.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (list.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground border rounded-md p-6 text-center">
            Nenhum membro cadastrado ainda.
          </p>
        ) : (
          <div className="border rounded-md divide-y">
            {(list.data ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 p-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.full_name || "(sem nome)"}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(m)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeleting(m)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" /> Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <CreateDialog open={openCreate} onOpenChange={setOpenCreate} onCreated={() => qc.invalidateQueries({ queryKey: ["team", "members"] })} />
      <EditDialog member={editing} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["team", "members"] })} />
      <DeleteDialog member={deleting} onClose={() => setDeleting(null)} onDeleted={() => qc.invalidateQueries({ queryKey: ["team", "members"] })} />
    </Card>
  );
}

function CreateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (b: boolean) => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("team", {
        body: { action: "create", full_name: fullName, email, password },
      });
      if (error) throw error;
      const r = data as { error?: string };
      if (r?.error) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("Membro adicionado");
      setFullName(""); setEmail(""); setPassword("");
      onOpenChange(false);
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar membro</DialogTitle>
          <DialogDescription>O membro receberá acesso aos mesmos dados da sua conta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Nome completo *</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-1"><Label>E-mail *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label>Senha *</Label><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !fullName || !email || password.length < 6}>
            {create.isPending ? "Criando..." : "Criar membro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ member, onClose, onSaved }: { member: Member | null; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (member) {
      setFullName(member.full_name ?? "");
      setPassword("");
    }
  }, [member]);

  const save = useMutation({
    mutationFn: async () => {
      if (!member) return;
      const body: Record<string, unknown> = { action: "update", id: member.id };
      if (fullName && fullName !== member.full_name) body.full_name = fullName;
      if (password) body.password = password;
      const { data, error } = await supabase.functions.invoke("team", { body });
      if (error) throw error;
      const r = data as { error?: string };
      if (r?.error) throw new Error(r.error);
    },
    onSuccess: () => {
      toast.success("Membro atualizado");
      setPassword("");
      onClose();
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!member} onOpenChange={(o) => { if (!o) { setFullName(""); setPassword(""); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar membro</DialogTitle>
          <DialogDescription>{member?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Nome completo</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Nova senha (opcional)</Label><PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Deixe em branco para manter" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setFullName(""); setPassword(""); onClose(); }}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ member, onClose, onDeleted }: { member: Member | null; onClose: () => void; onDeleted: () => void }) {
  const del = useMutation({
    mutationFn: async () => {
      if (!member) return;
      const { data, error } = await supabase.functions.invoke("team", { body: { action: "delete", id: member.id } });
      if (error) throw error;
      const r = data as { error?: string };
      if (r?.error) throw new Error(r.error);
    },
    onSuccess: () => { toast.success("Membro removido"); onClose(); onDeleted(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <AlertDialog open={!!member} onOpenChange={(o) => { if (!o) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover membro?</AlertDialogTitle>
          <AlertDialogDescription>
            O acesso de <strong>{member?.email}</strong> será revogado imediatamente. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => del.mutate()} disabled={del.isPending}>
            {del.isPending ? "Removendo..." : "Remover"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
