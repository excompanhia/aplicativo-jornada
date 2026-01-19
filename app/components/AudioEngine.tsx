"use client";

import { useEffect, useRef } from "react";

export type EngineTrack = {
  id: string;
  title: string;
  audioSrc: string;
};

export default function AudioEngine({
  track,
  onTimeUpdate,
  requestPlay,
  requestPause,
  requestSeekTo,
}: {
  track: EngineTrack | null;
  onTimeUpdate: (payload: { currentTime: number; duration: number; paused: boolean }) => void;
  requestPlay: number;
  requestPause: number;
  requestSeekTo: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // cria o <audio> uma única vez e registra eventos
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
      // @ts-ignore
      audioRef.current.playsInline = true;
    }

    const a = audioRef.current;

    const tick = () => {
      onTimeUpdate({
        currentTime: a.currentTime || 0,
        duration: Number.isFinite(a.duration) ? a.duration : 0,
        paused: a.paused,
      });
    };

    a.addEventListener("timeupdate", tick);
    a.addEventListener("play", tick);
    a.addEventListener("pause", tick);
    a.addEventListener("loadedmetadata", tick);

    return () => {
      a.removeEventListener("timeupdate", tick);
      a.removeEventListener("play", tick);
      a.removeEventListener("pause", tick);
      a.removeEventListener("loadedmetadata", tick);
    };
  }, [onTimeUpdate]);

  // troca de estação: pausa e carrega novo áudio (sem autoplay)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    if (!track) {
      a.pause();
      a.removeAttribute("src");
      a.load();
      return;
    }

    a.pause();
    a.src = track.audioSrc;
    a.load();

    // Media Session (tela bloqueada / controles)
    // @ts-ignore
    const ms: MediaSession | undefined = navigator.mediaSession;
    if (ms) {
      ms.metadata = new MediaMetadata({
        title: track.title,
        artist: "Jornada",
        album: "Jornada",
      });

      ms.setActionHandler("play", () => a.play().catch(() => {}));
      ms.setActionHandler("pause", () => a.pause());
      ms.setActionHandler("seekbackward", () => {
        a.currentTime = Math.max(0, (a.currentTime || 0) - 10);
      });
      ms.setActionHandler("seekforward", () => {
        a.currentTime = Math.min(a.duration || 1e9, (a.currentTime || 0) + 10);
      });
    }
  }, [track?.id, track?.audioSrc, track?.title]);

  // pedidos vindos da UI
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.play().catch(() => {});
  }, [requestPlay]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
  }, [requestPause]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (requestSeekTo === null) return;
    try {
      a.currentTime = Math.max(0, requestSeekTo);
    } catch {}
  }, [requestSeekTo]);

  return null; // não aparece na tela
}

