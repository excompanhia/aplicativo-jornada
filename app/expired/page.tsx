"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

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

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon);
}

export default function ExpiredPage() {
  const router = useRouter();
  const [exp, setExp] = useState<string>("");

  useEffect(() => {
    const supabase = getSupabaseClient();

    async function run() {
      try {
        const sp = new URLSearchParams(window.location.search);
        const fromUrl = (sp.get("exp") || "").trim();
        const finalExp = fromUrl || getLastExpFallback() || "audiowalk1";

        setExp(finalExp);
        persistLastExp(finalExp);

        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session?.access_token) return;

        await fetch(`/api/auth/active-pass?exp=${encodeURIComponent(finalExp)}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });
      } catch (e) {
        console.warn("expired check failed", e);
      }
    }

    run();
  }, []);

  function goCheckout(plano: "1h" | "2h" | "day") {
    const url = exp
      ? `/checkout?plano=${plano}&exp=${encodeURIComponent(exp)}`
      : `/checkout?plano=${plano}`;
    router.push(url);
  }

  function goLanding() {
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
      <h1 style={{ margin: 0, fontSize: 26 }}>Comprar passe</h1>

      <p style={{ marginTop: 10, color: "#374151", lineHeight: 1.4 }}>
        Escolha um passe para liberar o acesso temporário à experiência.
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
            marginTop: 6,
          }}
        >
          Voltar para a landing
        </button>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, lineHeight: 1.35 }}>
        Você será direcionado para o checkout do Mercado Pago em uma nova etapa.
      </div>
    </main>
  );
}
