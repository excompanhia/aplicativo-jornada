"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { stations } from "../lib/stations";
import { collectStationAssets } from "@/app/lib/preloadStations";
import { preloadAssets } from "@/app/lib/preloadRunner";
import AudioEngine, { EngineTrack } from "../components/AudioEngine";
import { onPauseAudioNow } from "../lib/appEvents";
import AccessGuard from "./AccessGuard";

type Direction = "left" | "right" | "none";

export default function JourneyPage() {
  // índice = qual estação está na tela
  const [index, setIndex] = useState(0);

  // swipe
  const startX = useRef<number | null>(null);
  const deltaX = useRef<number>(0);
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const current = stations[index];

  // memória por estação: onde cada áudio parou (RAM)
  const positionsRef = useRef<Record<string, number>>({});

  // estado do player
  const [playerState, setPlayerState] = useState<{
    currentTime: number;
    duration: number;
    paused: boolean;
  }>({
    currentTime: 0,
    duration: 0,
    paused: true,
  });

  // sinais para o motor executar ações
  const [playSignal, setPlaySignal] = useState(0);
  const [pauseSignal, setPauseSignal] = useState(0);
  const [seekTo, setSeekTo] = useState<number | null>(null);

  // Ao trocar de estação: salva posição anterior, pausa, aplica posição da nova
  const prevStationIdRef = useRef<string | null>(null);

  useEffect(() => {
    const nowId = current?.id ?? null;
    const prevId = prevStationIdRef.current;

    if (prevId && prevId !== nowId) {
      positionsRef.current[prevId] = playerState.currentTime;
    }

    // pausa sempre que muda de estação
    setPauseSignal((n) => n + 1);

    // aplica posição salva da estação atual
    if (nowId) {
      const pos = positionsRef.current[nowId] ?? 0;
      setSeekTo(pos);
    }

    prevStationIdRef.current = nowId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Se o aviso de 5 minutos aparecer, pausa o áudio automaticamente
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

  // track atual para o motor
  const track: EngineTrack | null = useMemo(() => {
    if (!current) return null;
    return { id: current.id, title: current.title, audioSrc: current.audioSrc };
  }, [current]);

  // limites
  const canGoPrev = index > 0;
  const canGoNext = index < stations.length - 1;

  function clampIndex(next: number) {
    if (next < 0) return 0;
    if (next > stations.length - 1) return stations.length - 1;
    return next;
  }

  function goNext() {
    setIndex((v) => clampIndex(v + 1));
  }

  function goPrev() {
    setIndex((v) => clampIndex(v - 1));
  }

  // swipe: quando encosta
  function onPointerDown(e: React.PointerEvent) {
    if (isAnimating) return;
    startX.current = e.clientX;
    deltaX.current = 0;
    setDragX(0);
  }

  // swipe: enquanto arrasta
  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null || isAnimating) return;
    const dx = e.clientX - startX.current;
    deltaX.current = dx;
    setDragX(dx);
  }

  // swipe: quando solta
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
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key === "ArrowLeft") goPrev();
      if (ev.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AccessGuard>
      <main style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Topo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/library" style={{ textDecoration: "none", fontSize: 13 }}>
            ← Biblioteca
          </Link>

          <div style={{ fontSize: 13, opacity: 0.75 }}>
            {index + 1} / {stations.length}
          </div>

          <div style={{ width: 72 }} />
        </div>

        {/* Tela da estação */}
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
            onSeek={(t: number) => setSeekTo(t)}
          />
        </div>

        {/* Botões */}
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

        <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.3, textAlign: "center" }}>
          Dica: arraste para a esquerda/direita como um story.
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
  playerState: {
    currentTime: number;
    duration: number;
    paused: boolean;
  };
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

      {total > 1 && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.45)",
            color: "white",
          }}
        >
          {i + 1}/{total}
        </div>
      )}
    </div>
  );
}