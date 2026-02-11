"use client";

import { useEffect, useRef } from "react";

export type EngineTrack = {
  id: string;
  title: string;
  audioSrc: string;
};

type PlayerState = {
  currentTime: number;
  duration: number;
  paused: boolean;
};

export default function AudioEngine({
  track,
  onTimeUpdate,
  requestPlay,
  requestPause,
  requestSeekTo,
}: {
  track: EngineTrack | null;
  onTimeUpdate: (s: PlayerState) => void;
  requestPlay: number;
  requestPause: number;
  requestSeekTo: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // guardamos o src “real” em blob URL
  const objectUrlRef = useRef<string | null>(null);

  // ✅ garante que estados/seek não “vazem” entre tracks
  const currentTrackIdRef = useRef<string>("");

  // ✅ se o seek chegar antes do loadedmetadata, guardamos aqui
  const pendingSeekRef = useRef<number | null>(null);
  const pendingSeekTrackIdRef = useRef<string>("");

  // estado interno para UI / debug
  const lastTimeRef = useRef(0);
  const wasPlayingRef = useRef(false);

  function cleanupObjectUrl() {
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {}
      objectUrlRef.current = null;
    }
  }

  function emitState() {
    const audio = audioRef.current;
    if (!audio) return;

    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const paused = audio.paused;

    lastTimeRef.current = currentTime;
    wasPlayingRef.current = !paused;

    onTimeUpdate({ currentTime, duration, paused });
  }

  function applyPendingSeekIfAny() {
    const audio = audioRef.current;
    if (!audio) return;

    // só aplica se o seek foi pedido para o track atual
    if (
      pendingSeekRef.current !== null &&
      pendingSeekTrackIdRef.current &&
      pendingSeekTrackIdRef.current === currentTrackIdRef.current
    ) {
      try {
        audio.currentTime = Math.max(0, pendingSeekRef.current);
      } catch {}

      pendingSeekRef.current = null;
      pendingSeekTrackIdRef.current = "";
    }
  }

  async function loadTrackAsBlob(next: EngineTrack) {
    const audio = audioRef.current;
    if (!audio) return;

    // ✅ marca track atual (antes de mexer em src)
    currentTrackIdRef.current = next.id;

    // ✅ trava qualquer seek pendente antigo (de outro track)
    if (pendingSeekTrackIdRef.current && pendingSeekTrackIdRef.current !== next.id) {
      pendingSeekRef.current = null;
      pendingSeekTrackIdRef.current = "";
    }

    // pausa enquanto troca a fonte
    try {
      audio.pause();
    } catch {}

    // ✅ zera imediatamente para não “carregar tempo antigo” na UI
    try {
      audio.currentTime = 0;
    } catch {}

    // limpa blob anterior
    cleanupObjectUrl();

    // baixa o arquivo inteiro (passa pelo SW/cache)
    const res = await fetch(next.audioSrc, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Falha ao carregar áudio: ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    audio.src = url;
    audio.load();
  }

  // Quando track muda: carrega como blob (imune a rede)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!track) return;

      try {
        await loadTrackAsBlob(track);
        if (cancelled) return;

        // Emite estado (duration etc.). Mantém pausado por padrão.
        emitState();
      } catch (e) {
        console.error("AudioEngine: erro ao carregar blob:", e);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  // Eventos do elemento de áudio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => emitState();

    const onLoaded = () => {
      // ✅ agora é seguro aplicar seek do track atual
      applyPendingSeekIfAny();
      emitState();
    };

    const onPlay = () => emitState();
    const onPause = () => emitState();
    const onEnded = () => emitState();

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play signal
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!track) return;

    audio
      .play()
      .then(() => {
        wasPlayingRef.current = true;
        emitState();
      })
      .catch((e) => {
        console.warn("AudioEngine: play() bloqueado/erro:", e);
        emitState();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestPlay]);

  // Pause signal
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.pause();
    } catch {}
    wasPlayingRef.current = false;
    emitState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestPause]);

  // Seek signal
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (requestSeekTo === null) return;
    if (!track) return;

    // ✅ guarda o seek para o track atual; se metadata já chegou, aplica na hora
    pendingSeekRef.current = Math.max(0, requestSeekTo);
    pendingSeekTrackIdRef.current = track.id;

    try {
      audio.currentTime = Math.max(0, requestSeekTo);
    } catch {
      // se falhar agora, vai ser aplicado no loadedmetadata
    }

    emitState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestSeekTo]);

  // cleanup ao desmontar
  useEffect(() => {
    return () => {
      cleanupObjectUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <audio ref={audioRef} preload="auto" playsInline />;
}