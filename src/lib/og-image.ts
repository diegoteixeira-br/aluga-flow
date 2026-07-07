/**
 * Optimize a Supabase Storage URL for use as an Open Graph image.
 * WhatsApp requires JPG/PNG, ideally <300kb and near 1.91:1 (1200x630) or 1:1.
 * Supabase supports image transforms via the /render/image/ endpoint.
 */
export function toOgImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // Rewrite storage/object → storage/render/image for supabase URLs so we can apply transforms.
    if (u.pathname.includes("/storage/v1/object/")) {
      u.pathname = u.pathname.replace("/storage/v1/object/", "/storage/v1/render/image/");
    }
    // Force OG-friendly dimensions/quality/format regardless of any pre-existing params.
    u.searchParams.set("width", "1200");
    u.searchParams.set("height", "630");
    u.searchParams.set("resize", "cover");
    u.searchParams.set("quality", "70");
    return u.toString();
  } catch {
    return url;
  }
}
