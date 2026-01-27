"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const ADMIN_EMAIL = "contato@excompanhia.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminLoginPage() {
  const router = useRouter();

  // email travado
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function sendOtp() {
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email: ADMIN_EMAIL,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
      },
    });

    if (error) setError(error.message);
    else setSent(true);
  }

  async function verifyOtp() {
    setError(null);

    const { error } = await supabase.auth.verifyOtp({
      email: ADMIN_EMAIL,
      token: code,
      type: "email",
    });

    if (error) {
      setError(error.message);
      return;
    }

    // extra: garante que quem logou é o admin
    const { data } = await supabase.auth.getUser();
    const authedEmail = data?.user?.email || "";
    if (authedEmail !== ADMIN_EMAIL) {
      await supabase.auth.signOut();
      setError("Este e-mail não tem permissão para acessar o Admin.");
      return;
    }

    router.replace("/admin");
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 420 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Login do Admin</h1>

      {!sent ? (
        <>
          <p style={{ marginBottom: 12 }}>
            Login separado do Journey. Apenas o e-mail do administrador tem permissão.
          </p>

          <input
            type="email"
            value={ADMIN_EMAIL}
            disabled
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 12,
              opacity: 0.8,
              cursor: "not-allowed",
            }}
          />

          <button onClick={sendOtp} style={{ width: "100%", padding: 12 }}>
            Enviar código
          </button>
        </>
      ) : (
        <>
          <p style={{ marginBottom: 12 }}>
            Digite o código enviado para <strong>{ADMIN_EMAIL}</strong>
          </p>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 12 }}
          />

          <button onClick={verifyOtp} style={{ width: "100%", padding: 12 }}>
            Entrar no Admin
          </button>
        </>
      )}

      {error && <p style={{ marginTop: 12, color: "red" }}>{error}</p>}
    </main>
  );
}
