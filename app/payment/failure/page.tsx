"use client";

import Link from "next/link";

export default function PaymentFailurePage() {
  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
      <h1 style={{ margin: 0 }}>Pagamento não concluído</h1>

      <p style={{ margin: 0, opacity: 0.85 }}>
        Não conseguimos finalizar o pagamento. Você pode tentar novamente.
      </p>

      <div style={{ fontSize: 13, opacity: 0.75 }}>
        Dica: se você já pagou (por exemplo, Pix), volte para a tela de confirmação:
      </div>

      <Link
        href="/payment/pending"
        style={{
          height: 48,
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.15)",
          background: "white",
          fontSize: 16,
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Ir para “Aguardando confirmação”
      </Link>

      <Link href="/" style={{ textDecoration: "none" }}>
        Voltar para a landing
      </Link>
    </main>
  );
}
