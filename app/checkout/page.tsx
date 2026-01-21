"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon);
}

function CheckoutInner() {
  const searchParams = useSearchParams();
  const plano = searchParams.get("plano"); // "1h" | "2h" | "day"

  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planoTexto = useMemo(() => {
    if (plano === "1h") return "1 hora — R$ 14,90";
    if (plano === "2h") return "2 horas — R$ 19,90";
    if (plano === "day") return "24 horas — R$ 29,90";
    return "(nenhum plano selecionado)";
  }, [plano]);

  async function handlePay() {
    setError(null);

    if (!plano || !["1h", "2h", "day"].includes(plano)) {
      setError("Selecione um plano primeiro.");
      return;
    }

    try {
      setIsPaying(true);

      const supabase = getSupabaseClient();

      // 1) Pega a sessão atual (login invisível do usuário)
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();

      if (sessionErr) {
        setError("Erro ao identificar seu login. Tente novamente.");
        return;
      }

      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setError("Você não está logado. Volte e faça login novamente.");
        return;
      }

      // 2) Chama o servidor para criar o checkout do Mercado Pago
      const res = await fetch("/api/mercadopago/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ plan: plano }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
      const msg =
    (json?.error ? String(json.error) : "Erro ao criar checkout.") +
    (json?.details ? "\n\nDETAILS:\n" + JSON.stringify(json.details, null, 2) : "");
  setError(msg);
        return;
      }

      if (!json?.checkoutUrl) {
        setError("Não recebi a URL do Mercado Pago.");
        return;
      }

      // 3) Abre o Mercado Pago
      window.open(json.checkoutUrl, "_blank", "noopener,noreferrer");
window.location.href = "/payment/pending";
    } catch (e: any) {
      setError("Erro inesperado: " + String(e?.message || e));
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <h1>Checkout</h1>

      <div style={{ border: "1px solid rgba(0,0,0,0.15)", borderRadius: 16, padding: 16 }}>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Plano selecionado</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{planoTexto}</div>
      </div>

      <button
        onClick={handlePay}
        disabled={isPaying}
        style={{
          height: 52,
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.15)",
          background: "white",
          fontSize: 16,
          cursor: isPaying ? "not-allowed" : "pointer",
        }}
      >
        {isPaying ? "Abrindo Mercado Pago…" : "Pagar (Pix ou Cartão)"}
      </button>

      {error && (
        <div style={{ color: "crimson" }}>
          <b>Erro:</b> {error}
        </div>
      )}

      <Link href="/" style={{ textDecoration: "none", textAlign: "center" }}>
        Voltar para a landing
      </Link>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<main style={{ padding: 16 }}>Carregando checkout…</main>}>
      <CheckoutInner />
    </Suspense>
  );
}
