"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import JourneyPage from "../page";

const KEY_CURRENT_EXPERIENCE = "jornada:current_experience_id";

type LoadState =
  | { status: "loading" }
  | { status: "blocked" }
  | { status: "ok" };

type DeviceState =
  | { status: "unknown" }
  | { status: "mobile" }
  | { status: "not-mobile" };

function detectMobileDevice(): boolean {
  // Gate gentil: é melhor errar "pra não-mobile" do que liberar Journey em desktop.
  // Como isso roda só no "play=1", não afeta Home/Landing/compra.
  try {
    const ua = (navigator.userAgent || "").toLowerCase();

    // Detectores comuns
    const isIPhone = ua.includes("iphone");
    const isAndroid = ua.includes("android");
    const isMobileToken = ua.includes("mobile");
    const isIPad =
      ua.includes("ipad") ||
      // iPadOS às vezes se identifica como Mac, mas com touchpoints altos
      (ua.includes("macintosh") && (navigator.maxTouchPoints || 0) > 1);

    // Tablet (iPad) NÃO deve iniciar Journey, então NÃO tratamos iPad como mobile aqui.
    if (isIPad) return false;

    // Smartphone (iphone / android mobile)
    if (isIPhone) return true;
    if (isAndroid && isMobileToken) return true;

    // Fallback: alguns Androids não trazem "mobile" de forma consistente
    if (isAndroid && !isIPad) return true;

    return false;
  } catch {
    return false;
  }
}

export default function JourneyBySlugPage() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();

  const slug = (params?.slug as string) || "";
  const play = search.get("play") === "1";

  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Gate mobile-only: só importa quando play=1
  const [device, setDevice] = useState<DeviceState>({ status: "unknown" });

  const currentUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);

  useEffect(() => {
    if (!slug) return;
    try {
      localStorage.setItem(KEY_CURRENT_EXPERIENCE, slug);
    } catch {}
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      setState({ status: "blocked" });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/experiences/${encodeURIComponent(slug)}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          if (!cancelled) setState({ status: "blocked" });
          return;
        }

        const json = await res.json();
        if (!json?.ok) {
          if (!cancelled) setState({ status: "blocked" });
          return;
        }

        if (!cancelled) setState({ status: "ok" });
      } catch {
        if (!cancelled) setState({ status: "blocked" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Se estiver ok e NÃO for play=1 → manda para a landing
  useEffect(() => {
    if (state.status !== "ok") return;
    if (play) return;

    router.replace(`/journey/${encodeURIComponent(slug)}/landing`);
  }, [state.status, play, slug, router]);

  // ✅ Gate mobile-only: só roda quando play=1 e o slug está ok
  useEffect(() => {
    if (state.status !== "ok") return;
    if (!play) return;

    const isMobile = detectMobileDevice();
    setDevice(isMobile ? { status: "mobile" } : { status: "not-mobile" });
  }, [state.status, play]);

  // ✅ AGORA MOSTRA UI (para não ficar “tela branca”)
  if (state.status === "loading") {
    return (
      <main
        style={{
          padding: 16,
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 18,
            padding: 16,
            background: "white",
          }}
        >
          <strong>Carregando experiência…</strong>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
            (Se isso não sair do lugar, o app não está conseguindo validar o slug no
            servidor.)
          </div>
        </div>
      </main>
    );
  }

  if (state.status === "blocked") {
    return (
      <main
        style={{
          padding: 16,
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 18,
            padding: 16,
            background: "white",
          }}
        >
          <strong>Experiência indisponível</strong>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
            Este slug não está publicado/ativo (ou não existe).
          </div>

          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
            Slug: <b>{slug || "(vazio)"}</b>
          </div>

          <button
            style={{ marginTop: 12 }}
            onClick={() => router.replace(`/journey/${encodeURIComponent(slug)}/landing`)}
            disabled={!slug}
          >
            Tentar abrir a landing
          </button>
        </div>
      </main>
    );
  }

  if (!play) return null;

  // ✅ Se é play=1 mas NÃO é smartphone → não inicia Journey (gate gentil)
  if (device.status === "unknown") {
    // micro loading curtinho só enquanto detecta device
    return (
      <main
        style={{
          padding: 16,
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 18,
            padding: 16,
            background: "white",
          }}
        >
          <strong>Preparando a experiência…</strong>
        </div>
      </main>
    );
  }

  if (device.status === "not-mobile") {
    return (
      <main
        style={{
          padding: 16,
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: 560,
            width: "100%",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 18,
            padding: 16,
            background: "white",
          }}
        >
          <strong>Esta experiência acontece no celular.</strong>

          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75, lineHeight: 1.4 }}>
            Para iniciar o Audiowalk, abra este link no seu smartphone.
          </div>

          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(0,0,0,0.03)",
              wordBreak: "break-all",
            }}
          >
            {currentUrl || "(link indisponível)"}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(currentUrl);
                } catch {}
              }}
              disabled={!currentUrl}
            >
              Copiar link
            </button>

            <button
              onClick={() => {
                // Volta para a landing técnica (ante-sala), sem iniciar
                router.replace(`/journey/${encodeURIComponent(slug)}/landing`);
              }}
            >
              Voltar para a landing
            </button>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65 }}>
            (Depois, se você quiser, a gente adiciona um QR code aqui como próximo micro-passo.)
          </div>
        </div>
      </main>
    );
  }

  // ✅ Smartphone: inicia Journey
  return <JourneyPage />;
}
