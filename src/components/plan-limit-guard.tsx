import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sparkles } from "lucide-react";

export type PlanLimit = { allowed: boolean; current: number; max: number | null; plan: string };

export function useCheckLimit() {
  return async (resource: "properties" | "listings"): Promise<PlanLimit> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return { allowed: false, current: 0, max: 0, plan: "free" };
    const { data, error } = await supabase.rpc("check_plan_limit", { _user_id: u.user.id, _resource: resource });
    if (error) throw error;
    return data as PlanLimit;
  };
}

export function useMyPlan() {
  return useQuery({
    queryKey: ["my-plan"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { plan: "free" as string, isAdmin: false, role: "owner" as "owner" | "member", parentId: null as string | null, maxUsers: 1 };
      const [{ data: profile }, { data: isAdmin }] = await Promise.all([
        supabase.from("profiles").select("plan, role, parent_id").eq("id", u.user.id).maybeSingle(),
        supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
      ]);
      const role = (((profile as Record<string, unknown> | null)?.role as string) ?? "owner") as "owner" | "member";
      const parentId = ((profile as Record<string, unknown> | null)?.parent_id as string | null) ?? null;
      let effectivePlan = (profile?.plan ?? "free") as string;
      if (parentId) {
        const { data: ownerProfile } = await supabase.from("profiles").select("plan").eq("id", parentId).maybeSingle();
        if (ownerProfile?.plan) effectivePlan = ownerProfile.plan as string;
      }
      // maxUsers sempre reflete o plano real assinado (não eleva por admin),
      // para que a aba Equipe só apareça quando o plano realmente permitir.
      const { data: planRow } = await supabase.from("plans").select("max_users").eq("id", effectivePlan).maybeSingle();
      const maxUsers = (planRow?.max_users as number | null) ?? 1;
      if (isAdmin) {
        // Admin mantém plano elevado para bypass de outros limites, mas maxUsers respeita o plano real.
        return { plan: "imobiliaria" as string, isAdmin: true, role, parentId, maxUsers };
      }
      return { plan: effectivePlan, isAdmin: false, role, parentId, maxUsers };
    },
    staleTime: 30_000,
  });
}

export function UpgradeRequiredDialog({
  open, onOpenChange, title = "Limite do plano atingido", description, current, max,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  title?: string;
  description?: string;
  current?: number;
  max?: number | null;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? (
              <>
                Você atingiu o limite do seu plano
                {typeof current === "number" && typeof max === "number" ? ` (${current}/${max})` : ""}.
                Faça upgrade para continuar.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Agora não</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Link to="/minha-conta/plano">Ver planos</Link>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
