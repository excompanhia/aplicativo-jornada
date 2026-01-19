"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

function minutesFromPlano(plano: string | null) {
  if (plano === "1h") return 60;
  if (plano === "2h") return 120;
  if (plano === "3h") return 180;
  if (plano === "6h") return 360;
  if (plano === "24h" || plano === "day") return 1440;
  return 60; // padrão seguro
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plano = searchParams.get("plano");

  const planoTexto = useMemo(() => {
    if (plano === "1h") return "Passe 1 hora";
    if (plano === "2h") return "Passe 2 horas";
    if (plano === "3h") return "Passe 3 horas";
    if (plano === "6h") return "Passe 6 horas";
    if (plano === "24h" || plano === "day") return "Passe 24 horas";
    return "Passe (não definido)";
  }, [plano]);

  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function checarLogin() {
      const { data } = await supabase.auth.getSession();
      const sessao = data.session;

      if (!ativo) return;

      if (!sessao) {
        const destino = plano ? "/login?plano=" + plano : "/login";
        router.replace(destino);
        return;
      }

      setEmail(sessao.user.email ?? null);
      setUserId(sessao.user.id);
      setCarregando(false);
    }

    checarLogin();

    return () => {
      ativo = false;
    };
  }, [router, plano]);

  async function sair() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  async function ativarPasseTeste() {
    setErro(null);

    if (!userId) {
      setErro("Você precisa estar logado.");
      return;
    }

    const minutos = minutesFromPlano(plano);

    // “Agora” em formato de data/hora
    const agora = new Date();
    const expira = new Date(agora.getTime() + minutos * 60 * 1000);

    setCriando(true);

    const { error } = await supabase.from("passes").insert([
      {
        user_id: userId,
        status: "active",
        duration_minutes: minutos,
        purchased_at: agora.toISOString(),
        expires_at: expira.toISOString(),
        payment_provider: "manual",
        payment_id: null,
      },
    ]);

    setCriando(false);

    if (error) {
      setErro("Erro ao criar passe: " + error.message);
      return;
    }

    router.push("/journey");
  }

  if (carregando) {
    return <main style={{ padding: 16 }}>Carregando…</main>;
  }

  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Checkout</h1>
        <button
          type="button"
          onClick={sair}
          style={{
            height: 40,
            padding: "0 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            cursor: "pointer",
          }}
        >
          Sair
        </button>
      </div>

      <div style={{ fontSize: 13, opacity: 0.75 }}>
        Logado como: <b>{email ?? "(sem e-mail)"}</b>
      </div>

      <div style={{ borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 13, opacity: 0.75 }}>Plano selecionado</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{planoTexto}</div>

        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 10, lineHeight: 1.35 }}>
          Nesta etapa, este botão cria um passe real no Supabase (teste), para a gente validar
          expiração e bloqueio. No próximo bloco, isso vira pagamento real (Pix + cartão).
        </div>

        <button
          type="button"
          onClick={ativarPasseTeste}
          style={{
            marginTop: 12,
            width: "100%",
            height: 52,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.15)",
            fontSize: 16,
            background: "white",
            cursor: "pointer",
            opacity: criando ? 0.6 : 1,
          }}
        >
          {criando ? "Ativando..." : "Ativar passe (teste) e entrar"}
        </button>

        {erro && (
          <div style={{ marginTop: 10, fontSize: 13, color: "crimson" }}>
            {erro}
          </div>
        )}
      </div>

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