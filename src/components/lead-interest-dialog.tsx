import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  nome_interessado: z.string().trim().min(2, "Informe seu nome completo").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  telefone: z.string().trim().min(8, "Informe um telefone válido").max(20),
  cpf: z.string().trim().min(11, "CPF obrigatório").max(14),
  rg: z.string().trim().max(20).optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  marital_status: z.string().optional().or(z.literal("")),
  profession: z.string().trim().max(80).optional().or(z.literal("")),
  monthly_income: z.string().optional().or(z.literal("")),
  current_address: z.string().trim().max(200).optional().or(z.literal("")),
  current_city: z.string().trim().max(80).optional().or(z.literal("")),
  current_state: z.string().trim().max(2).optional().or(z.literal("")),
  current_zip: z.string().trim().max(10).optional().or(z.literal("")),
  mensagem: z.string().max(1000).optional().or(z.literal("")),
});
type Values = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  propertyId: string;
  ownerUserId: string;
  propertyTitle: string;
};

const BUCKET = "lead-documents";
const MAX = 5 * 1024 * 1024;

async function uploadDoc(file: File | null, ownerId: string, propertyId: string, kind: string): Promise<string | null> {
  if (!file) return null;
  if (file.size > MAX) throw new Error(`Arquivo ${kind} maior que 5 MB`);
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${ownerId}/${propertyId}/${crypto.randomUUID()}-${kind}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export function LeadInterestDialog({ open, onOpenChange, propertyId, ownerUserId, propertyTitle }: Props) {
  const [docRg, setDocRg] = useState<File | null>(null);
  const [docIncome, setDocIncome] = useState<File | null>(null);
  const [docRes, setDocRes] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { nome_interessado: "", email: "", telefone: "", cpf: "" },
  });

  async function onSubmit(v: Values) {
    setSubmitting(true);
    try {
      const [rgPath, incPath, resPath] = await Promise.all([
        uploadDoc(docRg, ownerUserId, propertyId, "rg"),
        uploadDoc(docIncome, ownerUserId, propertyId, "renda"),
        uploadDoc(docRes, ownerUserId, propertyId, "residencia"),
      ]);
      const { error } = await supabase.from("leads").insert({
        property_id: propertyId,
        user_id: ownerUserId,
        nome_interessado: v.nome_interessado.trim(),
        email: v.email.trim(),
        telefone: v.telefone.trim(),
        cpf: v.cpf.replace(/\D/g, ""),
        rg: v.rg || null,
        birth_date: v.birth_date || null,
        marital_status: v.marital_status || null,
        profession: v.profession || null,
        monthly_income: v.monthly_income ? Number(v.monthly_income.replace(/\D/g, "")) / 100 : null,
        current_address: v.current_address || null,
        current_city: v.current_city || null,
        current_state: v.current_state || null,
        current_zip: v.current_zip || null,
        mensagem: v.mensagem || null,
        doc_rg_path: rgPath,
        doc_income_path: incPath,
        doc_residence_path: resPath,
        status: "novo",
      });
      if (error) throw error;
      toast.success("Pré-cadastro enviado! O proprietário entrará em contato.");
      onOpenChange(false);
      form.reset();
      setDocRg(null); setDocIncome(null); setDocRes(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tenho interesse — {propertyTitle}</DialogTitle>
          <DialogDescription>
            Preencha seu pré-cadastro. Quanto mais completo, mais rápido o proprietário consegue avaliar e adiantar o contrato.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Dados pessoais</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Nome completo *</Label><Input {...form.register("nome_interessado")} />{form.formState.errors.nome_interessado && <p className="text-xs text-destructive">{form.formState.errors.nome_interessado.message}</p>}</div>
              <div><Label>E-mail *</Label><Input type="email" {...form.register("email")} />{form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}</div>
              <div><Label>Telefone / WhatsApp *</Label><Input placeholder="(65) 99999-9999" {...form.register("telefone")} />{form.formState.errors.telefone && <p className="text-xs text-destructive">{form.formState.errors.telefone.message}</p>}</div>
              <div><Label>CPF *</Label><Input placeholder="000.000.000-00" {...form.register("cpf")} />{form.formState.errors.cpf && <p className="text-xs text-destructive">{form.formState.errors.cpf.message}</p>}</div>
              <div><Label>RG</Label><Input {...form.register("rg")} /></div>
              <div><Label>Nascimento</Label><Input type="date" {...form.register("birth_date")} /></div>
              <div>
                <Label>Estado civil</Label>
                <Select onValueChange={(v) => form.setValue("marital_status", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                    <SelectItem value="casado">Casado(a)</SelectItem>
                    <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                    <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                    <SelectItem value="uniao_estavel">União estável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Profissão</Label><Input {...form.register("profession")} /></div>
              <div><Label>Renda mensal (R$)</Label><Input inputMode="numeric" placeholder="0,00" {...form.register("monthly_income")} /></div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Endereço atual</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Endereço (rua, número, bairro)</Label><Input {...form.register("current_address")} /></div>
              <div><Label>Cidade</Label><Input {...form.register("current_city")} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>UF</Label><Input maxLength={2} {...form.register("current_state")} /></div>
                <div><Label>CEP</Label><Input {...form.register("current_zip")} /></div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Documentos (opcional, até 5 MB cada)</h3>
            <p className="text-xs text-muted-foreground">PDF, JPG ou PNG. Envie agora para acelerar a análise.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <DocField label="RG ou CNH" file={docRg} onChange={setDocRg} />
              <DocField label="Comprovante de renda" file={docIncome} onChange={setDocIncome} />
              <DocField label="Comprovante de residência" file={docRes} onChange={setDocRes} />
            </div>
          </section>

          <section className="space-y-2">
            <Label>Mensagem (opcional)</Label>
            <Textarea rows={3} placeholder="Quando gostaria de visitar? Alguma observação?" {...form.register("mensagem")} />
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar pré-cadastro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DocField({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) {
  return (
    <label className="flex cursor-pointer flex-col gap-1 rounded-md border border-dashed p-3 text-xs hover:bg-accent">
      <div className="flex items-center gap-2 font-medium"><Upload className="h-3.5 w-3.5" /> {label}</div>
      <span className="truncate text-muted-foreground">{file ? file.name : "Clique para enviar"}</span>
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}
