"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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

export default function PaymentSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // ✅ mantém o contexto da experiência até o pending (que faz o polling)
    const expFromUrl = readExpFromUrl();
    const exp = expFromUrl || getLastExpFallback() || "audiowalk1";

    // ✅ garante fallback pro app inteiro
    persistLastExp(exp);

    // ✅ manda pro pending COM exp
    const qs = new URLSearchParams();
    qs.set("exp", exp);

    const t = setTimeout(() => {
      router.replace(`/payment/pending?${qs.toString()}`);
    }, 600);

    return () => clearTimeout(t);
  }, [router]);

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
      <h1 style={{ margin: 0 }}>Pagamento recebido ✅</h1>
      <p style={{ margin: 0, opacity: 0.85 }}>
        Estamos confirmando seu acesso agora. Você será redirecionado automaticamente…
      </p>
      <p style={{ margin: 0, opacity: 0.7, fontSize: 13 }}>
        Se não redirecionar, volte para a aba do app e aguarde na tela “Aguardando confirmação…”.
      </p>
    </main>
  );
}
