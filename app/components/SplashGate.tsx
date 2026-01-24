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
    try {
      // Splash aparece apenas 1x por sessão (até fechar e abrir o app)
      const alreadyShown = window.sessionStorage.getItem(KEY);
      if (alreadyShown === "true") return;

      window.sessionStorage.setItem(KEY, "true");
      setShowSplash(true);

      const timer = window.setTimeout(() => {
        setShowSplash(false);
      }, Math.max(0, seconds) * 1000);

      return () => window.clearTimeout(timer);
    } catch {
      return;
    }
  }, [seconds]);

  if (!showSplash) {
    return <>{children}</>;
  }

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
      <img
        src="/splash.png"
        alt="Jornada"
        style={{
          maxHeight: "70vh",
          maxWidth: "90vw",
          width: "auto",
          height: "auto",
        }}
      />
    </div>
  );
}
