// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview"; // vision-capable

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

    const body = await req.json();
    const propertyId: string = String(body?.property_id ?? "").trim();
    const title: string = String(body?.title ?? "").trim();
    const currentDescription: string = String(body?.description ?? "").trim();
    if (!propertyId) return json({ error: "property_id é obrigatório" }, 400);

    // Confirm the user owns this property
    const { data: prop, error: propErr } = await supabase
      .from("properties")
      .select("id, user_id, nickname, type, bedrooms, bathrooms, area_m2, city, neighborhood, state")
      .eq("id", propertyId)
      .maybeSingle();
    if (propErr) return json({ error: propErr.message }, 500);
    if (!prop || prop.user_id !== userData.user.id) return json({ error: "Forbidden" }, 403);

    const { data: photos, error: phErr } = await supabase
      .from("property_photos")
      .select("storage_path")
      .eq("property_id", propertyId)
      .order("sort_order")
      .limit(8);
    if (phErr) return json({ error: phErr.message }, 500);
    const paths = (photos ?? []).map((p) => p.storage_path);
    if (paths.length === 0) return json({ error: "O imóvel não possui fotos" }, 400);

    const { data: signed, error: sErr } = await supabase.storage.from("property-photos").createSignedUrls(paths, 600);
    if (sErr) return json({ error: sErr.message }, 500);
    const imageUrls = (signed ?? []).map((s) => s.signedUrl).filter(Boolean);

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "Missing LOVABLE_API_KEY" }, 500);

    const sys = "Você é um corretor de imóveis experiente. Analise o título, as anotações prévias e as fotos deste imóvel. Escreva uma descrição comercial altamente profissional, persuasiva e bem formatada (usando parágrafos curtos e bullet points para destaques). Destaque o potencial do espaço, a iluminação, o acabamento e possíveis usos. Escreva em português do Brasil. Responda apenas com o texto da descrição, sem títulos H1 nem comentários.";

    const context = [
      title ? `Título do anúncio: ${title}` : `Apelido interno: ${prop.nickname}`,
      prop.type ? `Tipo: ${prop.type}` : "",
      prop.bedrooms != null ? `Quartos: ${prop.bedrooms}` : "",
      prop.bathrooms != null ? `Banheiros: ${prop.bathrooms}` : "",
      prop.area_m2 ? `Área: ${prop.area_m2} m²` : "",
      [prop.neighborhood, prop.city, prop.state].filter(Boolean).join(", "),
      currentDescription ? `\nAnotações/descrição atual do proprietário:\n${currentDescription}` : "",
    ].filter(Boolean).join("\n");

    const userContent: any[] = [
      { type: "text", text: `${context}\n\nGere a descrição comercial do imóvel com base nas fotos abaixo.` },
      ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
    ];

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return json({ error: `AI gateway ${res.status}: ${t}` }, 500);
    }
    const data = await res.json();
    const description = data?.choices?.[0]?.message?.content ?? "";
    if (!description) return json({ error: "Resposta vazia da IA" }, 500);
    return json({ description: String(description).trim() });
  } catch (e: any) {
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
