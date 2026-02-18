"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon);
}

function readExpFromUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);

    // aceitamos vários nomes (pra facilitar QR depois)
    const exp =
      (params.get("exp") ||
        params.get("experience_id") ||
        params.get("experience") ||
        "").trim();

    return exp;
  } catch {
    return "";
  }
}

function getLastExpFallback(): string {
  try {
    return localStorage.getItem("jornada:last_exp") || "";
  } catch {
    return "";
  }
}

function persistLastExp(slug: string) {
  try {
    if (!slug) return;
    localStorage.setItem("jornada:last_exp", slug);
  } catch {}
}

export default function PaymentPendingPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [statusText, setStatusText] = useState("Aguardando confirmação do pagamento…");
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // ✅ contexto da experiência (slug)
  const [exp, setExp] = useState<string>("");

  // ✅ quando não está logado, mostramos botão para login
  const [needsLogin, setNeedsLogin] = useState(false);

  // ===== Polling progressivo (anti-enxame) =====
  const SCHEDULE_MS = [5000, 10000, 20000, 30000]; // depois mantém 30s
  const MAX_TOTAL_MS = 3 * 60 * 1000; // ~3 minutos

  const scheduleIndexRef = useRef(0);
  const startedAtRef = useRef<number>(0);
  const timeoutRef = useRef<number | null>(null);

  function clearTimer() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  function scheduleNextTick() {
    clearTimer();

    const startedAt = startedAtRef.current || Date.now();
    const elapsed = Date.now() - startedAt;

    if (elapsed >= MAX_TOTAL_MS) {
      setStatusText(
        "Ainda aguardando confirmação… Se você já pagou, toque em “verificar agora”."
      );
      return;
    }

    const idx = scheduleIndexRef.current;
    const waitMs =
      idx < SCHEDULE_MS.length ? SCHEDULE_MS[idx] : SCHEDULE_MS[SCHEDULE_MS.length - 1];

    timeoutRef.current = window.setTimeout(async () => {
      await checkPassOnce();
      scheduleIndexRef.current = idx + 1;
      scheduleNextTick();
    }, waitMs);
  }

  function goLogin() {
    const finalExp = exp || "audiowalk1";

    // volta para o pending mantendo exp
    const next = `/payment/pending?exp=${encodeURIComponent(finalExp)}`;

    const qs = new URLSearchParams();
    qs.set("exp", finalExp);
    qs.set("next", next);

    router.replace(`/login?${qs.toString()}`);
  }

  async function checkPassOnce() {
    if (isChecking) return;
    setIsChecking(true);

    try {
      setError(null);
      setNeedsLogin(false);
      setStatusText("Verificando seu passe…");

      // 1) Verifica se há usuário logado
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();

      if (sessionErr) {
        setError("Não consegui verificar seu login.");
        setStatusText("Tente fazer login novamente.");
        setNeedsLogin(true);
        return;
      }

      const session = sessionData?.session;

      if (!session?.user?.id) {
        setStatusText("Para liberar seu acesso, você precisa entrar com seu e-mail.");
        setNeedsLogin(true);
        return;
      }

      const userId = session.user.id;

      // 2) Procura passe desta experiência:
      //    - journey_active (válido) => pode entrar direto
      //    - purchased_not_started => pagamento confirmado, mas ainda não iniciou
      const finalExp = exp || "audiowalk1";

      const { data, error: passErr } = await supabase
        .from("passes")
        .select("id, status, expires_at, experience_id, purchased_at")
        .eq("user_id", userId)
        .eq("experience_id", finalExp)
        .in("status", ["journey_active", "purchased_not_started"])
        .order("purchased_at", { ascending: false })
        .limit(1);

      setLastCheck(new Date().toLocaleTimeString());

      if (passErr) {
        setError("Erro ao consultar seu passe.");
        setStatusText("Aguardando confirmação do pagamento…");
        return;
      }

      const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

      if (row?.status === "journey_active") {
        // se tiver expires_at e estiver válido, libera
        if (row.expires_at) {
          const expMs = new Date(row.expires_at).getTime();
          if (Number.isFinite(expMs) && expMs > Date.now()) {
            setStatusText("Pagamento confirmado! Liberando acesso…");
            router.replace(`/journey/${encodeURIComponent(finalExp)}?play=1`);
            return;
          }
        }
      }

      if (row?.status === "purchased_not_started") {
        // ✅ pagamento confirmado no modo "new": manda para a tela pré-início (dentro da Journey)
        setStatusText("Pagamento confirmado! Preparando o início…");
        router.replace(`/journey/${encodeURIComponent(finalExp)}?play=1`);
        return;
      }

      setStatusText("Aguardando confirmação do pagamento…");
    } catch (e: any) {
      setError("Erro inesperado: " + String(e?.message || e));
      setStatusText("Aguardando confirmação do pagamento…");
    } finally {
      setIsChecking(false);
    }
  }

  function forceCheckNow() {
    scheduleIndexRef.current = 0;
    startedAtRef.current = Date.now();
    clearTimer();
    checkPassOnce().finally(() => {
      scheduleNextTick();
    });
  }

  useEffect(() => {
    // ✅ ler exp e persistir como fallback do app inteiro
    const expFromUrl = readExpFromUrl();
    const finalExp = expFromUrl || getLastExpFallback() || "audiowalk1";

    setExp(finalExp);
    persistLastExp(finalExp);

    startedAtRef.current = Date.now();
    scheduleIndexRef.current = 0;

    checkPassOnce().finally(() => {
      scheduleNextTick();
    });

    return () => {
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 520,
      }}
    >
      <h1 style={{ margin: 0 }}>Aguardando confirmação…</h1>

      <p style={{ margin: 0, opacity: 0.9 }}>{statusText}</p>

      <div style={{ fontSize: 13, opacity: 0.65 }}>
        {lastCheck ? `Última checagem: ${lastCheck}` : "Fazendo a primeira checagem…"}
      </div>

      {/* contexto da experiência */}
      <div
        style={{
          fontSize: 13,
          opacity: 0.75,
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.12)",
          background: "rgba(0,0,0,0.03)",
          padding: 10,
        }}
      >
        Experiência: <b>{exp || "carregando…"}</b>
      </div>

      {error && (
        <div style={{ color: "crimson" }}>
          <b>Erro:</b> {error}
        </div>
      )}

      {/* botão de login quando não há sessão */}
      {needsLogin && (
        <button
          onClick={goLogin}
          style={{
            height: 48,
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Fazer login para liberar acesso
        </button>
      )}

      <button
        onClick={forceCheckNow}
        style={{
          height: 48,
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.15)",
          background: "white",
          fontSize: 16,
          cursor: "pointer",
          marginTop: 8,
        }}
      >
        Já paguei — verificar agora
      </button>

      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Dica: o pagamento abre em outra aba. Se ele não voltar automaticamente, volte para esta aba.
        </div>

        <Link href="/" style={{ textDecoration: "none" }}>
          Voltar para a landing
        </Link>
      </div>
    </main>
  );
}
