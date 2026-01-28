"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const KEY_CURRENT_EXPERIENCE = "jornada:current_experience_id";

type State =
  | { status: "loading" }
  | { status: "blocked" }
  | { status: "ok"; title: string };

export default function ExperienceLandingPage() {
  const router = useRouter();
  const params = useParams();
  const slug = (params?.slug as string) || "";

  const [state, setState] = useState<State>({ status: "loading" });

  // Salva o slug localmente
  useEffect(() => {
    if (!slug) return;
    try {
      localStorage.setItem(KEY_CURRENT_EXPERIENCE, slug);
    } catch {}
  }, [slug]);

  // Valida se a experiência existe e está publicada
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
        const title = json?.experience?.title;

        if (!json?.ok || !title) {
          if (!cancelled) setState({ status: "blocked" });
          return;
        }

        if (!cancelled) setState({ status: "ok", title: String(title) });
      } catch {
        if (!cancelled) setState({ status: "blocked" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.status === "loading") {
    return (
      <main style={{ padding: 16, minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 520, width: "100%", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 18, padding: 16 }}>
          <strong>Carregando experiência…</strong>
        </div>
      </main>
    );
  }

  if (state.status === "blocked") {
    return (
      <main style={{ padding: 16, minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 520, width: "100%", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 18, padding: 16 }}>
          <strong>Experiência indisponível</strong>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
            Este link não está ativo no momento.
          </div>
          <button
            style={{ marginTop: 12 }}
            onClick={() => router.replace("/")}
          >
            Voltar
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 16, minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ maxWidth: 520, width: "100%", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 18, padding: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{state.title}</div>

        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
          Landing pública da experiência.
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          <button
            style={{ flex: 1, height: 48, fontWeight: 800 }}
            onClick={() =>
              router.replace(`/journey/${encodeURIComponent(slug)}?play=1`)
            }
          >
            ENTRAR
          </button>

          <button
            style={{ height: 48 }}
            onClick={() => router.replace("/")}
          >
            Voltar
          </button>
        </div>
      </div>
    </main>
  );
}
