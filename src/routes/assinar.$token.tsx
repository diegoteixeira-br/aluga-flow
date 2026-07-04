import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBRL, formatDate } from "@/lib/format";


export const Route = createFileRoute("/assinar/$token")({
  head: () => ({ meta: [{ title: "Assinar contrato — AlugaFlow" }] }),
  component: SignPage,
});

type ContractView = {
  signature: { id: string; role: string; name: string; email: string; signed_at: string | null };
  contract: {
    id: string; contract_type: string; start_date: string; end_date: string;
    rent_amount: number; due_day: number;
    property: { nickname: string; address: string; city: string | null; state: string | null } | null;
    tenant: { full_name: string; cpf: string | null } | null;
  };
  owner: { full_name: string | null } | null;
  signatures: Array<{ role: string; name: string; signed_at: string | null }>;
};

function maskCPFInput(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function SignPage() {
  const { token } = Route.useParams();
  const [view, setView] = useState<ContractView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-contract?token=${encodeURIComponent(token)}`;
    fetch(url, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "" },
    })
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setView(d); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) { toast.error("Confirme a leitura do contrato"); return; }
    setSubmitting(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-contract`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({ token, signed_name: name, signed_cpf: cpf }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Erro ao assinar");
      setDone(true);
      toast.success("Assinatura registrada");
    } catch (e) { toast.error((e as Error).message); } finally { setSubmitting(false); }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error || !view) return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md"><CardContent className="p-8 text-center space-y-2">
        <p className="font-semibold text-destructive">Link inválido</p>
        <p className="text-sm text-muted-foreground">{error ?? "Este link não existe mais."}</p>
      </CardContent></Card>
    </div>
  );

  if (done || view.signature.signed_at) return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-muted/30">
      <Card className="max-w-md"><CardContent className="p-8 text-center space-y-3">
        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
        <p className="font-semibold text-lg">Assinatura registrada</p>
        <p className="text-sm text-muted-foreground">Obrigado, {view.signature.name}. Sua assinatura foi registrada com sucesso. Você pode fechar esta página.</p>
      </CardContent></Card>
    </div>
  );

  const c = view.contract;
  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Assinatura eletrônica de contrato</h1>
          <p className="text-sm text-muted-foreground">AlugaFlow — Lei nº 8.245/91 · MP 2.200-2/2001</p>
        </div>

        <Card><CardContent className="p-5 space-y-2 text-sm">
          <div className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" /> Contrato de locação {c.contract_type}</div>
          <p><b>Imóvel:</b> {c.property?.nickname} — {c.property?.address}{c.property?.city ? `, ${c.property.city}/${c.property.state ?? ""}` : ""}</p>
          <p><b>Locador:</b> {view.owner?.full_name ?? "—"}</p>
          <p><b>Locatário:</b> {c.tenant?.full_name ?? "—"}</p>
          <p><b>Vigência:</b> {formatDate(c.start_date)} a {formatDate(c.end_date)}</p>
          <p><b>Aluguel:</b> {formatBRL(c.rent_amount)} — vencimento todo dia {c.due_day}</p>
          <p className="text-xs text-muted-foreground pt-2">O contrato completo, com todas as cláusulas, foi previamente enviado/disponibilizado pelo locador. Ao assinar você confirma ter lido e concordado com seus termos integrais.</p>
        </CardContent></Card>

        <Card><CardContent className="p-5 space-y-3">
          <p className="text-sm"><b>Você está assinando como:</b> <span className="capitalize">{view.signature.role}</span> — {view.signature.name}</p>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label>Nome completo *</Label>
              <Input required minLength={3} value={name} onChange={(e) => setName(e.target.value)} placeholder="Digite seu nome completo" />
            </div>
            <div className="space-y-1">
              <Label>CPF *</Label>
              <Input required value={cpf} onChange={(e) => setCpf(maskCPFInput(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
              <span>Declaro que li e concordo integralmente com os termos do contrato apresentado, e que as informações acima são verdadeiras. Reconheço a validade jurídica desta assinatura eletrônica.</span>
            </label>
            <Button type="submit" className="w-full" disabled={submitting || !agreed}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando…</> : "Assinar contrato"}
            </Button>
          </form>
        </CardContent></Card>

        {view.signatures.length > 1 && (
          <Card><CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">PROGRESSO DAS ASSINATURAS</p>
            <ul className="space-y-1 text-sm">
              {view.signatures.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  {s.signed_at ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <span className="h-4 w-4 rounded-full border" />}
                  <span className="capitalize">{s.role}</span> — {s.name} {s.signed_at && <span className="text-xs text-muted-foreground">({new Date(s.signed_at).toLocaleString("pt-BR")})</span>}
                </li>
              ))}
            </ul>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
