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

export default function AccessGuard({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [pass, setPass] = useState<PassRow | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const warnedRef = useRef(false);
  const tickRef = useRef<number | null>(null);

  const [showWarning, setShowWarning] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPass() {
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      router.replace("/login");
      return;
    }

    const uid = session.user.id;

    const { data, error: qErr } = await supabase
      .from("passes")
      .select("id,user_id,status,duration_minutes,purchased_at,expires_at")
      .eq("user_id", uid)
      .order("expires_at", { ascending: false })
      .limit(1);

    if (qErr) {
      setError("Erro ao verificar passe: " + qErr.message);
      return;
    }

    const row = data && data[0] ? (data[0] as PassRow) : null;

    if (!row) {
      router.replace("/expired");
      return;
    }

    const expiraMs = new Date(row.expires_at).getTime();
    const agoraMs = Date.now();
    const rest = Math.floor((expiraMs - agoraMs) / 1000);

    if (rest <= 0) {
      router.replace("/expired");
      return;
    }

    setPass(row);
    setRemainingSeconds(rest);
    setLoading(false);
  }

  useEffect(() => {
    loadPass();

    tickRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;

        if (next <= 0) {
          router.replace("/expired");
          return 0;
        }

        // ✅ quando chegar nos 5 minutos, além de abrir o aviso, manda pausar o áudio
        if (!warnedRef.current && next <= 300) {
          warnedRef.current = true;
          setShowWarning(true);

          // pausa o áudio imediatamente (o cronômetro continua)
          pauseAudioNow();
        }

        return next;
      });
    }, 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function renewSamePlanHalf() {
    setError(null);
    if (!pass) return;

    setRenewing(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      setRenewing(false);
      router.replace("/login");
      return;
    }

    const uid = session.user.id;
    const minutos = pass.duration_minutes;

    const baseMs = Math.max(Date.now(), new Date(pass.expires_at).getTime());
    const newExpires = new Date(baseMs + minutos * 60 * 1000);

    const { error: insErr } = await supabase.from("passes").insert([
      {
        user_id: uid,
        status: "active",
        duration_minutes: minutos,
        purchased_at: new Date().toISOString(),
        expires_at: newExpires.toISOString(),
        payment_provider: "manual_renew_50",
        payment_id: null,
      },
    ]);

    setRenewing(false);

    if (insErr) {
      setError("Não foi possível renovar agora: " + insErr.message);
      return;
    }

    setShowWarning(false);
    await loadPass();
  }

  function buyPlan(plano: "1h" | "2h" | "day") {
    router.push("/checkout?plano=" + plano);
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
          }}
        >
          Tempo restante: <b>{formatMMSS(remainingSeconds)}</b>
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
              <div style={{ marginTop: 10, fontSize: 13, color: "crimson" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                onClick={renewSamePlanHalf}
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  fontSize: 16,
                  cursor: "pointer",
                  opacity: renewing ? 0.6 : 1,
                }}
              >
                {renewing ? "Renovando..." : "Renovar este plano — 50% de desconto"}
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