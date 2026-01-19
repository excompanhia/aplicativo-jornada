"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function CheckoutInner() {
  const searchParams = useSearchParams();
  const plano = searchParams.get("plano");

  const planoTexto = useMemo(() => {
    if (plano === "1h") return "1 hora — R$ 14,90";
    if (plano === "2h") return "2 horas — R$ 19,90";
    if (plano === "day") return "24 horas — R$ 29,90";
    return "(nenhum plano selecionado)";
  }, [plano]);

  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Checkout</h1>

      <div style={{ borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 13, opacity: 0.75 }}>Plano</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{planoTexto}</div>
      </div>

      <div style={{ borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.35 }}>
          Nesta etapa, o pagamento ainda é “simulado”.
          <br />
          Próximo passo: Mercado Pago (Pix + cartão) em checkout único.
        </div>
      </div>

      <Link
        href="/journey"
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
        Continuar (simulado)
      </Link>

      <Link
        href="/"
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
        Voltar para a landing
      </Link>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={<main style={{ padding: 16 }}>Carregando checkout…</main>}
    >
      <CheckoutInner />
    </Suspense>
  );
}