"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { stations } from "../lib/stations";
import { collectStationAssets } from "../lib/preloadStations";
import { preloadAssets } from "../lib/preloadRunner";
import AudioEngine, { EngineTrack } from "../components/AudioEngine";
import { onPauseAudioNow } from "../lib/appEvents";
import AccessGuard from "./AccessGuard";

type Direction = "left" | "right" | "none";

export default function JourneyPage() {
  const [index, setIndex] = useState(0);
  const current = stations[index];

  // swipe
  const startX = useRef<number | null>(null);
  const deltaX = useRef<number>(0);
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // estado do player
  const [playerState, setPlayerState] = useState({
    currentTime: 0,
    duration: 0,
    paused: true,
  });

  // sinais para o AudioEngine
  const [playSignal, setPlaySignal] = useState(0);
  const [pauseSignal, setPauseSignal] = useState(0);
  const [seekTo, setSeekTo] = useState<number | null>(null);

  // memória de posição por estação (em RAM)
  const positionsRef = useRef<Record<string, number>>({});

  // troca de estação: pausa, salva posição, aplica posição da nova
  const prevStationIdRef = useRef<string | null>(null);

  useEffect(() => {
    const nowId = current?.id ?? null;
    const prevId = prevStationIdRef.current;

    if (prevId && prevId !== nowId) {
      positionsRef.current[prevId] = playerState.currentTime;
    }

    setPauseSignal((n) => n + 1);

    if (nowId) {
      const pos = positionsRef.current[nowId] ?? 0;
      setSeekTo(pos);
    }

    prevStationIdRef.current = nowId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // pausa global (ex: aviso 5 min)
  useEffect(() => {
    return onPauseAudioNow(() => {
      setPauseSignal((n) => n + 1);
    });
  }, []);

  // =========================
  // PRELOAD OFFLINE PROGRESSIVO
  // =========================
  const preloadStartedRef = useRef(false);

  useEffect(() => {
    if (preloadStartedRef.current) return;
    preloadStartedRef.current = true;

    const urls = collectStationAssets(stations);

    preloadAssets(urls, {
      delayMs: 300,
      onProgress: (currentNum, total, url) => {
        console.log(`Offline preload ${currentNum}/${total}`, url);
      },
    });
  }, []);

  // track atual
  const track: EngineTrack | null = useMemo(() => {
    if (!current) return null;
    return {
      id: current.id,
      title: current.title,
      audioSrc: current.audioSrc,
    };
  }, [current]);

  // limites
  const canGoPrev = index > 0;
  const canGoNext = index < stations.length - 1;

  function clampIndex(n: number) {
    if (n < 0) return 0;
    if (n > stations.length - 1) return stations.length - 1;
    return n;
  }

  function goNext() {
    setIndex((v) => clampIndex(v + 1));
  }

  function goPrev() {
    setIndex((v) => clampIndex(v - 1));
  }

  // swipe handlers
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

  // teclas (desktop / teste)
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "ArrowLeft") goPrev();
      if (ev.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AccessGuard>
      <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Topo */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/library" style={{ fontSize: 13, textDecoration: "none" }}>
            ← Biblioteca
          </Link>
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            {index + 1} / {stations.length}
          </div>
          <div style={{ width: 72 }} />
        </div>

        {/* Estação */}
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
            onPlay={() => setPlaySignal((n) => n + 1)}
            onPause={() => setPauseSignal((n) => n + 1)}
            onSeek={(t) => setSeekTo(t)}
          />
        </div>

        {/* Botões */}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={goPrev} disabled={!canGoPrev} style={navBtn(canGoPrev)}>
            ← Anterior
          </button>
          <button onClick={goNext} disabled={!canGoNext} style={navBtn(canGoNext)}>
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

function navBtn(enabled: boolean) {
  return {
    flex: 1,
    height: 52,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.15)",
    background: "white",
    opacity: enabled ? 1 : 0.4,
  };
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
  function format(seconds: number) {
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
        <button onClick={playerState.paused ? onPlay : onPause}>
          {playerState.paused ? "Play" : "Pause"}
        </button>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {format(playerState.currentTime)} / {format(playerState.duration)}
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(1, playerState.duration)}
          value={Math.min(playerState.currentTime, playerState.duration)}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>

      <div style={{ borderRadius: 16, border: "1px solid rgba(0,0,0,0.15)", padding: 14 }}>
        {text}
      </div>
    </div>
  );
}

function AutoGallery({ images, seconds }: { images: string[]; seconds: number }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(0);
  }, [images]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setI((v) => (v + 1) % images.length);
    }, seconds * 1000);
    return () => window.clearInterval(id);
  }, [images, seconds]);

  return (
    <div style={{ height: 260, overflow: "hidden" }}>
      <img
        src={images[i]}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
