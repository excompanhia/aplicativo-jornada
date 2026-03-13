"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function ExpiredPage() {
  const search = useSearchParams();
  const exp = search.get("exp") || "";

  useEffect(() => {
    async function run() {
      try {
        if (!exp) return;

        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) return;

        await fetch(`/api/auth/active-pass?exp=${exp}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
      } catch (e) {
        console.warn("expired check failed", e);
      }
    }

    run();
  }, [exp]);

  return (
    <main
      style={{
        padding: "24px",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "520px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 26 }}>Comprar passe</h1>

      <p
        style={{
          marginTop: 10,
          color: "#374151",
          lineHeight: 1.4,
        }}
      >
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
        Experiência: <b>{exp}</b>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          marginTop: 16,
        }}
      >
        <button
          type="button"
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

      <div
        style={{
          marginTop: 12,
          fontSize: 12,
          opacity: 0.7,
          lineHeight: 1.35,
        }}
      >
        Você será direcionado para o checkout do Mercado Pago em uma nova etapa.
      </div>
    </main>
  );
}