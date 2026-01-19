// app/lib/appEvents.ts
// Um “mensageiro” simples entre componentes (sem complicação).
// Serve para avisar: "pause o áudio agora".

export function pauseAudioNow() {
  window.dispatchEvent(new Event("JORNADA_PAUSE_AUDIO"));
}

export function onPauseAudioNow(callback: () => void) {
  const handler = () => callback();
  window.addEventListener("JORNADA_PAUSE_AUDIO", handler);
  return () => window.removeEventListener("JORNADA_PAUSE_AUDIO", handler);
}