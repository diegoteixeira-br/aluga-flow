import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, Star, StarOff, FileText, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  listTemplates, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate,
  type ContractTemplate, type TemplateInput,
} from "@/lib/contract-templates-store";
import { TOKEN_GROUPS, TEMPLATE_LOCACAO_DINAMICO, resolveTokens } from "@/lib/contract-tokens";
import { downloadTextPDF } from "@/lib/contract-pdf-text";

export const Route = createFileRoute("/_authenticated/modelos-contrato")({
  head: () => ({ meta: [{ title: "Modelos de Contrato — AlugaFlow" }] }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["contract_templates"],
    queryFn: listTemplates,
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["properties", "templates-page"],
    queryFn: async () => (await supabase.from("properties").select("id, nickname").order("nickname")).data ?? [],
  });

  const del = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract_templates"] }); toast.success("Modelo excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dup = useMutation({
    mutationFn: duplicateTemplate,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract_templates"] }); toast.success("Modelo duplicado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setDefault = useMutation({
    mutationFn: async (t: ContractTemplate) => updateTemplate(t.id, {
      name: t.name, description: t.description, content: t.content,
      property_id: t.property_id, is_default: !t.is_default,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract_templates"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() { setEditing(null); setDialogOpen(true); }
  function openEdit(t: ContractTemplate) { setEditing(t); setDialogOpen(true); }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modelos de contrato</h1>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie seus modelos reutilizáveis. Use variáveis como <code className="rounded bg-muted px-1">[contratante_nome]</code> — elas são substituídas automaticamente ao gerar um contrato.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> Novo modelo</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : templates.length === 0 ? (
        <Card><CardContent className="py-12 text-center space-y-3">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Você ainda não criou nenhum modelo.</p>
          <Button onClick={openNew} variant="outline"><Plus className="h-4 w-4" /> Criar primeiro modelo</Button>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => {
            const prop = properties.find((p) => p.id === t.property_id);
            return (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      {t.name}
                      {t.is_default && <Badge variant="secondary" className="text-[10px]"><Star className="h-3 w-3" /> Padrão</Badge>}
                    </CardTitle>
                    <Button size="icon" variant="ghost" onClick={() => setDefault.mutate(t)} title={t.is_default ? "Remover padrão" : "Definir como padrão"}>
                      {t.is_default ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                    </Button>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    <span>Imóvel: </span>{prop ? prop.nickname : "Todos os imóveis"}
                  </div>
                  <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{t.content || "(vazio)"}</p>
                  <div className="flex flex-wrap gap-1 pt-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)}><Pencil className="h-3 w-3" /> Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => dup.mutate(t.id)}><Copy className="h-3 w-3" /> Duplicar</Button>
                    <Button size="sm" variant="ghost" onClick={() => downloadTextPDF(t.content, t.name.replace(/\s+/g, "-").toLowerCase())}>
                      <Eye className="h-3 w-3" /> Ver PDF
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                      if (confirm(`Excluir modelo "${t.name}"?`)) del.mutate(t.id);
                    }}>
                      <Trash2 className="h-3 w-3" /> Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TemplateEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        properties={properties}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["contract_templates"] }); setDialogOpen(false); }}
      />
    </div>
  );
}

function TemplateEditorDialog({
  open, onOpenChange, editing, properties, onSaved,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing: ContractTemplate | null;
  properties: Array<{ id: string; nickname: string }>;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [propertyId, setPropertyId] = useState<string>("__none__");
  const [isDefault, setIsDefault] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Reset when opening
  useMemo(() => {
    if (open) {
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
      setContent(editing?.content ?? TEMPLATE_LOCACAO_DINAMICO);
      setPropertyId(editing?.property_id ?? "__none__");
      setIsDefault(editing?.is_default ?? false);
      setShowPreview(false);
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Dê um nome para o modelo");
      const input: TemplateInput = {
        name: name.trim(),
        description: description.trim() || null,
        content,
        property_id: propertyId === "__none__" ? null : propertyId,
        is_default: isDefault,
      };
      if (editing) return updateTemplate(editing.id, input);
      return createTemplate(input);
    },
    onSuccess: () => { toast.success(editing ? "Modelo atualizado" : "Modelo criado"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  function insertToken(key: string) {
    const ta = textareaRef.current;
    const token = `[${key}]`;
    if (!ta) { setContent((c) => c + token); return; }
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    setContent(content.slice(0, start) + token + content.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  const previewText = useMemo(() => resolveTokens(content, SAMPLE_VALUES), [content]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar modelo" : "Novo modelo de contrato"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Residencial padrão" />
          </div>
          <div className="space-y-1">
            <Label>Imóvel vinculado</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Todos os imóveis</SelectItem>
                {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.nickname}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional — quando usar este modelo" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} />
            <span>Definir como modelo padrão (aparece pré-selecionado no wizard)</span>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
          <Card className="h-fit">
            <CardContent className="p-2">
              <p className="px-2 py-1 text-xs text-muted-foreground">Clique para inserir uma variável no ponto do cursor.</p>
              <Accordion type="multiple" className="w-full">
                {TOKEN_GROUPS.map((g) => (
                  <AccordionItem key={g.id} value={g.id}>
                    <AccordionTrigger className="px-2 py-2 text-sm">{g.label}</AccordionTrigger>
                    <AccordionContent className="px-2 pb-2">
                      <div className="flex flex-col gap-1">
                        {g.tokens.map((t) => (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => insertToken(t.key)}
                            className="rounded border px-2 py-1 text-left text-xs hover:bg-accent"
                            title={`[${t.key}]`}
                          >{t.label}</button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <div className="mt-2 space-y-2 px-1">
                <Button type="button" size="sm" variant="secondary" className="w-full" onClick={() => setShowPreview((p) => !p)}>
                  <Eye className="h-4 w-4" /> {showPreview ? "Editar" : "Pré-visualizar"}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="w-full" onClick={() => setContent(TEMPLATE_LOCACAO_DINAMICO)}>
                  Restaurar modelo padrão
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="min-h-[420px]">
            {showPreview ? (
              <Card><CardContent className="p-4">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Pré-visualização com dados fictícios</p>
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{previewText}</pre>
              </CardContent></Card>
            ) : (
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[420px] font-mono text-xs leading-relaxed"
                spellCheck={false}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : editing ? "Salvar alterações" : "Criar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
import { useRef } from "react";

const SAMPLE_VALUES: Record<string, string> = {
  data_assinatura: "01/01/2026",
  data_hoje_extenso: "1 de janeiro de 2026",
  proprietario_nome: "João da Silva",
  proprietario_razao_social: "João da Silva",
  proprietario_cpf: "123.456.789-00",
  proprietario_rg: "12.345.678-9",
  proprietario_email: "joao@exemplo.com",
  proprietario_telefone: "(11) 99999-0000",
  proprietario_endereco: "Rua das Flores, 100, Centro, São Paulo, SP",
  proprietario_qualificacao: "João da Silva, CPF nº 123.456.789-00, residente em Rua das Flores, 100",
  contratante_nome: "Maria Souza",
  contratante_cpf: "987.654.321-00",
  contratante_rg: "98.765.432-1",
  contratante_email: "maria@exemplo.com",
  contratante_telefone: "(11) 98888-0000",
  contratante_endereco: "Av. Paulista, 1000, Bela Vista, São Paulo, SP",
  contratante_qualificacao: "Maria Souza, CPF nº 987.654.321-00, residente em Av. Paulista, 1000",
  garantia_tipo: "Fiador",
  garantia_caucionante_nome: "Carlos Mendes",
  garantia_caucionante_qualificacao: "Carlos Mendes, CPF nº 111.222.333-44",
  garantia_outro_fiador_nome: "",
  garantia_outro_fiador_qualificacao: "",
  contrato_objeto: "Rua das Palmeiras, 500 — Jardins — São Paulo/SP",
  contrato_objeto_cidade: "São Paulo",
  contrato_objeto_estado: "SP",
  contrato_inicio: "01/02/2026",
  contrato_data_termino: "31/01/2027",
  contrato_prazo_em_meses: "12",
  contrato_valor_inicial: "R$ 2.500,00",
  contrato_valor_inicial_extenso: "dois mil e quinhentos reais",
  contrato_dia_vencimento: "5",
  contrato_inflacao: "IGP-M",
  contrato_caucao_valor: "R$ 7.500,00",
};
