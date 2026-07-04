import { BrandLogo } from "@/components/brand-logo";
import { createFileRoute, Outlet, Link, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Building2, Users, FileText, Wallet, Receipt, LogOut, Menu, ClipboardCheck, BarChart3, Settings, Megaphone, Shield, CreditCard,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AuthLayout,
});

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/properties", label: "Imóveis", icon: Building2 },
  { to: "/tenants", label: "Inquilinos", icon: Users },
  { to: "/contracts", label: "Contratos", icon: FileText },
  { to: "/payments", label: "Pagamentos", icon: Wallet },
  { to: "/expenses", label: "Despesas", icon: Receipt },
  { to: "/vistoria", label: "Vistoria", icon: ClipboardCheck },
  { to: "/meus-anuncios", label: "Meus Anúncios", icon: Megaphone },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/minha-conta/plano", label: "Meu plano", icon: CreditCard },
] as const;

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, mounted, navigate]);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/20">
        <AppSidebar onSignOut={handleSignOut} email={user?.email} />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger><Menu className="h-5 w-5" /></SidebarTrigger>
            
          </header>
          <main className="flex-1 p-4 md:p-6"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar({ onSignOut, email }: { onSignOut: () => void; email?: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [plan, setPlan] = useState<string>("free");
  const [role, setRole] = useState<string>("owner");
  useEffect(() => {
    if (!user) { setIsAdmin(false); setPlan("free"); setRole("owner"); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(!!data));
    supabase.from("profiles").select("plan, role").eq("id", user.id).maybeSingle().then(({ data }) => {
      setPlan(((data?.plan as string) ?? "free"));
      setRole((((data as Record<string, unknown> | null)?.role as string) ?? "owner"));
    });
  }, [user]);
  const isMember = role === "member";
  const planLabel = plan === "investidor" ? "Investidor" : plan === "imobiliaria" ? "Imobiliária" : "Gratuito";
  const planCls = plan === "investidor" ? "bg-primary/15 text-primary" : plan === "imobiliaria" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-700";
  const visibleNav = isMember ? navItems.filter((i) => i.to !== "/minha-conta/plano") : navItems;
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <BrandLogo withWordmark={false} size={32} className="shrink-0" />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">AlugaFlow</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNav.map((item) => {
                const active = path === item.to || path.startsWith(item.to + "/");
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path.startsWith("/admin")} tooltip="Painel admin">
                    <Link to="/admin" className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span>Painel Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 pb-2 space-y-1">
          <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${planCls}`}>{planLabel}</span>
          </div>
          <Button onClick={onSignOut} variant="ghost" size="sm" className="w-full justify-start gap-2">
            <LogOut className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">Sair</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
