// app/[slug]/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const KEY_CURRENT_EXPERIENCE = "jornada:current_experience_id";

type LandingData = {
  logo_url: string | null;
  headline: string | null;
  description: string | null;
  free_preview_audio_url: string | null;
  free_preview_duration_seconds: number | null;
  blocks_order: any;
};

type ExperienceData = {
  id: string;
  slug: string;
  title: string;
  is_active: boolean;
};

type State =
  | { status: "loading" }
  | { status: "blocked" }
  | {
      status: "ok";
      slug: string;
      experience: ExperienceData;
      landing: LandingData | null;
    };

const DEFAULT_BLOCKS = ["logo", "text", "status", "free_preview", "actions"] as const;

const ALLOWED_BLOCKS = new Set<string>([
  "logo",
  "text",
  "status",
  "free_preview",
  "actions",
]);

function formatDurationLabel(seconds: number | null | undefined) {
  const s = typeof seconds === "number" && Number.isFinite(seconds) ? seconds : null;
  if (!s || s <= 0) return "Ouvir prévia";

  const rounded = Math.round(s / 5) * 5;
  if (rounded < 60) return `Ouvir prévia (${rounded}s)`;

  const mins = Math.round(rounded / 60);
  return `Ouvir prévia (${mins} min)`;
}

export default function PublicExperienceLandingPage() {
  const router = useRouter();
  const params = useParams();
  const slug = (params?.slug as string) || "";

  const [state, setState] = useState<State>({ status: "loading" });

  // preview áudio (experimente grátis)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentPreviewUrlRef = useRef<string>("");
  const [previewPlaying, setPreviewPlaying] = useState(false);

  // Salva o slug localmente
  useEffect(() => {
    if (!slug) return;
    try {
      localStorage.setItem(KEY_CURRENT_EXPERIENCE, slug);
    } catch {}
  }, [slug]);

  // Valida se a experiência existe e está publicada + pega landing
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

        const json = await res.json().catch(() => null);

        const exp = json?.experience as ExperienceData | undefined;
        if (!json?.ok || !exp?.title) {
          if (!cancelled) setState({ status: "blocked" });
          return;
        }

        const landing = (json?.landing ?? null) as LandingData | null;

        if (!cancelled) {
          setState({
            status: "ok",
            slug,
            experience: exp,
            landing,
          });
        }
      } catch {
        if (!cancelled) setState({ status: "blocked" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  // limpa áudio quando muda de experiência / recarrega
  useEffect(() => {
    setPreviewPlaying(false);
    currentPreviewUrlRef.current = "";
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
      audioRef.current = null;
    }
  }, [slug]);

  function stopPreview() {
    setPreviewPlaying(false);
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }
  }

  function togglePreview(url: string) {
    try {
      if (!audioRef.current || currentPreviewUrlRef.current !== url) {
        if (audioRef.current) {
          try {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          } catch {}
        }

        currentPreviewUrlRef.current = url;
        audioRef.current = new Audio(url);
        audioRef.current.addEventListener("ended", () => {
          setPreviewPlaying(false);
        });
      }

      if (previewPlaying) {
        audioRef.current.pause();
        setPreviewPlaying(false);
      } else {
        audioRef.current.play().then(
          () => setPreviewPlaying(true),
          () => setPreviewPlaying(false)
        );
      }
    } catch {
      setPreviewPlaying(false);
    }
  }

  // ordem dos blocos (se vier do Supabase) — fallback fixo
  const blocks = useMemo(() => {
    if (state.status !== "ok") return [...DEFAULT_BLOCKS];

    const raw = state.landing?.blocks_order;

    if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) {
      const filtered: string[] = [];
      for (const key of raw) {
        if (!ALLOWED_BLOCKS.has(key)) continue;
        if (filtered.includes(key)) continue;
        filtered.push(key);
      }
      if (filtered.length > 0) return filtered;
    }

    return [...DEFAULT_BLOCKS];
  }, [state]);

  if (state.status === "loading") {
    return (
      <main
        style={{
          padding: 16,
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.02)",
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
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          }}
        >
          <strong>Carregando experiência…</strong>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
            Só um instante.
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
          background: "rgba(0,0,0,0.02)",
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
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          }}
        >
          <strong>Experiência indisponível</strong>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
            Este link não está ativo no momento.
          </div>
          <button style={{ marginTop: 12 }} onClick={() => router.replace("/")}>
            Voltar
          </button>
        </div>
      </main>
    );
  }

  const exp = state.experience;
  const landing = state.landing;

  const logoUrl = landing?.logo_url || "";
  const headline = (landing?.headline || exp.title || "").trim();
  const description = (landing?.description || "").trim();
  const previewUrl = (landing?.free_preview_audio_url || "").trim();
  const previewDuration = landing?.free_preview_duration_seconds ?? null;

  const previewLabel = formatDurationLabel(previewDuration);

  function renderBlock(key: string) {
    if (key === "logo") {
      if (!logoUrl) return null;

      return (
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.12)",
            overflow: "hidden",
            background: "rgba(0,0,0,0.02)",
          }}
        >
          <img
            src={logoUrl}
            alt=""
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
      );
    }

    if (key === "text") {
      return (
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.12)",
            padding: 16,
            background: "white",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: -0.2 }}>
            {headline}
          </div>

          {description ? (
            <div style={{ marginTop: 10, fontSize: 14, opacity: 0.88, lineHeight: 1.5 }}>
              {description}
            </div>
          ) : (
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.65 }}>
              (Descrição ainda não preenchida)
            </div>
          )}
        </div>
      );
    }

    if (key === "status") {
      return (
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.12)",
            padding: 16,
            background: "white",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 6, textTransform: "uppercase" }}>
            Status
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.4 }}>
            Você está na experiência <b>{exp.slug}</b>.
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              (Login e passe serão verificados ao entrar na Journey.)
            </div>
          </div>
        </div>
      );
    }

    if (key === "free_preview") {
      return (
        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.12)",
            padding: 16,
            background: "white",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 8, textTransform: "uppercase" }}>
            Experimente grátis
          </div>

          {previewUrl ? (
            <button
              type="button"
              onClick={() => togglePreview(previewUrl)}
              style={{
                width: "100%",
                height: 54,
                borderRadius: 16,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                fontSize: 16,
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              {previewPlaying ? "Pausar prévia" : previewLabel}
            </button>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.65 }}>
              (Prévia grátis ainda não configurada)
            </div>
          )}
        </div>
      );
    }

    if (key === "actions") {
      return (
        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={{
              flex: 1,
              height: 54,
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontWeight: 950,
              cursor: "pointer",
              letterSpacing: 0.2,
            }}
            onClick={() => {
              stopPreview();
              router.replace(`/journey/${encodeURIComponent(slug)}?play=1`);
            }}
          >
            ENTRAR
          </button>

          <button
            style={{
              height: 54,
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(0,0,0,0.04)",
              cursor: "pointer",
              padding: "0 14px",
            }}
            onClick={() => {
              stopPreview();
              router.replace("/");
            }}
          >
            Voltar
          </button>
        </div>
      );
    }

    return null;
  }

  return (
    <main
      style={{
        padding: 16,
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.02)",
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
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
        }}
      >
        {blocks.map((b, i) => (
          <div key={`${b}-${i}`}>{renderBlock(b)}</div>
        ))}
      </div>
    </main>
  );
}
