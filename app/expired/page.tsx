"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getLastExpFallback(): string {
  try {
    return localStorage.getItem("jornada:last_exp") || "";
  } catch {
    return "";
  }
}

export default function ExpiredPage() {
  const router = useRouter();
  const [exp, setExp] = useState<string>("");

  useEffect(() => {
    // ✅ não usa useSearchParams (evita erro de prerender)
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = (sp.get("exp") || "").trim();
    const finalExp = fromUrl || getLastExpFallback();
    setExp(finalExp);
  }, []);

  function goCheckout(plano: "1h" | "2h" | "day") {
    const url = exp
      ? `/checkout?plano=${plano}&exp=${encodeURIComponent(exp)}`
      : `/checkout?plano=${plano}`;
    router.push(url);
  }

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 26 }}>Passe expirado</h1>

      <p style={{ marginTop: 10, color: "#374151", lineHeight: 1.4 }}>
        Você não tem um passe ativo no momento.
      </p>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "rgba(0,0,0,0.03)",
          fontSize: 13,
          color: "#111827",
        }}
      >
        Experiência: <b>{exp || "carregando…"}</b>
      </div>

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <button
          type="button"
          onClick={() => goCheckout("1h")}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Comprar 1 hora — R$ 14,90
        </button>

        <button
          type="button"
          onClick={() => goCheckout("2h")}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Comprar 2 horas — R$ 19,90
        </button>

        <button
          type="button"
          onClick={() => goCheckout("day")}
          style={{
            width: "100%",
            height: 52,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Comprar 24 horas — R$ 29,90
        </button>
      </div>
    </main>
  );
}
