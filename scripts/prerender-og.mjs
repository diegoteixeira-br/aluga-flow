#!/usr/bin/env node
/**
 * Pré-renderização de tags OG para crawlers (Facebook/WhatsApp/Twitter).
 *
 * Como o build é SPA estático (Hostinger), o `dist/index.html` é servido
 * para toda URL via .htaccess. Crawlers de redes sociais não executam JS,
 * então nunca veem as tags dinâmicas injetadas pelo TanStack Router.
 *
 * Este script gera arquivos HTML físicos por artigo/anúncio, clonando o
 * shell SPA e substituindo apenas as tags <title>, <meta og:*>, <meta twitter:*>,
 * <meta name="description"> e <link rel="canonical"> no <head>. Os assets JS/CSS
 * permanecem os mesmos → usuários reais continuam navegando via SPA (hidratação),
 * mas crawlers recebem já no primeiro request o HTML com as tags corretas.
 *
 * Saída:
 *   dist/blog/<slug>.html         → servido em /blog/<slug> via rewrite .htaccess
 *   dist/anuncios/<id>.html       → servido em /anuncios/<id>
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const SITE = "https://alugaflow.com.br";
const FALLBACK_IMG = `${SITE}/og-image.png`;
const DIST = resolve(process.cwd(), "dist");
const SHELL_PATH = join(DIST, "index.html");

// Carrega .env manualmente (Node não faz isso sozinho, e este script roda
// separado do Vite). Aceita .env, .env.local, .env.production.
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    if (process.env[key]) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}
for (const f of [".env", ".env.local", ".env.production"]) {
  loadEnvFile(resolve(process.cwd(), f));
}

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!existsSync(SHELL_PATH)) {
  console.warn("[prerender-og] dist/index.html não encontrado, abortando.");
  process.exit(0);
}
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("[prerender-og] SUPABASE_URL/KEY ausentes — pulando pré-render.");
  process.exit(0);
}

const shell = await readFile(SHELL_PATH, "utf8");

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Supabase ${path} → ${res.status}`);
  return res.json();
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function abs(u) {
  if (!u) return FALLBACK_IMG;
  return String(u).startsWith("http") ? u : `${SITE}${u.startsWith("/") ? "" : "/"}${u}`;
}

/**
 * Otimiza URL de imagem do Supabase Storage para OG (WhatsApp/Facebook):
 * força 1200x630, resize cover e qualidade 70 via endpoint /render/image/.
 */
function ogImage(u) {
  if (!u) return FALLBACK_IMG;
  try {
    const url = new URL(abs(u));
    if (url.pathname.includes("/storage/v1/object/")) {
      url.pathname = url.pathname.replace("/storage/v1/object/", "/storage/v1/render/image/");
    }
    url.searchParams.set("width", "1200");
    url.searchParams.set("height", "630");
    url.searchParams.set("resize", "cover");
    url.searchParams.set("quality", "70");
    return url.toString();
  } catch {
    return abs(u);
  }
}

/**
 * Remove todas as tags que vamos reescrever e injeta as novas antes de </head>.
 */
function renderHtml({ title, description, image, url, type = "website", extraJsonLd }) {
  let html = shell;
  // remove title, description, canonical, og:*, twitter:* existentes
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "");
  html = html.replace(
    /<meta[^>]+(name|property)=["'](description|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi,
    "",
  );
  html = html.replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, "");

  const tags = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:type" content="${esc(type)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:site_name" content="AlugaFlow">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:secure_url" content="${esc(image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(title)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
    extraJsonLd
      ? `<script type="application/ld+json">${JSON.stringify(extraJsonLd)}</script>`
      : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  return html.replace(/<\/head>/i, `    ${tags}\n  </head>`);
}

async function writeOut(relPath, html) {
  const full = join(DIST, relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, html, "utf8");
}

// ----- Blog posts -----
let postsCount = 0;
try {
  const posts = await sbGet(
    "posts?select=slug,title,excerpt,content,cover_image_url,created_at,updated_at,published_at,author_name&published=eq.true&order=published_at.desc.nullslast&limit=500",
  );
  for (const p of posts) {
    if (!p.slug) continue;
    const url = `${SITE}/blog/${p.slug}`;
    const desc =
      (p.excerpt && String(p.excerpt).trim()) ||
      String(p.content ?? "")
        .replace(/[#*_`>\-]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);
    const html = renderHtml({
      title: `${p.title} — Blog AlugaFlow`,
      description: desc,
      image: ogImage(p.cover_image_url),
      url,
      type: "article",
      extraJsonLd: {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: p.title,
        description: desc,
        image: p.cover_image_url ? [ogImage(p.cover_image_url)] : undefined,
        datePublished: p.published_at || p.created_at,
        dateModified: p.updated_at,
        author: { "@type": "Person", name: p.author_name },
        publisher: { "@type": "Organization", name: "AlugaFlow" },
        mainEntityOfPage: url,
      },
    });
    await writeOut(`blog/${p.slug}.html`, html);
    postsCount++;
  }
} catch (e) {
  console.warn("[prerender-og] falha ao buscar posts:", e.message);
}

// ----- Anúncios (properties) -----
let propsCount = 0;
try {
  const props = await sbGet(
    "properties?select=id,ad_title,nickname,ad_description,notes,city,state,neighborhood,type,bedrooms,rent_amount&listed_public=eq.true&limit=2000",
  );
  // Busca capa de cada imóvel (primeira foto por sort_order)
  for (const prop of props) {
    let coverUrl = null;
    try {
      const covers = await sbGet(
        `property_photos?select=storage_path&property_id=eq.${prop.id}&order=sort_order.asc&limit=1`,
      );
      const path = covers?.[0]?.storage_path;
      if (path) {
        // URL pública do storage (bucket property-photos)
        coverUrl = `${SUPABASE_URL}/storage/v1/render/image/public/property-photos/${path}?width=1200&quality=80`;
      }
    } catch {}
    const url = `${SITE}/anuncios/${prop.id}`;
    const title = `${prop.ad_title ?? prop.nickname} — Aluguel em ${prop.city}/${prop.state} | AlugaFlow`;
    const priceStr = `R$ ${Number(prop.rent_amount ?? 0).toLocaleString("pt-BR")}/mês`;
    const rawDesc =
      prop.ad_description ||
      prop.notes ||
      `${prop.type ?? "Imóvel"} ${prop.bedrooms ? `com ${prop.bedrooms} quartos ` : ""}para alugar em ${[prop.neighborhood, prop.city, prop.state].filter(Boolean).join(", ")}.`;
    const description = `${priceStr} — ${String(rawDesc).replace(/\s+/g, " ").trim()}`.slice(0, 200);
    const html = renderHtml({
      title,
      description,
      image: abs(coverUrl),
      url,
      type: "product",
    });
    await writeOut(`anuncios/${prop.id}.html`, html);
    propsCount++;
  }
} catch (e) {
  console.warn("[prerender-og] falha ao buscar imóveis:", e.message);
}

console.log(`[prerender-og] gerou ${postsCount} posts e ${propsCount} anúncios.`);
