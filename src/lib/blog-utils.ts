export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

export function readingTime(text: string): number {
  const words = (text || "").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatDateBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Very small markdown-ish renderer: paragraphs, ## headings, - lists, **bold**
export function renderContent(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const blocks = md.split(/\n{2,}/);
  return blocks.map((blk) => {
    const t = blk.trim();
    if (t.startsWith("## ")) return `<h2 class="mt-8 text-2xl font-bold">${esc(t.slice(3))}</h2>`;
    if (t.startsWith("# ")) return `<h1 class="mt-8 text-3xl font-bold">${esc(t.slice(2))}</h1>`;
    if (t.split("\n").every((l) => l.trim().startsWith("- "))) {
      const items = t.split("\n").map((l) => `<li>${inline(esc(l.replace(/^-\s+/, "")))}</li>`).join("");
      return `<ul class="my-4 list-disc space-y-1 pl-6">${items}</ul>`;
    }
    return `<p class="my-4 leading-relaxed">${inline(esc(t)).replace(/\n/g, "<br/>")}</p>`;
  }).join("\n");
}
function inline(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
