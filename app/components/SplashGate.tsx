"use client";

import { ReactNode, useEffect, useState } from "react";

const KEY = "jornada:splash:shown";

export default function SplashGate({
  children,
  seconds = 3,
}: {
  children: ReactNode;
  seconds?: number;
}) {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Regra: splash só aparece 1x por “sessão” (até fechar e abrir de novo)
    try {
      const already = window.sessionStorage.getItem(KEY);
      if (already === "true") return;

      // primeira vez nesta sessão: mostra splash
      window.sessionStorage.setItem(KEY, "true");
      setShowSplash(true);

      const t = window.setTimeout(() => {
        setShowSplash(false);
      }, Math.max(0, seconds) * 1000);

      return () => window.clearTimeout(t);
    } catch {
      // Se sessionStorage falhar por algum motivo, não trava o app.
      return;
    }
  }, [seconds]);

  if (!showSplash) return <>{children}</>;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999,
      }}
    >
      {/* Substitua por logo/imagem/animação depois */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.3 }}>JORNADA</div>
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.65 }}>abrindo…</div>
      </div>
    </div>
  );
}
