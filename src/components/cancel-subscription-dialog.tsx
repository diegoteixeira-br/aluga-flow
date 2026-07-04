import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cancelSubscription } from "@/lib/subscriptions.functions";
import { formatDate } from "@/lib/format";

const REASONS = [
  "Preço alto",
  "Não uso mais",
  "Encontrei outra solução",
  "Outro",
];

export function CancelSubscriptionDialog({
  open, onOpenChange, periodEnd,
}: { open: boolean; onOpenChange: (b: boolean) => void; periodEnd?: string | null }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const cancelFn = cancelSubscription;

  const mut = useMutation({
    mutationFn: () => cancelFn({ data: { reason: reason + (details ? ` — ${details}` : "") } }),
    onSuccess: () => {
      toast.success("Assinatura cancelada. Você manterá acesso até o fim do período.");
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
      qc.invalidateQueries({ queryKey: ["my-plan"] });
      onOpenChange(false);
      setReason(""); setDetails("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar assinatura</DialogTitle>
          <DialogDescription>
            Você voltará para o plano Gratuito ao fim do período atual{periodEnd ? ` (${formatDate(periodEnd)})` : ""}.
            Seus dados ficam salvos, mas o acesso aos recursos pagos será removido.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Motivo do cancelamento *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Selecione um motivo" /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Comentário (opcional)</Label>
            <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Conte mais para nos ajudar a melhorar..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button
            variant="destructive"
            disabled={!reason || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? "Cancelando..." : "Confirmar cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
