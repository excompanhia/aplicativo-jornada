"use client";

import Link from "next/link";

export default function ExpiredPage() {
  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <h1 style={{ margin: 0 }}>Passe expirou</h1>

      <div style={{ fontSize: 14, opacity: 0.85, lineHeight: 1.35 }}>
        Seu acesso terminou. Para continuar a experiência, escolha um novo passe.
      </div>

      <div style={{ borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 13, opacity: 0.75 }}>Escolher passe</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          <Link
            href="/?scroll=planos"
            style={{
              height: 52,
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.15)",
              fontSize: 16,
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              color: "black",
            }}
          >
            Voltar para a landing (planos)
          </Link>

          <Link
            href="/checkout?plano=1h"
            style={{
              height: 52,
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.15)",
              fontSize: 16,
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              color: "black",
            }}
          >
            Comprar 1 hora
          </Link>

          <Link
            href="/checkout?plano=2h"
            style={{
              height: 52,
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.15)",
              fontSize: 16,
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              color: "black",
            }}
          >
            Comprar 2 horas
          </Link>

          <Link
            href="/checkout?plano=day"
            style={{
              height: 52,
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.15)",
              fontSize: 16,
              background: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              color: "black",
            }}
          >
            Comprar 24 horas
          </Link>
        </div>
      </div>
    </main>
  );
}