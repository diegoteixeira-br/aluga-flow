import { createFileRoute, Outlet, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, DollarSign, Tags, Mail, FileText, CreditCard, ArrowLeft, ShieldAlert, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const items: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/usuarios", label: "Usuários", icon: Users },
  { to: "/admin/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/admin/planos", label: "Planos e Preços", icon: Tags },
  { to: "/admin/emails", label: "Emails", icon: Mail },
  { to: "/admin/blog", label: "Blog", icon: FileText },
  { to: "/admin/legais", label: "Páginas Legais", icon: ScrollText },
  { to: "/admin/pagamentos", label: "Pagamentos", icon: CreditCard },
];


function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "ok" | "deny">("checking");
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      if (data) setStatus("ok");
      else {
        setStatus("deny");
        setTimeout(() => navigate({ to: "/dashboard", replace: true }), 1500);
      }
    });
  }, [user, loading, navigate]);

  if (status === "checking") {
    return <div className="p-10 text-sm text-muted-foreground">Verificando permissões…</div>;
  }
  if (status === "deny") {
    return (
      <div className="mx-auto mt-20 max-w-md rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-3 text-xl font-semibold">Acesso negado</h1>
        <p className="mt-1 text-sm text-muted-foreground">Esta área é exclusiva para administradores. Redirecionando…</p>
      </div>
    );
  }

  return (
    <div className="-m-4 grid min-h-[calc(100vh-3.5rem)] grid-cols-1 md:-m-6 md:grid-cols-[240px_1fr]">
      <aside className="border-r bg-card">
        <div className="border-b p-4">
          <div className="text-xs font-medium uppercase text-muted-foreground">Painel</div>
          <div className="text-lg font-bold">Administração</div>
        </div>
        <nav className="space-y-1 p-2">
          {items.map((it) => {
            const active = it.exact ? path === it.to : path === it.to || path.startsWith(it.to + "/");
            return (
              <Link
                key={it.to}
                to={it.to as "/admin"}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
          <Link to="/dashboard" className="mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-4 w-4" /> Voltar ao site
          </Link>
        </nav>
      </aside>
      <main className="bg-muted/10 p-6">
        <Outlet />
      </main>
    </div>
  );
}
