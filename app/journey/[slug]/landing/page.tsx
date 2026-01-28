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

  // 1) Salva o slug localmente (para coerência geral do app)
  useEffect(() => {
    if (!slug) return;
    try {
      localStorage.setItem(KEY_CURRENT_EXPERIENCE, slug);
    } catch {}
  }, [slug]);

  // 2) Valida se existe e está ativa/publicada (is_active = true)
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
        <div style={{ width: "100%", maxWidth: 520, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 18, background: "white", padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>Carregando experiência…</div>
          <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.45 }}>
            Validando se este AudioWalk está publicado.
          </div>
        </div>
      </main>
    );
  }

  if (state.status === "blocked") {
    return (
      <main style={{ padding: 16, minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 520, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 18, background: "white", padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>Experiência indisponível</div>
          <div style={{ fontSize: 13, opacity: 0.78, lineHeight: 1.45 }}>
            Este link não está ativo no momento (a experiência pode estar em rascunho ou não existir).
          </div>

          <div style={{ height: 10 }} />

          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Slug: <span style={{ fontWeight: 700 }}>{slug || "(vazio)"}</span>
          </div>

          <div style={{ height: 14 }} />

          <button
            type="button"
            onClick={() => router.replace("/")}
            style={{
              height: 44,
              padding: "0 14px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Voltar
          </button>
        </div>
      </main>
    );
  }

  // OK
  return (
    <main style={{ padding: 16, minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 520, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 18, background: "white", padding: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 6 }}>
          {state.title}
        </div>
        <div style={{ fontSize: 13, opacity: 0.78, lineHeight: 1.45 }}>
          Landing da experiência (pública). Para entrar na jornada, você precisa estar logado e com passe ativo.
        </div>

        <div style={{ height: 14 }} />

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => router.replace(`/journey/${encodeURIComponent(slug)}`)}
            style={{
              flex: 1,
              height: 48,
              padding: "0 14px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            ENTRAR
          </button>

          <button
            type="button"
            onClick={() => router.replace("/")}
            style={{
              height: 48,
              padding: "0 14px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Voltar
          </button>
        </div>

        <div style={{ height: 10 }} />

        <div style={{ fontSize: 12, opacity: 0.6 }}>
          Slug: <span style={{ fontWeight: 700 }}>{slug}</span>
        </div>
      </div>
    </main>
  );
}
