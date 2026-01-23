"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { stations } from "../lib/stations";
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

export default function JourneyPage() {
  const [index, setIndex] = useState(0);
  const current = stations[index];

  // swipe
  const startX = useRef<number | null>(null);
  const deltaX = useRef<number>(0);
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

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

  // ✅ restaura após reload (ou primeira entrada)
  const restoredOnceRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (restoredOnceRef.current) return;
    restoredOnceRef.current = true;

    const rawIndex = safeGet(KEY_INDEX);
    const n = rawIndex ? Number(rawIndex) : 0;
    const safeIndex =
      Number.isFinite(n) ? Math.max(0, Math.min(stations.length - 1, n)) : 0;

    const wasPlaying = safeGet(KEY_PLAYING) === "true";

    // 1) seta a estação
    setIndex(safeIndex);

    // 2) depois de render, aplica o seek e retoma
    window.setTimeout(() => {
      const st = stations[safeIndex];
      if (!st?.id) return;

      const rawPos = safeGet(KEY_POS_PREFIX + st.id);
      const pos = rawPos ? Number(rawPos) : 0;
      const safePos = Number.isFinite(pos) ? Math.max(0, pos) : 0;

      setSeekTo(safePos);

      if (wasPlaying) {
        // dá um tempo pro seek “pegar”
        window.setTimeout(() => setPlaySignal((v) => v + 1), 250);
      }
    }, 250);
  }, []);

  // ✅ salva continuamente enquanto toca (para “blindar” contra reload do SO)
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
      // não muda UX — só salva
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
  // PRELOAD OFFLINE PROGRESSIVO (COM PERSISTÊNCIA)
  // =========================
  const preloadStartedRef = useRef(false);
  useEffect(() => {
    if (preloadStartedRef.current) return;
    preloadStartedRef.current = true;

    const urls = collectStationAssets(stations);

    // garante que a "memória" corresponde ao conjunto atual
    const { cleared } = ensureManifestForUrls(urls);
    if (cleared) {
      console.log("Preload manifest resetado (mudança de assets)");
    }

    // só baixa o que ainda não temos
    const missing = filterMissingUrls(urls);

    if (missing.length === 0) {
      console.log("Todos os assets já estão disponíveis offline");
      return;
    }

    preloadAssets(missing, {
      delayMs: 300,
      onProgress: (currentNum, total, url) => {
        console.log(`Offline preload ${currentNum}/${total}`, url);
      },
      onResult: (url, ok) => {
        if (ok) markUrlOk(url);
      },
    });
  }, []);

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

  // swipe
  function onPointerDown(e: React.PointerEvent) {
    if (isAnimating) return;
    startX.current = e.clientX;
    deltaX.current = 0;
    setDragX(0);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null || isAnimating) return;
    const dx = e.clientX - startX.current;
    deltaX.current = dx;
    setDragX(dx);
  }

  function onPointerUp() {
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
      <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/library" style={{ textDecoration: "none", fontSize: 13 }}>
            ← Biblioteca
          </Link>

          <div style={{ fontSize: 13, opacity: 0.75 }}>
            {index + 1} / {stations.length}
          </div>

          <div style={{ width: 72 }} />
        </div>

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
            title={current.title}
            text={current.text}
            images={current.images}
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
      </main>
    </AccessGuard>
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

      <div style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.15)", padding: 12 }}>
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
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
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
