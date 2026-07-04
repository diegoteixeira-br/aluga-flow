import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminListUsers, adminSetUserPlan, adminToggleActive, adminToggleAdmin } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Shield, ShieldOff, UserX, UserCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: AdminUsers,
});

type Row = {
  id: string; email: string; full_name: string | null; plan: string; active: boolean;
  created_at: string; last_sign_in_at: string | null; is_admin: boolean; property_count: number;
};

function AdminUsers() {
  const list = adminListUsers;
  const setPlan = adminSetUserPlan;
  const toggleActive = adminToggleActive;
  const toggleAdmin = adminToggleAdmin;
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => list() });
  const rows = (data ?? []) as Row[];

  const m = (fn: () => Promise<unknown>, msg: string) =>
    fn().then(() => { toast.success(msg); qc.invalidateQueries({ queryKey: ["admin-users"] }); })
        .catch((e) => toast.error(e?.message ?? "Erro"));

  const filtered = rows.filter((r) =>
    !q || r.email?.toLowerCase().includes(q.toLowerCase()) || r.full_name?.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-sm text-muted-foreground">Gerencie planos, permissões e status.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{filtered.length} usuários</CardTitle></CardHeader>
        <CardContent>
          <Input placeholder="Buscar por nome ou email" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Imóveis</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
                {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum usuário.</TableCell></TableRow>}
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.full_name ?? "—"}</div>
                      {r.is_admin && <Badge variant="default" className="mt-1">admin</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{r.email}</TableCell>
                    <TableCell>
                      <Select value={r.plan} onValueChange={(v) => m(() => setPlan({ data: { userId: r.id, plan: v as "free" } }), "Plano atualizado")}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="investidor">Investidor</SelectItem>
                          <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{r.property_count}</TableCell>
                    <TableCell>{formatDate(r.created_at)}</TableCell>
                    <TableCell>{r.last_sign_in_at ? formatDate(r.last_sign_in_at) : "—"}</TableCell>
                    <TableCell>{r.active ? <Badge variant="outline">Ativo</Badge> : <Badge variant="destructive">Bloqueado</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" title={r.is_admin ? "Revogar admin" : "Tornar admin"}
                          onClick={() => m(() => toggleAdmin({ data: { userId: r.id, makeAdmin: !r.is_admin } }), "Permissão atualizada")}>
                          {r.is_admin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" title={r.active ? "Bloquear" : "Reativar"}
                          onClick={() => m(() => toggleActive({ data: { userId: r.id, active: !r.active } }), "Status atualizado")}>
                          {r.active ? <UserX className="h-4 w-4 text-destructive" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
