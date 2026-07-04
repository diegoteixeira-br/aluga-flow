// Cliente direto (SPA). Leitura pública governada por RLS (anon: published=true).
import { supabase } from "@/integrations/supabase/client";

type ListInput = { page?: number; pageSize?: number; limit?: number } | undefined;

export async function listPublishedPosts(args?: { data?: ListInput } | ListInput) {
  const data: ListInput = (args as any)?.data ?? (args as ListInput) ?? {};
  if (data?.limit) {
    const { data: rows } = await supabase
      .from("posts")
      .select("id,title,slug,excerpt,cover_image_url,author_name,created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    return { rows: rows ?? [], total: rows?.length ?? 0 };
  }
  const page = data?.page ?? 1;
  const pageSize = data?.pageSize ?? 9;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data: rows, count } = await supabase
    .from("posts")
    .select("id,title,slug,excerpt,cover_image_url,author_name,created_at", { count: "exact" })
    .eq("published", true)
    .order("created_at", { ascending: false })
    .range(from, to);
  return { rows: rows ?? [], total: count ?? 0 };
}

export async function getPostBySlug(args: { data: { slug: string } } | { slug: string }) {
  const slug = (args as any)?.data?.slug ?? (args as any)?.slug;
  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (!post) return { post: null, related: [] };
  const { data: related } = await supabase
    .from("posts")
    .select("id,title,slug,excerpt,cover_image_url,created_at")
    .eq("published", true)
    .neq("id", post.id)
    .order("created_at", { ascending: false })
    .limit(3);
  return { post, related: related ?? [] };
}

export async function listAllPostSlugs() {
  const { data } = await supabase
    .from("posts")
    .select("slug,updated_at")
    .eq("published", true);
  return data ?? [];
}
