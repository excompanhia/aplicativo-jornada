"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon);
}

function CheckoutInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plano = searchParams.get("plano"); // "1h" | "2h" | "day"

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planoTexto = useMemo(() => {
    if (plano === "1h") return "1 hora — R$ 14,90";
    if (plano === "2h") return "2 horas — R$ 19,90";
    if (plano === "day") return "24 horas — R$ 29,90";
    return "(nenhum plano selecionado)";
  }, [plano]);

  function getDurationMinutes() {
    if (plano === "1h") return 60;
    if (plano === "2h") return 120;
    if (plano === "day") return 24 * 60;
    return 0;
  }

  async function handleSimulatedContinue() {
    setError(null);

    const minutes = getDurationMinutes();
    if (!minutes) {
      setError("Selecione um plano primeiro.");
      return;
    }

    try {
      setIsCreating(true);

      const supabase = getSupabaseClient();

      // 1) Descobre o usuário logado
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        setError("Erro ao identificar usuário. Tente fazer login novamente.");
        return;
      }

      const user = userData?.user;
      if (!user?.id) {
        setError("Você não está logado. Volte e faça login novamente.");
        return;
      }

      // 2) expires_at no futuro (agora + duração)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + minutes * 60 * 1000);

      // 3) Insere na tabela passes (somente colunas que sabemos que existem)
      const { error: insertErr } = await supabase.from("passes").insert({
        user_id: user.id,
        expires_at: expiresAt.toISOString(),
      });

      if (insertErr) {
        setError(
          "Não consegui criar o passe no Supabase. " +
            "Isso geralmente acontece por regra de segurança (RLS) ou nomes de coluna diferentes. " +
            "Erro: " +
            insertErr.message
        );
        return;
      }

      // 4) Entra no Journey
      router.push("/journey");
    } catch (e: any) {
      setError("Erro inesperado ao simular: " + String(e?.message || e));
    } finally {
      setIsCreating(false);
    }
  }

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
          Agora o botão abaixo cria um passe de teste no Supabase e libera o Journey.
          <br />
          Próximo passo: Mercado Pago (Pix + cartão) em checkout único.
        </div>
      </div>

      <button
        onClick={handleSimulatedContinue}
        disabled={isCreating}
        style={{
          height: 52,
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.15)",
          fontSize: 16,
          background: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "black",
          cursor: isCreating ? "not-allowed" : "pointer",
        }}
      >
        {isCreating ? "Criando passe…" : "Continuar (simulado)"}
      </button>

      {error && (
        <div style={{ color: "crimson", lineHeight: 1.35 }}>
          <b>Erro:</b> {error}
        </div>
      )}

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
    <Suspense fallback={<main style={{ padding: 16 }}>Carregando checkout…</main>}>
      <CheckoutInner />
    </Suspense>
  );
}
