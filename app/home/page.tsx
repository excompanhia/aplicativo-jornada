"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div
        style={{
          borderRadius: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.15)",
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0, lineHeight: 1.2 }}>
          Home (oficial)
        </h1>

        <p style={{ margin: "10px 0 0 0", lineHeight: 1.4 }}>
          Esta é a Home do produto. Ainda está em construção.
        </p>

        <p style={{ margin: "10px 0 0 0", fontSize: 13, opacity: 0.8 }}>
          Por enquanto, a rota <b>/</b> continua sendo a landing atual (técnica).
        </p>
      </div>

      <div
        style={{
          borderRadius: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700 }}>Atalhos</div>

        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 48,
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontSize: 16,
            textDecoration: "none",
          }}
        >
          Voltar para /
        </Link>

        <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
          (Depois vamos colocar aqui: “Continuar última experiência”, lista de
          experiências publicadas, etc.)
        </div>
      </div>
    </main>
  );
}
