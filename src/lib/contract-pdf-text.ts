import jsPDF from "jspdf";

/** Renderiza texto simples (contrato com tokens já resolvidos) em PDF A4 paginado. */
export function renderTextToPDF(text: string, filenameSlug = "contrato"): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 18;
  const W = doc.internal.pageSize.getWidth() - M * 2;
  const H = doc.internal.pageSize.getHeight();
  let y = M;
  doc.setFont("helvetica", "normal").setFontSize(10);
  const paragraphs = text.split(/\n/);
  for (const p of paragraphs) {
    if (p.trim() === "") { y += 3; continue; }
    const isHeading = /^(CONTRATO|CL[ÁA]USULA|LOCADOR:|LOCAT[ÁA]RIO:|FIADOR)/.test(p.trim());
    doc.setFont("helvetica", isHeading ? "bold" : "normal");
    const lines = doc.splitTextToSize(p, W);
    for (const ln of lines) {
      if (y > H - M) { doc.addPage(); y = M; }
      doc.text(ln, M, y);
      y += 5;
    }
  }
  doc.setProperties({ title: filenameSlug });
  return doc;
}

export function downloadTextPDF(text: string, filenameSlug = "contrato"): void {
  const doc = renderTextToPDF(text, filenameSlug);
  doc.save(`${filenameSlug}.pdf`);
}
