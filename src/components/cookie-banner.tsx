import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "alugaflow_cookie_consent_v1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch { /* noop */ }
  }, []);

  const accept = (value: "all" | "essential") => {
    try { localStorage.setItem(STORAGE_KEY, value); } catch { /* noop */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-4 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Usamos cookies essenciais para o funcionamento do site e cookies opcionais para
          melhorar sua experiência. Ao continuar navegando você concorda com nossa{" "}
          <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link>{" "}
          e os{" "}
          <Link to="/termos" className="text-primary underline">Termos de Uso</Link>.
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => accept("essential")}>Apenas essenciais</Button>
          <Button size="sm" onClick={() => accept("all")}>Aceitar todos</Button>
        </div>
      </div>
    </div>
  );
}
