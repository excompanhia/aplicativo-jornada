"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("contato@excompanhia.com");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function sendOtp() {
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
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
      email,
      token: code,
      type: "email",
    });
    if (error) setError(error.message);
    else router.replace("/admin");
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 420 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Login do Admin</h1>

      {!sent ? (
        <>
          <p style={{ marginBottom: 12 }}>
            Login separado do Journey. Use o e-mail do administrador.
          </p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 12 }}
          />

          <button onClick={sendOtp} style={{ width: "100%", padding: 12 }}>
            Enviar código
          </button>
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
            Entrar no Admin
          </button>
        </>
      )}

      {error && (
        <p style={{ marginTop: 12, color: "red" }}>
          {error}
        </p>
      )}
    </main>
  );
}
