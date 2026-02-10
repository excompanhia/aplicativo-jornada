"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function readTrackingFromUrl() {
  const params = new URLSearchParams(window.location.search);

  // ✅ IMPORTANTE: sem QR por enquanto, o padrão deve ser o slug real
  const experience_id = (
    params.get("exp") ||
    params.get("experience_id") ||
    params.get("experience") ||
    "audiowalk1"
  ).trim();

  const qr_point_id = (
    params.get("qr") ||
    params.get("qr_point_id") ||
    params.get("point") ||
    ""
  ).trim();

  // ✅ NOVO: next (para retorno pós-login)
  const next = (params.get("next") || "").trim();

  return { experience_id, qr_point_id, next };
}

export default function LoginPage() {
  const router = useRouter();

  const tracking = useMemo(() => {
    if (typeof window === "undefined") {
      return { experience_id: "audiowalk1", qr_point_id: "", next: "" };
    }
    return readTrackingFromUrl();
  }, []);

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function goAfterLogin() {
    // ✅ PRIORIDADE: se existir `next`, volta exatamente para ele
    if (tracking.next) {
      router.replace(tracking.next);
      return;
    }

    // ✅ fallback atual (comportamento preservado)
    const slug = tracking.experience_id || "audiowalk1";
    router.replace(`/journey/${encodeURIComponent(slug)}`);
  }

  // Se já estiver logado, respeita `next` (se existir)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        goAfterLogin();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendOtp() {
    setError(null);

    const e = email.trim();
    if (!e) {
      setError("Digite seu e-mail.");
      return;
    }

    const slug = tracking.experience_id || "audiowalk1";

    // ✅ emailRedirectTo respeita `next` quando existir
    const redirectTo = tracking.next
      ? `${window.location.origin}${tracking.next}`
      : `${window.location.origin}/journey/${encodeURIComponent(slug)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) setError(error.message);
    else setSent(true);
  }

  async function verifyOtp() {
    setError(null);

    const e = email.trim();
    const t = code.trim();

    if (!e) return setError("Digite seu e-mail.");
    if (!t) return setError("Digite o código.");

    const { data, error } = await supabase.auth.verifyOtp({
      email: e,
      token: t,
      type: "email",
    });

    if (error) {
      setError(error.message);
      return;
    }

    // ✅ Analytics: OTP_LOGIN (login efetivo do usuário)
    try {
      const user_id = data?.user?.id;
      if (user_id) {
        await fetch("/api/analytics/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            experience_id: tracking.experience_id || "audiowalk1",
            event_type: "otp_login",
            user_id,
            qr_point_id: tracking.qr_point_id || null,
          }),
          cache: "no-store",
        });
      }
    } catch {
      // não quebra o login
    }

    goAfterLogin();
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 420 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Entrar</h1>

      {!sent ? (
        <>
          <p style={{ marginBottom: 12 }}>
            Digite seu e-mail para receber um código de acesso.
          </p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            style={{ width: "100%", padding: 10, marginBottom: 12 }}
          />

          <button onClick={sendOtp} style={{ width: "100%", padding: 12 }}>
            Enviar código
          </button>

          <p style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
            Experiência: <strong>{tracking.experience_id || "audiowalk1"}</strong>
            {tracking.qr_point_id ? (
              <>
                {" "}
                · Ponto: <strong>{tracking.qr_point_id}</strong>
              </>
            ) : null}
          </p>
        </>
      ) : (
        <>
          <p style={{ marginBottom: 12 }}>
            Digite o código enviado para <strong>{email}</strong>
          </p>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 12 }}
          />

          <button onClick={verifyOtp} style={{ width: "100%", padding: 12 }}>
            Entrar
          </button>
        </>
      )}

      {error && <p style={{ marginTop: 12, color: "red" }}>Erro: {error}</p>}
    </main>
  );
}
