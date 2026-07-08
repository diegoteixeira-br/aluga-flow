// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MODEL = "google/gemini-3-flash-preview";
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
      const userAsksYear = /\b(20\d{2}|ano\s+atual|neste\s+ano|este\s+ano)\b/i.test(topic);
      const sys = `Você é um copywriter profissional e especialista em mercado imobiliário, focado em gatilhos mentais e SEO. Sua tarefa é criar sugestões de títulos magnéticos e persuasivos baseados no tema fornecido.

Regras Estritas:

- PROIBIDO usar o ano atual (ex: ${currentYear}) ou qualquer outro ano nos títulos, a menos que o usuário peça explicitamente.
- Gere curiosidade: Use formatos como o segredo revelado, o erro comum, a nova regra ignorada, ou como resolver uma grande dor. (Ex: 'O detalhe na vistoria que está custando caro aos proprietários' ou 'A nova mudança silenciosa no IGP-M').
- Foque na dor ou no desejo: Pense no que tira o sono de quem aluga ou administra imóveis (inadimplência, contratos, impostos, lucro).
- Não pareça robótico ou excessivamente formal. Seja direto e instigante.
- Sempre em português do Brasil. Responda APENAS com JSON válido.`;
      const user = `Gere ${count} sugestões de títulos de artigos sobre o mercado imobiliário brasileiro${topic ? ` com foco em: "${topic}"` : ""}.${userAsksYear ? "" : " Não inclua nenhum ano nos títulos."} Retorne JSON: {"titles":[{"title":"...","angle":"breve ângulo do gatilho mental usado"}]}.`;
      const r = await callAI(key, sys, user, true);
      const parsed = safeJson(r);
      return json({ titles: parsed?.titles ?? [] });
    }


    if (action === "generate_article") {
      const title: string = (body?.title ?? "").toString().trim();
      const angle: string = (body?.angle ?? "").toString().trim();
      if (!title) return json({ error: "title é obrigatório" }, 400);
      const currentYear = new Date().getFullYear();
      const titleMentionsYear = /\b20\d{2}\b/.test(title);
      const sys = `Você é um redator especialista em mercado imobiliário. Escreva um artigo completo, engajador e otimizado para SEO baseado no título fornecido.

Regra Absoluta: Escreva um conteúdo 'evergreen' (perene). É PROIBIDO mencionar o ano atual (ex: ${currentYear}) no texto${titleMentionsYear ? ", exceto se for imprescindível para a análise pedida no título" : ", a menos que o título exija especificamente uma análise daquele ano"}. Não inicie parágrafos falando sobre o ano.

Foque em dicas práticas, resolução de problemas (dores de locadores e locatários) e use formatação rica (Markdown, H2, H3, bullet points). Escreva sempre em português do Brasil. Responda APENAS com JSON válido, sem texto fora do JSON.`;
      const user = `Escreva um artigo de blog completo a partir deste título (NÃO altere o título, use-o apenas como referência de tema): "${title}".${angle ? ` Abordagem: ${angle}.` : ""}

Requisitos OBRIGATÓRIOS do JSON de resposta:
- "title": repita EXATAMENTE o título fornecido, sem modificar.
- "slug": kebab-case, sem acentos, sem pontuação, derivado do title, máx. 70 caracteres.
- "excerpt": resumo entre 110 e 150 caracteres, atrativo, sem aspas.
- "content": Markdown SEM título H1 (não comece com "# ..."). Use "## Subtítulo" e "### " para seções, "- " para listas e "**negrito**" para destaques. Não use imagens nem links. 6 a 9 seções, 700 a 1100 palavras no total. Inclua uma seção final "## Conclusão" com chamada para ação sutil para proprietários organizarem aluguéis com tecnologia. Evite promessas jurídicas absolutas; oriente a procurar um advogado quando necessário.

Retorne EXATAMENTE: {"title":"...","slug":"...","excerpt":"...","content":"..."}`;
      const r = await callAI(key, sys, user, true);
      const parsed = safeJson(r);
      if (!parsed?.content) return json({ error: "Falha ao gerar artigo" }, 500);

      const finalTitle = title;
      const finalSlug = slugify(finalTitle);
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
