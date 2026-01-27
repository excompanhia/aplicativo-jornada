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
  const [userEmail, setUserEmail] = useState<string>(""); // ✅ NOVO
  const [activePass, setActivePass] = useState<PassInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // contador regressivo
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  async function checkStatus() {
    setError(null);
    setIsLoading(true);

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();

      if (sessionErr) {
        setIsLogged(false);
        setUserEmail(""); // ✅ NOVO
        setActivePass(null);
        setError("Não consegui verificar seu login.");
        return;
      }

      const session = sessionData?.session;
      const userId = session?.user?.id;

      if (!userId) {
        setIsLogged(false);
        setUserEmail(""); // ✅ NOVO
        setActivePass(null);
        return;
      }

      setIsLogged(true);
      setUserEmail(session?.user?.email || ""); // ✅ NOVO

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
        setActivePass({ id: data[0].id, expires_at: data[0].expires_at });
      } else {
        setActivePass(null);
      }
    } catch (e: any) {
      setError("Erro inesperado: " + String(e?.message || e));
      setIsLogged(false);
      setUserEmail(""); // ✅ NOVO
      setActivePass(null);
    } finally {
      setIsLoading(false);
    }
  }

  // ✅ NOVO: sair/trocar email
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expiresMs = activePass?.expires_at ? new Date(activePass.expires_at).getTime() : null;
  const remainingMs = expiresMs ? expiresMs - nowMs : null;
  const hasActivePass = Boolean(activePass && remainingMs !== null && remainingMs > 0);

  function scrollToPlans() {
    const el = document.getElementById("passes");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 1) Apresentação curta */}
      <div
        style={{
          borderRadius: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.15)",
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0, lineHeight: 1.2 }}>Jornada</h1>
        <p style={{ margin: "10px 0 0 0", lineHeight: 1.4 }}>
          Uma experiência por estações: imagens em movimento, texto e áudio. Você pode experimentar grátis e, se quiser,
          comprar um passe de acesso temporário.
        </p>
      </div>

      {/* 2) Experiência grátis */}
      <div
        style={{
          borderRadius: 16,
          padding: 16,
          border: "1px solid rgba(0,0,0,0.15)",
        }}
      >
        <h2 style={{ fontSize: 16, margin: 0 }}>Experimente (grátis)</h2>
        <p style={{ margin: "8px 0 12px 0", lineHeight: 1.4 }}>
          Um trecho curto para você sentir o ritmo da experiência.
        </p>

        <audio controls style={{ width: "100%" }}>
          <source src="/sample.mp3" type="audio/mpeg" />
          Seu navegador não conseguiu tocar o áudio.
        </audio>

        <p style={{ margin: "10px 0 0 0", fontSize: 12, opacity: 0.75, lineHeight: 1.3 }}>
          (Por enquanto este áudio é um “arquivo exemplo”. Depois vamos trocar pelo seu.)
        </p>
      </div>

      {/* ✅ 3) BLOCO ÚNICO: status do passe / continuar / recuperar */}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Seu acesso</h2>

          <button
            onClick={checkStatus}
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Atualizar
          </button>
        </div>

        {/* ✅ NOVO: mostrar email + botão sair (somente quando logado) */}
        {isLogged && userEmail ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.35 }}>
              Logado como: <b>{userEmail}</b>
            </div>

            <button
              onClick={logout}
              style={{
                height: 30,
                padding: "0 10px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Sair / trocar e-mail
            </button>
          </div>
        ) : null}

        {isLoading ? (
          <p style={{ margin: 0, opacity: 0.8 }}>Verificando seu passe…</p>
        ) : hasActivePass ? (
          <>
            <p style={{ margin: 0, lineHeight: 1.4 }}>
              ✅ Seu passe está ativo <b>até {formatLocalTime(activePass!.expires_at)}</b>.
            </p>
            <p style={{ margin: 0, lineHeight: 1.4, opacity: 0.85 }}>
              Faltam <b>{formatTimeLeft(remainingMs!)}</b>.
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
                marginTop: 4,
              }}
            >
              Continuar Jornada
            </button>

            <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
              Se você fechar o app, é só voltar aqui e tocar em “Continuar Jornada”.
            </div>
          </>
        ) : isLogged ? (
          <>
            <p style={{ margin: 0, lineHeight: 1.4 }}>
              Você está logado, mas <b>não tem passe ativo</b> agora.
            </p>

            <button
              onClick={scrollToPlans}
              style={{
                height: 48,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontSize: 16,
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              Comprar um passe
            </button>

            <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
              Dica: se você acha que já pagou, toque em “Atualizar” acima.
            </div>
          </>
        ) : (
          <>
            {/* ✅ MENSAGEM CORRIGIDA (não logado) */}
            <p style={{ margin: 0, lineHeight: 1.4 }}>
              Acesse a experiência com seu e-mail e compre seu passe.
            </p>

            <Link
              href="/login"
              style={{
                height: 48,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontSize: 16,
                cursor: "pointer",
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                color: "black",
              }}
            >
              Entrar / acessar experiência
            </Link>

            <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
              Depois de entrar, você pode comprar um passe e o app reconhece seu acesso.
            </div>
          </>
        )}

        {error && (
          <div style={{ color: "crimson", fontSize: 13, lineHeight: 1.35 }}>
            <b>Erro:</b> {error}
          </div>
        )}
      </div>

      {/* 4) Planos pagos */}
      <div id="passes" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Escolha seu passe</h2>

        <PlanButton href="/login?plano=1h" title="1 hora" subtitle="Acesso por 60 minutos" />
        <PlanButton href="/login?plano=2h" title="2 horas" subtitle="Acesso por 120 minutos" />
        <PlanButton href="/login?plano=day" title="Dia todo" subtitle="Acesso por 24 horas" />
      </div>

      {/* Login opcional (pequeno) */}
      <div style={{ marginTop: 4, textAlign: "center" }}>
        <Link href="/login" style={{ fontSize: 13, textDecoration: "none" }}>
          Já tenho conta / entrar
        </Link>
      </div>
    </main>
  );
}

function PlanButton({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      style={{
        height: 64,
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.15)",
        background: "white",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 16px",
        textDecoration: "none",
        color: "black",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.75 }}>{subtitle}</div>
    </Link>
  );
}
