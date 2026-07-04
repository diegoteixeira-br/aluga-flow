import { useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import { Eye, EyeOff, FileDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { ContractPDFData, OwnerProfile } from "@/lib/contract-pdf";
import {
  TOKEN_GROUPS, buildTokenValues, resolveTokens, TEMPLATE_LOCACAO_DINAMICO,
} from "@/lib/contract-tokens";

export function ContractEditor({
  payload, owner, value, onChange,
}: {
  payload: ContractPDFData;
  owner: OwnerProfile | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const values = useMemo(
    () => owner ? buildTokenValues(payload, owner) : {},
    [payload, owner],
  );

  const resolved = useMemo(() => resolveTokens(value, values), [value, values]);

  function insertToken(key: string) {
    const ta = textareaRef.current;
    const token = `[${key}]`;
    if (!ta) { onChange(value + token); return; }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function downloadPDF() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const M = 18;
    const W = doc.internal.pageSize.getWidth() - M * 2;
    let y = M;
    doc.setFont("helvetica", "normal").setFontSize(10);
    const lines = doc.splitTextToSize(resolved, W);
    for (const ln of lines) {
      if (y > 280) { doc.addPage(); y = M; }
      const isHeading = /^(CONTRATO|CLÁUSULA|LOCADOR:|LOCATÁRIO:|FIADOR)/.test(ln.trim());
      if (isHeading) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", "normal");
      doc.text(ln, M, y);
      y += 5;
    }
    doc.save(`contrato-${(payload.property?.nickname ?? "documento").replace(/\s+/g, "-").toLowerCase()}.pdf`);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <strong>Atenção:</strong> os modelos são apenas um ponto de partida.
        Leia, edite e adapte o texto à realidade do seu negócio antes de enviar para assinatura.
        Recomendamos a revisão por um advogado de sua confiança.
      </div>
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
      <Card className="h-fit">
        <CardContent className="p-2">
          <p className="px-2 py-1 text-xs text-muted-foreground">Arraste os campos para a área de texto ao lado.</p>
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
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <div className="mt-2 px-1 space-y-2">
            <Button
              type="button"
              size="sm"
              className="w-full"
              variant={preview ? "default" : "secondary"}
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? <><EyeOff className="h-4 w-4" /> Editar template</>
                       : <><Eye className="h-4 w-4" /> Pré-visualizar campos dinâmicos</>}
            </Button>
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={downloadPDF}>
              <FileDown className="h-4 w-4" /> Visualizar PDF
            </Button>
            <Button type="button" size="sm" variant="ghost" className="w-full" onClick={() => onChange(TEMPLATE_LOCACAO_DINAMICO)}>
              <Pencil className="h-4 w-4" /> Restaurar modelo padrão
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="min-h-[420px]">
        {preview ? (
          <Card>
            <CardContent className="p-4">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{resolved}</pre>
            </CardContent>
          </Card>
        ) : (
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[420px] font-mono text-xs leading-relaxed"
            spellCheck={false}
          />
        )}
      </div>
      </div>
    </div>
  );
}
