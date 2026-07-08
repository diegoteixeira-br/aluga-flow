import { useRef, useState } from "react";
import { toJpeg } from "html-to-image";
import { Loader2, Instagram, Facebook, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import logoSrc from "@/assets/alugaflow-symbol.png";
import { formatBRL } from "@/lib/format";

type Network = "instagram" | "facebook" | "share";

type Props = {
  title: string;
  imageUrl?: string | null;
  price?: number | null;
  subtitle?: string | null;
  fileName?: string;
  className?: string;
  /** Optional URL sent together with the image so recipients can open the listing/article. */
  shareUrl?: string;
  /** Which network button to render. Defaults to "instagram". */
  network?: Network;
};

/**
 * Renders a hidden 1080x1920 (9:16) story card, converts to JPG via html-to-image
 * and either opens the native share sheet (mobile) or downloads the file (desktop).
 */
export function ShareCardButton({ title, imageUrl, price, subtitle, fileName = "post-alugaflow.jpg", className, shareUrl, network = "instagram" }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function toDataUrlProxy(url: string): Promise<string | null> {
    // html-to-image needs CORS-enabled images. Fetch then base64 to embed inline.
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((r) => {
        const fr = new FileReader();
        fr.onload = () => r(String(fr.result));
        fr.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async function generate() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      // Pre-embed the background image as data URL to sidestep CORS taint.
      if (imageUrl) {
        const bgEl = cardRef.current.querySelector<HTMLDivElement>("[data-bg]");
        const inline = await toDataUrlProxy(imageUrl);
        if (bgEl && inline) bgEl.style.backgroundImage = `url(${inline})`;
      }

      const dataUrl = await toJpeg(cardRef.current, {
        quality: 0.92,
        pixelRatio: 1,
        width: 1080,
        height: 1920,
        cacheBust: true,
        backgroundColor: "#0f172a",
      });

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: "image/jpeg" });

      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title, text: title });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success("Card baixado! Compartilhe no Instagram ou WhatsApp.");
      }
    } catch (e) {
      console.error("[share-card]", e);
      toast.error("Não foi possível gerar o card. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const Icon = network === "facebook" ? Facebook : network === "instagram" ? Instagram : Share2;
  const label = network === "facebook" ? "Facebook" : network === "instagram" ? "Instagram" : "Compartilhar";

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={generate} disabled={busy} className={className} aria-label={`Compartilhar no ${label}`}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
        {label}
      </Button>

      {/* Off-screen render target */}
      <div style={{ position: "fixed", left: "-99999px", top: 0, pointerEvents: "none", opacity: 0 }} aria-hidden>
        <div
          ref={cardRef}
          style={{
            width: 1080,
            height: 1920,
            position: "relative",
            overflow: "hidden",
            backgroundColor: "#0f172a",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            color: "#fff",
          }}
        >
          <div
            data-bg
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: imageUrl ? `url(${imageUrl})` : "linear-gradient(135deg,#1e3a8a,#0f172a)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          {/* Dark gradient overlay for legibility */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.75) 78%, rgba(0,0,0,0.95) 100%)",
            }}
          />

          {/* Top bar: logo */}
          <div style={{ position: "absolute", top: 60, left: 60, right: 60, display: "flex", alignItems: "center", gap: 20 }}>
            <img src={logoSrc} alt="" width={96} height={96} style={{ width: 96, height: 96, objectFit: "contain" }} crossOrigin="anonymous" />
            <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.02em" }}>AlugaFlow</span>
          </div>

          {/* Bottom content */}
          <div style={{ position: "absolute", left: 60, right: 60, bottom: 120 }}>
            {price != null && (
              <div
                style={{
                  display: "inline-block",
                  padding: "18px 36px",
                  borderRadius: 999,
                  background: "#fff",
                  color: "#0f172a",
                  fontSize: 56,
                  fontWeight: 800,
                  marginBottom: 40,
                  letterSpacing: "-0.02em",
                }}
              >
                {formatBRL(price)}<span style={{ fontSize: 32, fontWeight: 500, opacity: 0.7 }}>/mês</span>
              </div>
            )}
            <div
              style={{
                fontSize: 88,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                textShadow: "0 4px 24px rgba(0,0,0,0.5)",
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                style={{
                  marginTop: 28,
                  fontSize: 40,
                  fontWeight: 500,
                  opacity: 0.9,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {subtitle}
              </div>
            )}
            <div style={{ marginTop: 48, fontSize: 32, fontWeight: 600, opacity: 0.85, letterSpacing: "0.02em" }}>
              alugaflow.com.br
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
