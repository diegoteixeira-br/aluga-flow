// Edge Function: admin
// Substitui src/lib/admin.functions.ts (createServerFn).
// Ações: metrics | list_users | set_plan | toggle_active | toggle_admin | send_broadcast
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail } from "../_shared/resend.ts";
import { broadcastEmail, personalize, LOGO_ATTACHMENT } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

  const sb = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  // Admin gate (defense-in-depth; RPCs também checam internamente).
  const { data: isAdmin, error: roleErr } = await sb.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleErr || !isAdmin) return json({ error: "Forbidden: admin only" }, 403);

  let payload: any = {};
  try { payload = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const action = String(payload.action || "");

  try {
    if (action === "metrics") {
      const { data, error } = await sb.rpc("admin_dashboard_metrics");
      if (error) throw error;
      return json(data ?? {});
    }

    if (action === "list_users") {
      const { data, error } = await sb.rpc("admin_list_users");
      if (error) throw error;
      return json(data ?? []);
    }

    if (action === "set_plan") {
      const { userId: target, plan } = payload;
      if (!target || !["free", "investidor", "imobiliaria"].includes(plan)) {
        return json({ error: "Invalid payload" }, 400);
      }
      const { error } = await sb.rpc("admin_update_user_plan", { _user_id: target, _plan: plan });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "toggle_active") {
      const { userId: target, active } = payload;
      if (!target || typeof active !== "boolean") return json({ error: "Invalid payload" }, 400);
      const { error } = await sb.rpc("admin_toggle_user_active", { _user_id: target, _active: active });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "toggle_admin") {
      const { userId: target, makeAdmin } = payload;
      if (!target || typeof makeAdmin !== "boolean") return json({ error: "Invalid payload" }, 400);
      const { error } = await sb.rpc("admin_toggle_admin", { _user_id: target, _make_admin: makeAdmin });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "set_email") {
      const { userId: target, email } = payload;
      if (!target || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Invalid payload" }, 400);
      }
      const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!SERVICE) return json({ error: "Service role not configured" }, 500);
      const admin = createClient(SUPABASE_URL, SERVICE, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      // Atualiza o e-mail diretamente, sem exigir confirmação (admin action).
      // O `id` do usuário permanece o mesmo — todos os dados ficam preservados.
      const { error } = await admin.auth.admin.updateUserById(target, {
        email: email.toLowerCase().trim(),
        email_confirm: true,
      });
      if (error) throw error;
      await sb.from("admin_logs").insert({
        user_id: userId, action: "set_email",
        details: { target, new_email: email },
      });
      return json({ ok: true });
    }

    if (action === "send_broadcast") {
      const { subject, body, targetPlan, userId: targetUserId } = payload;
      const isUserTarget = targetPlan === "user";
      const validPlanTargets = ["all", "free", "investidor", "imobiliaria", "user"];
      if (!subject || !body || !validPlanTargets.includes(targetPlan)) {
        return json({ error: "Invalid payload" }, 400);
      }
      if (isUserTarget && !targetUserId) {
        return json({ error: "userId obrigatório quando targetPlan=user" }, 400);
      }
      const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!SERVICE) return json({ error: "Service role not configured" }, 500);
      const admin = createClient(SUPABASE_URL, SERVICE, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Buscar destinatários
      let profs: Array<{ id: string; full_name?: string | null; plan?: string | null }> = [];
      if (isUserTarget) {
        const { data, error } = await admin.from("profiles").select("id, full_name, plan").eq("id", targetUserId).limit(1);
        if (error) throw error;
        profs = data ?? [];
      } else {
        let profQ = admin.from("profiles").select("id, full_name, plan");
        if (targetPlan !== "all") profQ = profQ.eq("plan", targetPlan);
        const { data, error } = await profQ;
        if (error) throw error;
        profs = data ?? [];
      }

      const html0 = broadcastEmail(subject, body); void html0;
      let sent = 0; let failed = 0; const errs: string[] = [];
      for (const p of profs) {
        try {
          const { data: u } = await admin.auth.admin.getUserById(p.id);
          const email = u?.user?.email;
          if (!email) { failed++; continue; }
          const vars = { name: p.full_name, email, plan: p.plan };
          const personalSubject = personalize(subject, vars);
          const personalHtml = broadcastEmail(personalSubject, body, vars);
          const r = await sendEmail({ to: email, subject: personalSubject, html: personalHtml, attachments: [LOGO_ATTACHMENT] });
          if (r.error) { failed++; errs.push(r.error); } else { sent++; }
        } catch (e) { failed++; errs.push((e as Error).message); }
      }

      await admin.from("admin_email_log").insert({
        subject, body, target_plan: isUserTarget ? `user:${targetUserId}` : targetPlan,
        recipients_count: sent, sent_by: userId,
        status: failed === 0 ? "sent" : (sent === 0 ? "failed" : "partial"),
      });
      await admin.from("admin_logs").insert({
        user_id: userId, action: "send_broadcast",
        details: { subject, target: isUserTarget ? `user:${targetUserId}` : targetPlan, sent, failed, errors: errs.slice(0, 5) },
      });
      return json({ ok: true, recipients: sent, failed });
    }

    if (action === "ai_compose") {
      // mode: subject | body | improve
      const { mode, prompt, currentSubject, currentBody, tone } = payload;
      if (!["subject", "body", "improve"].includes(mode)) {
        return json({ error: "mode inválido" }, 400);
      }
      const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

      const sys = "Você é um assistente especialista em redação de e-mails corporativos em português do Brasil para a plataforma AlugaFlow (gestão de aluguéis). Seja claro, cordial, profissional e direto. Nunca invente fatos. Não use emojis em excesso. Não inclua placeholders entre colchetes.";
      let userMsg = "";
      if (mode === "subject") {
        userMsg = `Gere APENAS UM assunto de e-mail curto (máx 70 caracteres), atrativo e sem clickbait, com base neste briefing:\n\n"""${prompt ?? currentBody ?? ""}"""\n\nResponda somente com o assunto, sem aspas e sem prefixos.`;
      } else if (mode === "body") {
        userMsg = `Escreva o CORPO de um e-mail (texto puro, parágrafos curtos separados por linha em branco, sem HTML, sem assinatura genérica).\nTom: ${tone || "profissional e cordial"}.\nAssunto de referência: "${currentSubject || ""}".\nBriefing/objetivo:\n"""${prompt ?? ""}"""\n\nNão inclua o assunto na resposta. Não use markdown.`;
      } else {
        userMsg = `Corrija a ortografia/gramática e melhore a clareza do texto abaixo SEM mudar o significado. Mantenha o idioma português do Brasil, tom profissional. Devolva apenas o texto revisado, em parágrafos curtos, sem markdown.\n\nAssunto atual: "${currentSubject || ""}"\n\nCorpo atual:\n"""${currentBody ?? ""}"""`;
      }

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userMsg },
          ],
          temperature: 0.7,
        }),
      });
      if (aiRes.status === 429) return json({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
      if (!aiRes.ok) {
        const t = await aiRes.text();
        return json({ error: `IA falhou: ${aiRes.status} ${t.slice(0, 200)}` }, 500);
      }
      const aiData = await aiRes.json();
      const text = aiData?.choices?.[0]?.message?.content?.trim?.() ?? "";
      return json({ ok: true, text });
    }

    if (action === "legal_ai_edit") {
      const { slug, currentContent, instruction } = payload;
      if (!["termos", "privacidade"].includes(slug)) return json({ error: "slug inválido" }, 400);
      if (!instruction || typeof instruction !== "string") return json({ error: "instruction obrigatória" }, 400);
      const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_KEY) return json({ error: "LOVABLE_API_KEY ausente" }, 500);

      const titulo = slug === "termos" ? "Termos de Uso" : "Política de Privacidade";
      const sys = `Você é um assistente jurídico que edita o documento "${titulo}" da plataforma AlugaFlow (SaaS de gestão imobiliária no Brasil). Mantenha conformidade com LGPD e legislação brasileira. Devolva SEMPRE o documento INTEIRO atualizado em HTML simples (use apenas <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <a>). Não use markdown, não envolva em <html> ou <body>, não inclua comentários, não use blocos de código. Preserve numeração e estrutura existente, alterando apenas o que foi pedido.`;
      const userMsg = `Conteúdo atual (HTML):\n"""\n${currentContent ?? ""}\n"""\n\nInstrução do administrador:\n"""\n${instruction}\n"""\n\nResponda apenas com o HTML final completo do documento.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
          temperature: 0.3,
        }),
      });
      if (aiRes.status === 429) return json({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }, 402);
      if (!aiRes.ok) {
        const t = await aiRes.text();
        return json({ error: `IA falhou: ${aiRes.status} ${t.slice(0, 200)}` }, 500);
      }
      const aiData = await aiRes.json();
      let text = aiData?.choices?.[0]?.message?.content?.trim?.() ?? "";
      // strip eventual fences
      text = text.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();
      return json({ ok: true, content: text });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (e: any) {
    console.error("[admin]", action, e?.message ?? e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
