// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "google/gemini-2.5-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function slugify(s: string) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

// Remove a leading "# Título" line from markdown so it doesn't duplicate the title field.
function stripLeadingH1(md: string): string {
  if (!md) return md;
  const lines = md.split(/\r?\n/);
  // skip leading blanks
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (i < lines.length && /^#\s+/.test(lines[i])) {
    lines.splice(i, 1);
    // also drop one trailing blank line right after the removed heading
    if (i < lines.length && lines[i].trim() === "") lines.splice(i, 1);
  }
  return lines.join("\n").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "Missing LOVABLE_API_KEY" }, 500);

    const body = await req.json();
    const action: "suggest_titles" | "generate_article" = body?.action;

    if (action === "suggest_titles") {
      const topic: string = (body?.topic ?? "").toString().trim();
      const count: number = Math.min(Math.max(Number(body?.count ?? 6), 3), 10);
      const currentYear = new Date().getFullYear();
      const sys = `Você é editor-chefe de um blog imobiliário brasileiro em ${currentYear}. Sugira títulos de artigos ATUAIS, úteis, com foco em SEO, em português do Brasil. NUNCA use anos anteriores a ${currentYear} no título (proibido citar 2023, 2024, 2025 etc.). Se citar ano, use SEMPRE ${currentYear}. Cada título deve ter entre 45 e 80 caracteres, ser específico e atrativo. Responda APENAS com JSON.`;
      const user = `Gere ${count} sugestões de títulos de artigos sobre o mercado imobiliário brasileiro em ${currentYear}${topic ? ` com foco em: "${topic}"` : ""}. Foque em pautas QUENTES e ATUAIS de ${currentYear}: tendências de mercado neste ano, taxa Selic e financiamento em ${currentYear}, reajuste de aluguel (IGP-M/IPCA) hoje, mudanças recentes na Lei do Inquilinato, garantias locatícias modernas (seguro-fiança, título de capitalização), locação por temporada/Airbnb e nova regulação, LGPD para imobiliárias, uso de IA e automação na gestão de aluguéis, novos produtos de crédito imobiliário, ITBI e tributação atual, golpes em aluguel e como evitar, sustentabilidade e imóveis verdes. Evite temas datados ou notícias de anos anteriores. Retorne JSON: {"titles":[{"title":"...","angle":"breve ângulo"}]}.`;
      const r = await callAI(key, sys, user, true);
      const parsed = safeJson(r);
      return json({ titles: parsed?.titles ?? [] });
    }


    if (action === "generate_article") {
      const title: string = (body?.title ?? "").toString().trim();
      const angle: string = (body?.angle ?? "").toString().trim();
      if (!title) return json({ error: "title é obrigatório" }, 400);
      const currentYear = new Date().getFullYear();
      const sys = `Você é redator especialista em mercado imobiliário brasileiro escrevendo em ${currentYear}. Escreve com clareza, cita leis quando relevante (ex.: Lei 8.245/91), usa exemplos práticos e linguagem acessível ao proprietário independente. Trate o cenário como o atual de ${currentYear} — NUNCA cite anos anteriores (2023, 2024, 2025) como se fossem o presente; se precisar citar ano, use ${currentYear}. Sempre em português do Brasil. Responda APENAS com JSON válido, sem texto fora do JSON.`;
      const user = `Escreva um artigo de blog completo a partir deste título base: "${title}".${angle ? ` Abordagem: ${angle}.` : ""}

Requisitos OBRIGATÓRIOS do JSON de resposta:
- "title": entre 45 e 80 caracteres, completo, específico e atrativo (você pode polir o título base, mas NUNCA devolver vazio, abreviado ou só uma palavra). NÃO inclua o título dentro do "content".
- "slug": kebab-case, sem acentos, sem pontuação, derivado do title, máx. 70 caracteres.
- "excerpt": resumo entre 110 e 150 caracteres, atrativo, sem aspas.
- "content": Markdown SEM título H1 (não comece com "# ..."). Use "## Subtítulo" para seções, "- " para listas e "**negrito**" para destaques. Não use imagens nem links. 6 a 9 seções, 700 a 1100 palavras no total. Inclua uma seção final "## Conclusão" com chamada para ação sutil para proprietários organizarem aluguéis com tecnologia. Evite promessas jurídicas absolutas; oriente a procurar um advogado quando necessário.

Retorne EXATAMENTE: {"title":"...","slug":"...","excerpt":"...","content":"..."}`;
      const r = await callAI(key, sys, user, true);
      const parsed = safeJson(r);
      if (!parsed?.content) return json({ error: "Falha ao gerar artigo" }, 500);

      const finalTitle = (parsed.title && String(parsed.title).trim().length >= 20)
        ? String(parsed.title).trim()
        : title;
      const finalSlug = parsed.slug && String(parsed.slug).match(/^[a-z0-9-]{3,}$/)
        ? String(parsed.slug)
        : slugify(finalTitle);
      const finalContent = stripLeadingH1(String(parsed.content));
      const finalExcerpt = String(parsed.excerpt || "").slice(0, 150).trim();

      return json({
        title: finalTitle,
        slug: finalSlug,
        excerpt: finalExcerpt,
        content: finalContent,
      });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

async function callAI(key: string, system: string, user: string, jsonMode: boolean) {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

function safeJson(s: string): any {
  if (!s) return null;
  try { return JSON.parse(s); } catch { /* try to extract */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { return null; } }
  return null;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
