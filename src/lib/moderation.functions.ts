import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ text: z.string().min(1).max(2000) });

const SYSTEM_PROMPT =
  "Você é um moderador de conteúdo de um blog profissional imobiliário. Analise o seguinte comentário. Se contiver xingamentos, discurso de ódio, preconceito, ou ofensas pessoais, responda APENAS com a palavra REPROVADO. Se for um comentário normal, crítica construtiva, dúvida ou elogio, responda APENAS com a palavra APROVADO.";

export const moderateComment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: data.text },
        ],
      }),
    });

    if (res.status === 429) throw new Error("rate_limited");
    if (res.status === 402) throw new Error("credits_exhausted");
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`moderation_failed: ${res.status} ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const verdict = raw.toUpperCase().replace(/[^A-Z]/g, "");
    const approved = verdict.includes("APROVADO") && !verdict.includes("REPROVADO");
    return { approved };
  });
