"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon);
}

type PassInfo = {
  id: string;
  expires_at: string;
};

function formatTimeLeft(ms: number) {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function formatLocalTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isLogged, setIsLogged] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [activePass, setActivePass] = useState<PassInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // contador regressivo
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  async function checkStatus() {
    setError(null);
    setIsLoading(true);

    try {
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();

      if (sessionErr) {
        setIsLogged(false);
        setUserEmail("");
        setActivePass(null);
        setError("Não consegui verificar seu login.");
        return;
      }

      const session = sessionData?.session;
      const userId = session?.user?.id;

      if (!userId) {
        setIsLogged(false);
        setUserEmail("");
        setActivePass(null);
        return;
      }

      setIsLogged(true);
      setUserEmail(session?.user?.email || "");

      // procura passe ativo e válido
      const nowIso = new Date().toISOString();
      const { data, error: passErr } = await supabase
        .from("passes")
        .select("id, status, expires_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("expires_at", nowIso)
        .order("expires_at", { ascending: false })
        .limit(1);

      if (passErr) {
        setActivePass(null);
        setError("Não consegui consultar seu passe agora.");
        return;
      }

      if (data && data.length > 0 && data[0]?.expires_at) {
        setActivePass({
          id: data[0].id,
          expires_at: data[0].expires_at,
        });
      } else {
        setActivePass(null);
      }
    } catch (e: any) {
      setError("Erro inesperado: " + String(e?.message || e));
      setIsLogged(false);
      setUserEmail("");
      setActivePass(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setIsLogged(false);
    setUserEmail("");
    setActivePass(null);
    router.replace("/");
  }

  useEffect(() => {
    checkStatus();
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expiresMs = activePass?.expires_at
    ? new Date(activePass.expires_at).getTime()
    : null;
  const remainingMs = expiresMs ? expiresMs - nowMs : null;
  const hasActivePass = Boolean(
    activePass && remainingMs !== null && remainingMs > 0
  );

  function scrollToPlans() {
    const el = document.getElementById("passes");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Apresentação */}
      <div style={{ borderRadius: 16, padding: 16, border: "1px solid rgba(0,0,0,0.15)" }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Jornada</h1>
        <p style={{ marginTop: 8 }}>
          Uma experiência por estações: imagens, texto e áudio.
        </p>
      </div>

      {/* STATUS / ACESSO */}
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
        <h2 style={{ fontSize: 16, margin: 0 }}>Seu acesso</h2>

        {isLogged && userEmail && (
          <>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Logado como: <b>{userEmail}</b>
            </div>

            <button
              onClick={logout}
              style={{
                alignSelf: "flex-start",
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Sair / trocar e-mail
            </button>
          </>
        )}

        {isLoading ? (
          <p>Verificando acesso…</p>
        ) : hasActivePass ? (
          <>
            <p>
              ✅ Passe ativo até <b>{formatLocalTime(activePass!.expires_at)}</b>
            </p>
            <p>
              Faltam <b>{formatTimeLeft(remainingMs!)}</b>
            </p>

            <button
              onClick={() => router.push("/journey")}
              style={{
                height: 48,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              Continuar Jornada
            </button>
          </>
        ) : isLogged ? (
          <>
            <p>Você está logado, mas não tem passe ativo.</p>
            <button onClick={scrollToPlans}>Comprar passe</button>
          </>
        ) : (
          <>
            <p>Entre com seu e-mail para recuperar seu acesso.</p>
            <Link href="/login">Entrar</Link>
          </>
        )}

        {error && <div style={{ color: "crimson" }}>{error}</div>}
      </div>

      {/* PASSES */}
      <div id="passes">
        <h2>Escolha seu passe</h2>
        <Link href="/login?plano=1h">1 hora</Link>
        <br />
        <Link href="/login?plano=2h">2 horas</Link>
        <br />
        <Link href="/login?plano=day">Dia todo</Link>
      </div>
    </main>
  );
}
