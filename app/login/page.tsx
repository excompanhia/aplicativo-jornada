"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

function LoginInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const plano = searchParams.get("plano");

  const planoTexto = useMemo(() => {
    if (plano === "1h") return "1 hora — R$ 14,90";
    if (plano === "2h") return "2 horas — R$ 19,90";
    if (plano === "day") return "Dia todo (24h) — R$ 29,90";
    return null;
  }, [plano]);

  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [aguarde, setAguarde] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  async function enviarLinkOuCodigo() {
    setErro(null);

    if (!email.includes("@")) {
      alert("Digite um e-mail válido (exemplo: nome@site.com).");
      return;
    }

    if (aguarde > 0) return;

    const { error } = await supabase.auth.signInWithOtp({
      email,
    });

    if (error) {
      setErro(`Erro ao enviar: ${error.message}`);
      return;
    }

    setEnviado(true);

    setAguarde(60);
    const timer = window.setInterval(() => {
      setAguarde((s) => {
        if (s <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function confirmarCodigo() {
    setErro(null);

    if (codigo.trim().length < 6) {
      alert("Digite o código que chegou no seu e-mail.");
      return;
    }

    setConfirmando(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: codigo.trim(),
      type: "email",
    });

    setConfirmando(false);

    if (error) {
      setErro("Código inválido ou expirado: " + error.message);
      return;
    }

    // ✅ NOVO: registrar esse login no mailing (server-side)
    // Observação: não bloqueia a navegação se falhar.
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (token) {
        fetch("/api/mailing/login", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      }
    } catch (_) {}

    const destino = plano ? "/checkout?plano=" + plano : "/checkout";
    router.push(destino);
  }

  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <h1 style={{ margin: 0 }}>Entrar</h1>

      {planoTexto ? (
        <div style={{ borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.15)" }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Plano escolhido</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{planoTexto}</div>
        </div>
      ) : (
        <div style={{ fontSize: 13, opacity: 0.75 }}>(Você ainda não escolheu um plano.)</div>
      )}

      <div style={{ borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.15)" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
          Receber código por e-mail
        </div>

        <label style={{ display: "block", fontSize: 13, opacity: 0.75 }}>Seu e-mail</label>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@site.com"
          inputMode="email"
          style={{
            marginTop: 6,
            width: "100%",
            height: 48,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.2)",
            padding: "0 12px",
            fontSize: 16,
          }}
        />

        <button
          type="button"
          onClick={enviarLinkOuCodigo}
          style={{
            marginTop: 12,
            width: "100%",
            height: 52,
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.15)",
            fontSize: 16,
            background: "white",
            cursor: "pointer",
          }}
        >
          {aguarde > 0 ? `Aguarde ${aguarde}s para reenviar` : "Enviar código por e-mail"}
        </button>

        {erro && (
          <div style={{ marginTop: 10, fontSize: 13, color: "crimson" }}>
            {erro}
          </div>
        )}

        {enviado && (
          <div
            style={{
              marginTop: 12,
              borderRadius: 12,
              padding: 12,
              background: "rgba(0,0,0,0.05)",
              lineHeight: 1.35,
            }}
          >
            <div style={{ fontWeight: 700 }}>Pronto.</div>

            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
              Enviamos um código para <b>{email}</b>.
              <br />
              Se não chegar em 1–2 minutos, confira o Spam/Lixo eletrônico.
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ display: "block", fontSize: 13, opacity: 0.75 }}>
                Digite o código (normalmente 8 dígitos)
              </label>

              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="12345678"
                inputMode="numeric"
                style={{
                  marginTop: 6,
                  width: "100%",
                  height: 48,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.2)",
                  padding: "0 12px",
                  fontSize: 16,
                  letterSpacing: 3,
                  textAlign: "center",
                }}
              />

              <button
                type="button"
                onClick={confirmarCodigo}
                style={{
                  marginTop: 10,
                  width: "100%",
                  height: 48,
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.15)",
                  fontSize: 15,
                  background: "white",
                  cursor: "pointer",
                  opacity: confirmando ? 0.6 : 1,
                }}
              >
                {confirmando ? "Confirmando..." : "Confirmar código e entrar"}
              </button>
            </div>
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

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ padding: 16 }}>Carregando login…</main>}>
      <LoginInner />
    </Suspense>
  );
}
