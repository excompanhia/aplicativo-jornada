"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { stations as fallbackStations } from "../lib/stations";
import { collectStationAssets } from "@/app/lib/preloadStations";
import { preloadAssets } from "@/app/lib/preloadRunner";
import {
  ensureManifestForUrls,
  filterMissingUrls,
  markUrlOk,
} from "@/app/lib/preloadManifest";
import AudioEngine, { EngineTrack } from "../components/AudioEngine";
import { onPauseAudioNow } from "../lib/appEvents";
import AccessGuard from "./AccessGuard";

type Direction = "left" | "right" | "none";

const KEY_INDEX = "jornada:journey:index";
const KEY_PLAYING = "jornada:journey:playing";
const KEY_POS_PREFIX = "jornada:journey:pos:"; // + stationId

// Analytics keys
const KEY_ANON_ID = "jornada:anon_id";

// ✅ Experiência atual (slug) salva por /journey/[slug] e /journey/[slug]/landing
const KEY_CURRENT_EXPERIENCE = "jornada:current_experience_id";

// ✅ BLOCO 3: polimento preload (UI simples)
type PreloadUiState =
  | { status: "idle" }
  | { status: "running"; done: number; total: number; lastUrl?: string }
  | { status: "done"; total: number }
  | { status: "error"; message: string };

type Station = {
  id: string;
  title: string;
  text: string;
  images: string[];
  audioSrc: string;
};

function safeLocalGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeLocalSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}
function safeSessionGet(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSessionSet(key: string, value: string) {
  try {
    return window.sessionStorage.setItem(key, value);
  } catch {}
}

function getOrCreateAnonId() {
  const existing = safeLocalGet(KEY_ANON_ID);
  if (existing) return existing;

  let id = "";
  try {
    // navegadores modernos
    // @ts-ignore
    id =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "";
  } catch {}

  if (!id) {
    // fallback simples
    id = `anon_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  safeLocalSet(KEY_ANON_ID, id);
  return id;
}

function readTrackingFromUrl() {
  // aceita vários nomes para facilitar sua vida na hora de criar QR
  const params = new URLSearchParams(window.location.search);

  const experience_id =
    (params.get("exp") ||
      params.get("experience_id") ||
      params.get("experience") ||
      "default"
    ).trim();

  const qr_point_id =
    (params.get("qr") ||
      params.get("qr_point_id") ||
      params.get("point") ||
      "").trim();

  return { experience_id, qr_point_id };
}

// ✅ fonte de verdade do experience_id para analytics
function getExperienceIdForAnalytics() {
  const fromLocal = safeLocalGet(KEY_CURRENT_EXPERIENCE);
  if (fromLocal && fromLocal.trim()) return fromLocal.trim();

  const fromUrl = readTrackingFromUrl().experience_id;
  if (fromUrl && fromUrl.trim()) return fromUrl.trim();

  return "default";
}

function makeStationsKey(list: Station[]) {
  if (!list || list.length === 0) return "empty";
  // chave simples e estável para evitar rodar efeitos infinitamente
  return list.map((s) => s.id).join("|");
}

export default function JourneyPage() {
  const router = useRouter();

  // ✅ stations agora são dinâmicas (fallback seguro para stations.ts)
  const [stationsState, setStationsState] = useState<Station[]>(
    fallbackStations as unknown as Station[]
  );

  const stations = stationsState;
  const [index, setIndex] = useState(0);
  const current = stations[index];

  // ✅ Biblioteca overlay
  const [showLibrary, setShowLibrary] = useState(false);

  // swipe
  const startX = useRef<number | null>(null);
  const deltaX = useRef<number>(0);
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // ✅ BLOCO 3: UI do preload
  const [preloadUi, setPreloadUi] = useState<PreloadUiState>({
    status: "idle",
  });

  // player state
  const [playerState, setPlayerState] = useState<{
    currentTime: number;
    duration: number;
    paused: boolean;
  }>({
    currentTime: 0,
    duration: 0,
    paused: true,
  });

  // AudioEngine signals
  const [playSignal, setPlaySignal] = useState(0);
  const [pauseSignal, setPauseSignal] = useState(0);
  const [seekTo, setSeekTo] = useState<number | null>(null);

  // refs do último estado (pra salvar “na marra” mesmo se tudo estiver mudando)
  const latestIndexRef = useRef(0);
  const latestStationIdRef = useRef<string | null>(null);
  const latestTimeRef = useRef(0);
  const latestPausedRef = useRef(true);

  useEffect(() => {
    latestIndexRef.current = index;
  }, [index]);

  useEffect(() => {
    latestStationIdRef.current = current?.id ?? null;
  }, [current?.id]);

  useEffect(() => {
    latestTimeRef.current = playerState.currentTime || 0;
    latestPausedRef.current = playerState.paused;
  }, [playerState.currentTime, playerState.paused]);

  function safeSet(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
  }
  function safeGet(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function saveSnapshot() {
    const stationId = latestStationIdRef.current;
    if (!stationId) return;

    safeSet(KEY_INDEX, String(latestIndexRef.current));
    safeSet(KEY_PLAYING, String(!latestPausedRef.current));
    safeSet(KEY_POS_PREFIX + stationId, String(latestTimeRef.current || 0));
  }

  // ✅ (NOVO) Carrega stations reais do Supabase via API pública, usando o slug atual
  const stationsLoadedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (stationsLoadedRef.current) return;
    stationsLoadedRef.current = true;

    const slug = safeLocalGet(KEY_CURRENT_EXPERIENCE) || "";
    if (!slug.trim()) return;

    (async () => {
      try {
        const res = await fetch(`/api/experiences/${encodeURIComponent(slug.trim())}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        if (!json?.ok) return;

        const rawStations = Array.isArray(json?.stations) ? json.stations : [];
        if (!rawStations || rawStations.length === 0) return;

        const mapped: Station[] = rawStations
          .map((st: any) => ({
            id: String(st?.id || ""),
            title: String(st?.title || ""),
            text: String(st?.text || ""),
            images: Array.isArray(st?.images) ? st.images.map((x: any) => String(x)) : [],
            audioSrc: String(st?.audio_url || ""),
          }))
          .filter((s: Station) => !!s.id && !!s.title);

        if (mapped.length === 0) return;

        setStationsState(mapped);
      } catch {
        // fallback conservador (fica no stations.ts)
      }
    })();
  }, []);

  // ✅ ANALYTICS: QR_OPEN (1 vez por sessão)
  const analyticsStartedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (analyticsStartedRef.current) return;
    analyticsStartedRef.current = true;

    try {
      const { qr_point_id } = readTrackingFromUrl();

      const experience_id = getExperienceIdForAnalytics();
      const point = qr_point_id || "unknown";
      const anon_id = getOrCreateAnonId();

      const sessionKey = `jornada:qr_open:sent:${experience_id}:${point}`;
      if (safeSessionGet(sessionKey) === "true") return;
      safeSessionSet(sessionKey, "true");

      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experience_id,
          event_type: "qr_open",
          anon_id,
          qr_point_id: point,
        }),
        cache: "no-store",
      }).catch(() => {});
    } catch {}
  }, []);

  // ✅ restaura após reload (agora respeitando a lista de stations atual)
  const restoredForKeyRef = useRef<string>("");
  useEffect(() => {
    if (typeof window === "undefined") return;

    const stationsKey = makeStationsKey(stations);
    if (!stationsKey || stationsKey === "empty") return;

    // evita ficar re-rodando sem necessidade
    if (restoredForKeyRef.current === stationsKey) return;
    restoredForKeyRef.current = stationsKey;

    const rawIndex = safeGet(KEY_INDEX);
    const n = rawIndex ? Number(rawIndex) : 0;
    const safeIndex =
      Number.isFinite(n) ? Math.max(0, Math.min(stations.length - 1, n)) : 0;

    const wasPlaying = safeGet(KEY_PLAYING) === "true";

    setIndex(safeIndex);

    window.setTimeout(() => {
      const st = stations[safeIndex];
      if (!st?.id) return;

      const rawPos = safeGet(KEY_POS_PREFIX + st.id);
      const pos = rawPos ? Number(rawPos) : 0;
      const safePos = Number.isFinite(pos) ? Math.max(0, pos) : 0;

      setSeekTo(safePos);

      if (wasPlaying) {
        window.setTimeout(() => setPlaySignal((v) => v + 1), 250);
      }
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations]);

  // ✅ salva continuamente enquanto toca
  useEffect(() => {
    if (typeof window === "undefined") return;

    const id = window.setInterval(() => {
      if (!latestPausedRef.current) saveSnapshot();
    }, 900);

    return () => window.clearInterval(id);
  }, []);

  // ✅ salva em momentos críticos
  useEffect(() => {
    if (typeof window === "undefined") return;

    function onPageHide() {
      saveSnapshot();
    }
    function onVis() {
      if (document.visibilityState !== "visible") saveSnapshot();
    }
    function onOffline() {
      saveSnapshot();
    }
    function onOnline() {
      saveSnapshot();
    }

    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // pausa global (aviso 5 min)
  useEffect(() => {
    return onPauseAudioNow(() => {
      safeSet(KEY_PLAYING, "false");
      saveSnapshot();
      setPauseSignal((n) => n + 1);
    });
  }, []);

  // =========================
  // PRELOAD OFFLINE PROGRESSIVO (COM PERSISTÊNCIA) + UI (BLOCO 3)
  // =========================
  const preloadForKeyRef = useRef<string>("");
  useEffect(() => {
    const stationsKey = makeStationsKey(stations);
    if (!stationsKey || stationsKey === "empty") return;

    // roda preload 1x por lista de stations (por experiência)
    if (preloadForKeyRef.current === stationsKey) return;
    preloadForKeyRef.current = stationsKey;

    (async () => {
      try {
        const urls = collectStationAssets(stations as any);

        ensureManifestForUrls(urls);
        const missing = filterMissingUrls(urls);

        if (missing.length === 0) {
          setPreloadUi({ status: "done", total: 0 });
          window.setTimeout(() => setPreloadUi({ status: "idle" }), 800);
          return;
        }

        setPreloadUi({ status: "running", done: 0, total: missing.length });

        await preloadAssets(missing, {
          delayMs: 300,
          onProgress: (currentNum, total, url) => {
            setPreloadUi({
              status: "running",
              done: currentNum,
              total,
              lastUrl: url,
            });
          },
          onResult: (url, ok) => {
            if (ok) markUrlOk(url);
          },
        });

        setPreloadUi({ status: "done", total: missing.length });
        window.setTimeout(() => setPreloadUi({ status: "idle" }), 2000);
      } catch (err: any) {
        setPreloadUi({
          status: "error",
          message: err?.message ? String(err.message) : "Erro no preload offline",
        });

        window.setTimeout(() => setPreloadUi({ status: "idle" }), 2500);
      }
    })();
  }, [stations]);

  // track atual
  const track: EngineTrack | null = useMemo(() => {
    if (!current) return null;
    return { id: current.id, title: current.title, audioSrc: current.audioSrc };
  }, [current]);

  // navegação
  const canGoPrev = index > 0;
  const canGoNext = index < stations.length - 1;

  function clampIndex(n: number) {
    if (n < 0) return 0;
    if (n > stations.length - 1) return stations.length - 1;
    return n;
  }

  function goNext() {
    saveSnapshot();
    setPauseSignal((v) => v + 1);
    setIndex((v) => clampIndex(v + 1));
  }

  function goPrev() {
    saveSnapshot();
    setPauseSignal((v) => v + 1);
    setIndex((v) => clampIndex(v - 1));
  }

  // ✅ Biblioteca: escolher estação
  function goToStation(targetIndex: number) {
    const safeIndex = clampIndex(targetIndex);

    // comportamento igual a trocar de estação manualmente:
    // salva estado e pausa antes de mudar
    saveSnapshot();
    setPauseSignal((v) => v + 1);

    setIndex(safeIndex);
    setShowLibrary(false);
  }

  // ✅ Biblioteca: sair para landing
  function exitToLanding() {
    // salva o estado atual antes de sair
    saveSnapshot();
    safeSet(KEY_PLAYING, "false");
    setPauseSignal((v) => v + 1);

    // ✅ sai para a landing da experiência atual (slug)
    const slug = safeLocalGet(KEY_CURRENT_EXPERIENCE);
    if (slug && slug.trim()) {
      router.replace(`/journey/${encodeURIComponent(slug.trim())}/landing`);
      return;
    }

    // fallback conservador
    router.replace("/");
  }

  // swipe
  function onPointerDown(e: React.PointerEvent) {
    if (isAnimating || showLibrary) return;
    startX.current = e.clientX;
    deltaX.current = 0;
    setDragX(0);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (showLibrary) return;
    if (startX.current === null || isAnimating) return;
    const dx = e.clientX - startX.current;
    deltaX.current = dx;
    setDragX(dx);
  }

  function onPointerUp() {
    if (showLibrary) return;
    if (startX.current === null || isAnimating) return;

    const threshold = 60;
    const dx = deltaX.current;

    let dir: Direction = "none";
    if (dx <= -threshold) dir = "left";
    if (dx >= threshold) dir = "right";

    setIsAnimating(true);

    if (dir === "left" && canGoNext) {
      setDragX(-120);
      setTimeout(() => {
        goNext();
        setDragX(0);
        setIsAnimating(false);
      }, 160);
    } else if (dir === "right" && canGoPrev) {
      setDragX(120);
      setTimeout(() => {
        goPrev();
        setDragX(0);
        setIsAnimating(false);
      }, 160);
    } else {
      setDragX(0);
      setTimeout(() => setIsAnimating(false), 160);
    }

    startX.current = null;
    deltaX.current = 0;
  }

  return (
    <AccessGuard>
      <main
        style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={() => setShowLibrary(true)}
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
            BIBLIOTECA
          </button>

          <div style={{ fontSize: 13, opacity: 0.75 }}>
            {index + 1} / {stations.length}
          </div>

          <div style={{ width: 88 }} />
        </div>

        {/* ✅ BLOCO 3: feedback visual do preload (discreto) */}
        {preloadUi.status !== "idle" && <PreloadBanner state={preloadUi} />}

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            borderRadius: 18,
            border: "1px solid rgba(0,0,0,0.15)",
            overflow: "hidden",
            touchAction: "pan-y",
            transform: `translateX(${dragX}px)`,
            transition: isAnimating ? "transform 160ms ease" : "none",
            background: "white",
          }}
        >
          <StationView
            title={current?.title || ""}
            text={current?.text || ""}
            images={current?.images || []}
            playerState={playerState}
            onPlay={() => {
              safeSet(KEY_PLAYING, "true");
              saveSnapshot();
              setPlaySignal((n) => n + 1);
            }}
            onPause={() => {
              safeSet(KEY_PLAYING, "false");
              saveSnapshot();
              setPauseSignal((n) => n + 1);
            }}
            onSeek={(t: number) => {
              setSeekTo(t);
              window.setTimeout(() => saveSnapshot(), 120);
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={goPrev}
            disabled={!canGoPrev}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              opacity: canGoPrev ? 1 : 0.4,
              cursor: canGoPrev ? "pointer" : "default",
            }}
          >
            ← Anterior
          </button>

          <button
            onClick={goNext}
            disabled={!canGoNext}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              opacity: canGoNext ? 1 : 0.4,
              cursor: canGoNext ? "pointer" : "default",
            }}
          >
            Próxima →
          </button>
        </div>

        <AudioEngine
          track={track}
          onTimeUpdate={setPlayerState}
          requestPlay={playSignal}
          requestPause={pauseSignal}
          requestSeekTo={seekTo}
        />

        {/* ✅ Biblioteca Overlay */}
        {showLibrary && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2000,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 520,
                maxHeight: "85vh",
                background: "white",
                borderRadius: 18,
                border: "1px solid rgba(0,0,0,0.15)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header: SAIR / CONTINUAR */}
              <div
                style={{
                  padding: 12,
                  borderBottom: "1px solid rgba(0,0,0,0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={exitToLanding}
                  style={{
                    height: 36,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  SAIR
                </button>

                <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.85 }}>
                  BIBLIOTECA
                </div>

                <button
                  type="button"
                  onClick={() => setShowLibrary(false)}
                  style={{
                    height: 36,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  CONTINUAR
                </button>
              </div>

              {/* Lista */}
              <div style={{ padding: 12, overflow: "auto" }}>
                <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
                  Escolha uma estação:
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {stations.map((st, i) => {
                    const isCurrent = i === index;
                    return (
                      <button
                        key={st.id || String(i)}
                        type="button"
                        onClick={() => goToStation(i)}
                        style={{
                          textAlign: "left",
                          padding: "12px 12px",
                          borderRadius: 14,
                          border: "1px solid rgba(0,0,0,0.15)",
                          background: isCurrent ? "rgba(0,0,0,0.04)" : "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                          }}
                        >
                          <div style={{ fontSize: 14, fontWeight: 700 }}>
                            {st.title}
                          </div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            Estação {i + 1}
                            {isCurrent ? " — (agora)" : ""}
                          </div>
                        </div>

                        <div style={{ fontSize: 12, opacity: 0.65 }}>abrir →</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </AccessGuard>
  );
}

function PreloadBanner({ state }: { state: PreloadUiState }) {
  let text = "";
  if (state.status === "running") {
    text = `Preparando offline ${state.done}/${state.total}`;
  } else if (state.status === "done") {
    text = state.total > 0 ? "Offline pronto ✓" : "Offline já estava pronto ✓";
  } else if (state.status === "error") {
    text = "Preload offline falhou (seguindo mesmo assim)";
  } else {
    return null;
  }

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.12)",
        background: "rgba(0,0,0,0.03)",
        padding: "10px 12px",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 600 }}>{text}</div>

      {state.status === "running" && (
        <div style={{ opacity: 0.7, fontSize: 12 }}>preparando uso offline…</div>
      )}
    </div>
  );
}

function StationView({
  title,
  text,
  images,
  playerState,
  onPlay,
  onPause,
  onSeek,
}: {
  title: string;
  text: string;
  images: string[];
  playerState: { currentTime: number; duration: number; paused: boolean };
  onPlay: () => void;
  onPause: () => void;
  onSeek: (t: number) => void;
}) {
  function formatTime(seconds: number) {
    const s = Math.floor(seconds || 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
      <AutoGallery images={images} seconds={3.5} />

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.15)",
          padding: 12,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>Áudio</div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={playerState.paused ? onPlay : onPause}
            style={{
              height: 44,
              padding: "0 14px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {playerState.paused ? "Play" : "Pausar"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {formatTime(playerState.currentTime)} / {formatTime(playerState.duration)}
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(1, playerState.duration)}
          value={Math.min(playerState.currentTime, playerState.duration || 0)}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={{ width: "100%", marginTop: 10 }}
        />
      </div>

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,0.15)",
          padding: 14,
          lineHeight: 1.45,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function AutoGallery({ images, seconds }: { images: string[]; seconds: number }) {
  const [i, setI] = useState(0);

  useEffect(() => setI(0), [images]);

  useEffect(() => {
    if (!images || images.length === 0) return;

    const id = window.setInterval(() => {
      setI((prev) => (prev + 1) % images.length);
    }, Math.round(seconds * 1000));

    return () => window.clearInterval(id);
  }, [images, seconds]);

  const total = images.length;
  const currentSrc = images[i] || "";

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.15)",
        overflow: "hidden",
        position: "relative",
        height: 260,
        background: "rgba(0,0,0,0.03)",
      }}
    >
      {total > 0 ? (
        <img
          src={currentSrc}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.7,
          }}
        >
          (Sem imagens)
        </div>
      )}

      {total > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {images.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.8)",
                background: idx === i ? "white" : "rgba(255,255,255,0.35)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
