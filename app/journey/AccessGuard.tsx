"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { pauseAudioNow } from "../lib/appEvents";

type PassRow = {
  id: string;
  user_id: string;
  status: string;
  duration_minutes: number;
  purchased_at: string;
  expires_at: string;
};

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function brl(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function fullPriceFromMinutes(mins: number) {
  if (mins === 60) return 14.9;
  if (mins === 120) return 19.9;
  if (mins === 1440) return 29.9;
  return 0;
}

function getJourneySlugFromPathname(): string {
  if (typeof window === "undefined") return "";
  const path = window.location.pathname || "";
  const m = path.match(/^\/journey\/([^\/?#]+)/);
  if (!m) return "";
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function persistLastExp(slug: string) {
  try {
    if (!slug) return;
    localStorage.setItem("jornada:last_exp", slug);
  } catch {}
}

function getLastExpFallback(): string {
  try {
    return localStorage.getItem("jornada:last_exp") || "";
  } catch {
    return "";
  }
}

export default function AccessGuard({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [pass, setPass] = useState<PassRow | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // ✅ NOVO: mostrar "logado como: ..."
  const [userEmail, setUserEmail] = useState<string>("");

  const warnedRef = useRef(false);
  const tickRef = useRef<number | null>(null);

  // ✅ Depois que entrou com passe válido, NÃO reavalia durante a sessão
  const accessGrantedRef = useRef(false);

  // ✅ Fonte da verdade do tempo (vem do Supabase)
  const expiresAtMsRef = useRef<number | null>(null);

  // ✅ Evita falso negativo: só consideramos expiração depois que o expires_at foi carregado
  const hasExpiryRef = useRef(false);

  const [showWarning, setShowWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ exp atual (slug da rota) para manter o checkout amarrado
  const expRef = useRef<string>("");

  function computeRemainingFromExpiry(): number | null {
    const expMs = expiresAtMsRef.current;
    if (!expMs) return null; // ainda não carregou a fonte da verdade
    return Math.floor((expMs - Date.now()) / 1000);
  }

  function goExpired() {
    // ✅ Só pode expirar se já carregamos o expires_at (senão é falso negativo)
    if (!hasExpiryRef.current) return;

    const exp = expRef.current || getLastExpFallback();
    const url = exp ? `/expired?exp=${encodeURIComponent(exp)}` : "/expired";
    router.replace(url);
  }

  async function loadPassOnce() {
    setError(null);

    // ✅ Se já foi liberado uma vez nesta sessão, não revalida
    if (accessGrantedRef.current) return;

    // 1) pega sessão/token
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      router.replace("/login");
      return;
    }

    // ✅ NOVO: guarda email para mostrar no app
    setUserEmail(session.user?.email || "");

    const token = session.access_token;

    // 2) consulta passe no servidor (não depende de RLS do client)
    const res = await fetch("/api/auth/active-pass", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      setError(json?.error || "Erro ao verificar passe.");
      // mantém loading aqui porque não temos estado seguro ainda
      return;
    }

    const row = json?.pass ? (json.pass as PassRow) : null;

    if (!row) {
      // aqui é seguro expirar porque a resposta veio do servidor
      hasExpiryRef.current = true;
      goExpired();
      return;
    }

    // ✅ A verdade do tempo é o expires_at do Supabase
    const expiraMs = new Date(row.expires_at).getTime();
    expiresAtMsRef.current = expiraMs;
    hasExpiryRef.current = true;

    const rest = computeRemainingFromExpiry();

    // se por algum motivo ficou inválido no exato momento
    if (rest !== null && rest <= 0) {
      goExpired();
      return;
    }

    // ✅ Agora a sessão está liberada. Não revalidamos novamente até sair da Journey.
    accessGrantedRef.current = true;

    setPass(row);
    setRemainingSeconds(rest ?? 0);
    setLoading(false);
  }

  // ✅ timer começa SOMENTE quando já temos expires_at
  function startTimerIfNeeded() {
    if (tickRef.current) return;
    if (!hasExpiryRef.current) return;

    tickRef.current = window.setInterval(() => {
      const next = computeRemainingFromExpiry();

      // ainda não carregou a fonte da verdade -> não faz nada
      if (next === null) return;

      if (next <= 0) {
        setRemainingSeconds(0);
        goExpired();
        return;
      }

      setRemainingSeconds(next);

      if (!warnedRef.current && next <= 300) {
        warnedRef.current = true;
        setShowWarning(true);

        // pausa o áudio imediatamente (o cronômetro continua)
        pauseAudioNow();
      }
    }, 1000);
  }

  useEffect(() => {
    // ✅ captura exp da rota e persiste como fallback
    const slug = getJourneySlugFromPathname();
    expRef.current = slug;
    persistLastExp(slug);

    // roda a validação e só depois liga o timer
    (async () => {
      await loadPassOnce();
      startTimerIfNeeded();
    })();

    // ✅ Se o usuário saiu do app e voltou, recalcula imediatamente (sem “congelar” tempo)
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        const next = computeRemainingFromExpiry();

        // ainda não carregou -> não expira
        if (next === null) return;

        if (next <= 0) {
          setRemainingSeconds(0);
          goExpired();
        } else {
          setRemainingSeconds(next);
        }
      }
    }

    // ✅ Se voltou online, recalcula, mas NÃO mexe na UX (zero redirect / zero reset)
    function onOnline() {
      const next = computeRemainingFromExpiry();
      if (next === null) return;
      if (next > 0) setRemainingSeconds(next);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buyPlan(plano: "1h" | "2h" | "day") {
    const exp = expRef.current || getLastExpFallback();
    const url = exp
      ? `/checkout?plano=${plano}&exp=${encodeURIComponent(exp)}`
      : `/checkout?plano=${plano}`;
    router.push(url);
  }

  // ✅ Renovação: aqui a UX manda para o checkout (o webhook é quem soma tempo)
  function renewSamePlanHalfCheckout() {
    if (!pass) return;

    // mapeia duration_minutes -> plano
    const mins = pass.duration_minutes;
    const plano: "1h" | "2h" | "day" =
      mins === 60 ? "1h" : mins === 120 ? "2h" : "day";

    const exp = expRef.current || getLastExpFallback();
    const url = exp
      ? `/checkout?plano=${plano}&renew=1&exp=${encodeURIComponent(exp)}`
      : `/checkout?plano=${plano}&renew=1`;

    router.push(url);
  }

  if (loading) {
    return (
      <main style={{ padding: 16 }}>
        Carregando acesso…
        {error && <div style={{ marginTop: 10, color: "crimson" }}>{error}</div>}
      </main>
    );
  }

  const planFull = pass ? fullPriceFromMinutes(pass.duration_minutes) : 0;
  const renewPrice = planFull > 0 ? planFull * 0.5 : 0;

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: 10,
          left: 10,
          right: 10,
          zIndex: 999,
          pointerEvents: "none",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            pointerEvents: "none",
            background: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 999,
            padding: "8px 12px",
            fontSize: 13,
            textAlign: "center",
            lineHeight: 1.25,
          }}
        >
          {userEmail ? (
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Logado como: <b>{userEmail}</b>
            </div>
          ) : null}
          <div>
            Tempo restante: <b>{formatMMSS(remainingSeconds)}</b>
          </div>
        </div>
      </div>

      {children}

      {showWarning && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "white",
              borderRadius: 18,
              border: "1px solid rgba(0,0,0,0.15)",
              padding: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              Renovar seu plano com 50% de desconto!
            </div>

            <div style={{ marginTop: 8, fontSize: 14, opacity: 0.85, lineHeight: 1.35 }}>
              Faltam 5 minutos para terminar seu acesso.
            </div>

            {planFull > 0 && (
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                Renovação deste plano (50%): <b>R$ {brl(renewPrice)}</b>
              </div>
            )}

            {error && (
              <div style={{ marginTop: 10, fontSize: 13, color: "crimson" }}>{error}</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={renewSamePlanHalfCheckout}
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Renovar este plano — 50% de desconto
              </button>

              <button
                type="button"
                onClick={() => buyPlan("1h")}
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Comprar 1 hora — R$ 14,90
              </button>

              <button
                type="button"
                onClick={() => buyPlan("2h")}
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Comprar 2 horas — R$ 19,90
              </button>

              <button
                type="button"
                onClick={() => buyPlan("day")}
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                Comprar 24 horas — R$ 29,90
              </button>

              <button
                type="button"
                onClick={() => setShowWarning(false)}
                style={{
                  width: "100%",
                  height: 48,
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "rgba(0,0,0,0.04)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Continuar sem renovar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
