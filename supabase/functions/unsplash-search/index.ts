// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const accessKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
    if (!accessKey) return json({ error: "UNSPLASH_ACCESS_KEY não configurada. Crie uma em https://unsplash.com/developers e salve como secret." }, 500);

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action ?? "search";

    if (action === "track_download") {
      const url: string = body?.downloadUrl ?? "";
      if (!url || !url.startsWith("https://api.unsplash.com/")) return json({ error: "downloadUrl inválida" }, 400);
      const r = await fetch(url, { headers: { Authorization: `Client-ID ${accessKey}` } });
      if (!r.ok) return json({ error: `Unsplash ${r.status}` }, 500);
      return json({ ok: true });
    }

    // default: search
    const query: string = (body?.query ?? "").toString().trim();
    const page: number = Math.max(1, Math.min(Number(body?.page ?? 1), 10));
    const perPage = 12;
    if (!query) return json({ results: [] });

    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", query);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("content_filter", "high");
    url.searchParams.set("orientation", "landscape");

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
    });
    if (!r.ok) {
      const t = await r.text();
      return json({ error: `Unsplash ${r.status}: ${t}` }, 500);
    }
    const data = await r.json();
    const results = (data?.results ?? []).map((p: any) => ({
      id: p.id,
      description: p.alt_description || p.description || "",
      thumb: p.urls?.small,
      regular: p.urls?.regular,
      full: p.urls?.full,
      width: p.width,
      height: p.height,
      downloadLocation: p.links?.download_location,
      user: {
        name: p.user?.name,
        username: p.user?.username,
        link: p.user?.links?.html,
      },
    }));
    return json({ results, total: data?.total ?? 0, totalPages: data?.total_pages ?? 0 });
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
