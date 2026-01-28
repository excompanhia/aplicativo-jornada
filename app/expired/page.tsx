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

function persistLastExp(slug: string) {
  try {
    if (!slug) return;
    localStorage.setItem("jornada:last_exp", slug);
  } catch {}
}

export default function ExpiredPage() {
  const router = useRouter();
  const [exp, setExp] = useState<string>("");

  useEffect(() => {
    // ✅ não usa useSearchParams (evita erro de prerender)
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = (sp.get("exp") || "").trim();

    // ✅ fallback seguro
    const finalExp = fromUrl || getLastExpFallback() || "audiowalk1";

    setExp(finalExp);

    // ✅ mantém o app consistente (landing usa isso)
    persistLastExp(finalExp);
  }, []);

  function goCheckout(plano: "1h" | "2h" | "day") {
    const url = exp
      ? `/checkout?plano=${plano}&exp=${encodeURIComponent(exp)}`
      : `/checkout?plano=${plano}`;
    router.push(url);
  }

  function goJourney() {
    if (!exp) return;
    router.push(`/journey/${encodeURIComponent(exp)}`);
  }

  function goLanding() {
    // landing é global; ela vai ler jornada:last_exp se precisar
    router.replace("/");
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

        {/* ✅ novo: caminho canônico pro Journey */}
        <button
          type="button"
          onClick={goJourney}
          disabled={!exp}
          style={{
            width: "100%",
            height: 48,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "rgba(0,0,0,0.04)",
            fontSize: 14,
            cursor: exp ? "pointer" : "not-allowed",
            opacity: exp ? 1 : 0.6,
            marginTop: 6,
          }}
        >
          ENTRAR NA EXPERIÊNCIA
        </button>

        <button
          type="button"
          onClick={goLanding}
          style={{
            width: "100%",
            height: 44,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Voltar para a landing
        </button>
      </div>
    </main>
  );
}
