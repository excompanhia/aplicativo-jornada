"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// Reaproveita o Journey real existente (app/journey/page.tsx)
import JourneyPage from "../page";

const KEY_CURRENT_EXPERIENCE = "jornada:current_experience_id";

type LoadState =
  | { status: "loading" }
  | { status: "blocked" }
  | { status: "ok" };

export default function JourneyBySlugPage() {
  const params = useParams();
  const slug = (params?.slug as string) || "";

  const [state, setState] = useState<LoadState>({ status: "loading" });

  // 1) Salva o slug localmente (métricas/lógica futura)
  useEffect(() => {
    if (!slug) return;
    try {
      localStorage.setItem(KEY_CURRENT_EXPERIENCE, slug);
    } catch {
      // sem crash se storage estiver bloqueado
    }
  }, [slug]);

  // 2) Valida se a experiência existe e está "publicada" (is_active = true)
  useEffect(() => {
    if (!slug) {
      setState({ status: "blocked" });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setState({ status: "loading" });

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

  // 3) UI simples (sem “UI bonita” ainda)
  if (state.status === "loading") {
    return (
      <main
        style={{
          padding: 16,
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial',
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 18,
            background: "white",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
            Carregando experiência…
          </div>
          <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.45 }}>
            Estamos validando se este AudioWalk está publicado.
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
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial',
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 18,
            background: "white",
            padding: 16,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>
            Experiência indisponível
          </div>
          <div style={{ fontSize: 13, opacity: 0.78, lineHeight: 1.45 }}>
            Este link não está ativo no momento (a experiência pode estar em rascunho
            ou não existir).
          </div>

          <div style={{ height: 10 }} />

          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Slug: <span style={{ fontWeight: 700 }}>{slug || "(vazio)"}</span>
          </div>
        </div>
      </main>
    );
  }

  // 4) Se passou na validação, entra no Journey real
  return <JourneyPage />;
}
