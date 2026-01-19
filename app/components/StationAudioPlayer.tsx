"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Track = {
  id: string;       // id da estação
  title: string;    // título
  audioSrc: string; // caminho do mp3
};

export default function StationAudioPlayer({ track }: { track: Track | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // memória: guarda "em que segundo parei" por estação
  const [positions, setPositions] = useState<Record<string, number>>({});

  const [isPlaying, setIsPlaying] = useState(false);

  // posição salva da estação atual (se não tiver, é 0)
  const savedPos = useMemo(() => {
    if (!track) return 0;
    return positions[track.id] ?? 0;
  }, [track, positions]);

  // Sempre que mudar de estação:
  // 1) para o áudio
  // 2) salva a posição da estação anterior
  // 3) troca o arquivo
  // 4) carrega
  // 5) volta para a posição salva dessa estação
  // (não dá play sozinho)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    if (!track) {
      a.pause();
      a.removeAttribute("src");
      a.load();
      setIsPlaying(false);
      return;
    }

    // para e troca o áudio
    a.pause();
    setIsPlaying(false);

    a.src = track.audioSrc;
    a.load();

    const onLoaded = () => {
      try {
        a.currentTime = savedPos;
      } catch {}
    };

    a.addEventListener("loadedmetadata", onLoaded);

    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);

      // salva posição ao sair da estação
      const currentTime = a.currentTime || 0;
      setPositions((prev) => ({ ...prev, [track.id]: currentTime }));
    };
  }, [track?.id, track?.audioSrc, savedPos]);

  // mantém estado play/pause
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);

    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  function togglePlay() {
    const a = audioRef.current;
    if (!a || !track) return;

    if (a.paused) a.play().catch(() => {});
    else a.pause();
  }

  function seek(delta: number) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, (a.currentTime || 0) + delta);
  }

  // CONTROLES NA TELA BLOQUEADA (Media Session)
  useEffect(() => {
    if (!track) return;

    // @ts-ignore
    const ms: MediaSession | undefined = navigator.mediaSession;
    if (!ms) return;

    ms.metadata = new MediaMetadata({
      title: track.title,
      artist: "Jornada",
      album: "Jornada",
    });

    ms.setActionHandler("play", () => {
      const a = audioRef.current;
      if (!a) return;
      a.play().catch(() => {});
    });

    ms.setActionHandler("pause", () => {
      const a = audioRef.current;
      if (!a) return;
      a.pause();
    });

    ms.setActionHandler("seekbackward", () => seek(-10));
    ms.setActionHandler("seekforward", () => seek(10));
  }, [track]);

  return (
    <div
      style={{
        position: "sticky",
        bottom: 0,
        left: 0,
        right: 0,
        padding: 12,
        borderTop: "1px solid rgba(0,0,0,0.12)",
        background: "white",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75 }}>
        {track ? "Áudio da estação" : "—"}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <button
          onClick={() => seek(-10)}
          disabled={!track}
          style={{
            height: 44,
            padding: "0 12px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            opacity: track ? 1 : 0.4,
          }}
        >
          -10s
        </button>

        <button
          onClick={togglePlay}
          disabled={!track}
          style={{
            height: 44,
            padding: "0 14px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            opacity: track ? 1 : 0.4,
            fontWeight: 600,
          }}
        >
          {isPlaying ? "Pausar" : "Play"}
        </button>

        <button
          onClick={() => seek(10)}
          disabled={!track}
          style={{
            height: 44,
            padding: "0 12px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            opacity: track ? 1 : 0.4,
          }}
        >
          +10s
        </button>

        <div style={{ fontSize: 14, fontWeight: 600, marginLeft: 6 }}>
          {track ? track.title : "Selecione uma estação"}
        </div>
      </div>

      <audio ref={audioRef} preload="auto" playsInline />
    </div>
  );
}