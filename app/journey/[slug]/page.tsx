"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import JourneyPage from "../page";

const KEY_CURRENT_EXPERIENCE = "jornada:current_experience_id";

type LoadState =
  | { status: "loading" }
  | { status: "blocked" }
  | { status: "ok" };

export default function JourneyBySlugPage() {
  const router = useRouter();
  const params = useParams();
  const search = useSearchParams();

  const slug = (params?.slug as string) || "";
  const play = search.get("play") === "1";

  const [state, setState] = useState<LoadState>({ status: "loading" });

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

  return <JourneyPage />;
}
