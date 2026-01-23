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

export default function PaymentPendingPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [statusText, setStatusText] = useState("Aguardando confirmação do pagamento…");
  const [lastCheck, setLastCheck] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // ===== Polling progressivo (anti-enxame) =====
  // sequência de intervalos entre checagens automáticas
  const SCHEDULE_MS = [5000, 10000, 20000, 30000]; // depois mantém 30s
  const MAX_TOTAL_MS = 3 * 60 * 1000; // ~3 minutos (ajuste aqui se quiser)

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

    // já passou do tempo máximo -> para polling automático
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
      scheduleIndexRef.current = idx + 1; // vai ficando mais lento
      scheduleNextTick();
    }, waitMs);
  }

  async function checkPassOnce() {
    if (isChecking) return;
    setIsChecking(true);

    try {
      setError(null);
      setStatusText("Verificando seu passe…");

      // 1) Verifica se há usuário logado
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        setError("Não consegui verificar seu login.");
        setStatusText("Tente voltar e fazer login novamente.");
        return;
      }

      const session = sessionData?.session;
      if (!session?.user?.id) {
        setStatusText("Você não está logado. Volte e faça login.");
        return;
      }

      const userId = session.user.id;

      // 2) Procura um passe ativo e ainda válido
      const nowIso = new Date().toISOString();

      const { data, error: passErr } = await supabase
        .from("passes")
        .select("id, status, expires_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .gt("expires_at", nowIso)
        .order("expires_at", { ascending: false })
        .limit(1);

      setLastCheck(new Date().toLocaleTimeString());

      if (passErr) {
        setError("Erro ao consultar seu passe.");
        setStatusText("Aguardando confirmação do pagamento…");
        return;
      }

      if (data && data.length > 0) {
        setStatusText("Pagamento confirmado! Liberando acesso…");
        router.replace("/journey");
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
    // clique manual: checa agora e "reinicia" o backoff
    scheduleIndexRef.current = 0;
    startedAtRef.current = Date.now();
    clearTimer();
    checkPassOnce().finally(() => {
      scheduleNextTick();
    });
  }

  useEffect(() => {
    // inicia contagem e faz a primeira checagem
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
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, maxWidth: 520 }}>
      <h1 style={{ margin: 0 }}>Aguardando confirmação…</h1>

      <p style={{ margin: 0, opacity: 0.9 }}>{statusText}</p>

      <div style={{ fontSize: 13, opacity: 0.65 }}>
        {lastCheck ? `Última checagem: ${lastCheck}` : "Fazendo a primeira checagem…"}
      </div>

      {error && (
        <div style={{ color: "crimson" }}>
          <b>Erro:</b> {error}
        </div>
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
