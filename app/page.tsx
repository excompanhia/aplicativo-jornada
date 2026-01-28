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

function formatLocalDateBR(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

// ✅ fonte única da experiência atual para a landing
function getExpForPurchase(): string {
  try {
    if (typeof window === "undefined") return "audiowalk1";
    return localStorage.getItem("jornada:last_exp") || "audiowalk1";
  } catch {
    return "audiowalk1";
  }
}

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isLogged, setIsLogged] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [activePass, setActivePass] = useState<PassInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    try {
      await supabase.auth.signOut();
    } finally {
      setIsLogged(false);
      setUserEmail("");
      setActivePass(null);
      router.replace("/");
    }
  }

  useEffect(() => {
    checkStatus();
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const expiresMs = activePass?.expires_at
    ? new Date(activePass.expires_at).getTime()
    : null;

  const remainingMs = expiresMs ? expiresMs - nowMs : null;
  const hasActivePass =
    Boolean(activePass && remainingMs !== null && remainingMs > 0);

  function StatusPill({
    color,
    label,
  }: {
    color: "red" | "yellow" | "green";
    label: string;
  }) {
    const dotColor =
      color === "red"
        ? "#D11A2A"
        : color === "yellow"
        ? "#F4B400"
        : "#18A957";

    const textColor =
      color === "red"
        ? "#B31222"
        : color === "yellow"
        ? "#9A6B00"
        : "#118043";

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: dotColor,
            boxShadow: "0 0 0 3px rgba(0,0,0,0.04)",
          }}
        />
        <span
          style={{ fontSize: 13, fontWeight: 700, color: textColor }}
        >
          {label}
        </span>
      </div>
    );
  }

  return (
    <main
      style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div
        style={{
          borderRadius: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.15)",
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0 }}>Jornada</h1>
        <p style={{ marginTop: 10, lineHeight: 1.4 }}>
          Uma experiência por estações: imagens em movimento, texto e áudio.
        </p>
      </div>

      <div
        style={{
          borderRadius: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.15)",
          background: "white",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontSize: 16, margin: 0 }}>Seu acesso</h2>
          <button
            onClick={checkStatus}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
            }}
          >
            Atualizar
          </button>
        </div>

        {isLoading ? (
          <p>Verificando…</p>
        ) : hasActivePass ? (
          <>
            <StatusPill color="green" label="Você está ONLINE" />

            <p style={{ margin: 0 }}>
              Passe válido até{" "}
              <b>
                {formatLocalTime(activePass!.expires_at)} –{" "}
                {formatLocalDateBR(activePass!.expires_at)}
              </b>
            </p>

            <p style={{ margin: 0 }}>
              Faltam <b>{formatTimeLeft(remainingMs!)}</b>
            </p>

            {/* ✅ ENTRAR AGORA VAI PARA /journey/[slug] */}
            <button
              onClick={() => {
                const exp = getExpForPurchase();
                router.push(`/journey/${encodeURIComponent(exp)}`);
              }}
              style={{
                height: 48,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontSize: 16,
                cursor: "pointer",
                marginTop: 6,
              }}
            >
              ENTRAR
            </button>
          </>
        ) : isLogged ? (
          <>
            <StatusPill
              color="yellow"
              label="Logado, mas sem passe ativo"
            />

            <button
              onClick={() => {
                const exp = getExpForPurchase();
                router.push(`/expired?exp=${encodeURIComponent(exp)}`);
              }}
              style={{
                height: 48,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontSize: 16,
              }}
            >
              COMPRAR PASSE
            </button>
          </>
        ) : (
          <>
            <StatusPill color="red" label="Você está OFFLINE" />
            <button
              onClick={() => router.push("/login")}
              style={{
                height: 48,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontSize: 16,
              }}
            >
              COMEÇAR
            </button>
          </>
        )}

        {error && (
          <div style={{ color: "crimson", fontSize: 13 }}>
            <b>Erro:</b> {error}
          </div>
        )}
      </div>
    </main>
  );
}
