import { useEffect } from "react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

type Props = {
  slot?: string;
  client?: string;
  format?: string;
  responsive?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export function AdSenseBlock({
  slot = "8117602663",
  client = "ca-pub-2189440969245752",
  format = "auto",
  responsive = true,
  className,
  style,
}: Props) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // ignore
    }
  }, []);

  return (
    <div className={cn("my-6 flex w-full justify-center", className)}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", ...style }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}
