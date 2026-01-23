type Manifest = Record<string, 1>; // url -> ok

const KEY_MANIFEST = "jornada:preload:manifest:v1";
const KEY_FINGERPRINT = "jornada:preload:fingerprint:v1";

function safeGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}
function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

/**
 * Fingerprint simples e estável para detectar mudança no "pacote" de assets.
 * Se a lista de URLs mudar, limpamos a memória e começamos de novo.
 */
export function fingerprintUrls(urls: string[]) {
  const s = urls.slice().sort().join("|");
  // djb2-ish (simples, suficiente aqui)
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return String(h >>> 0);
}

export function loadManifest(): Manifest {
  const raw = safeGet(KEY_MANIFEST);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") return obj as Manifest;
    return {};
  } catch {
    return {};
  }
}

export function saveManifest(manifest: Manifest) {
  safeSet(KEY_MANIFEST, JSON.stringify(manifest));
}

/**
 * Garante que a memória corresponde ao conjunto atual de assets.
 * Se a lista mudou (fingerprint diferente), limpamos a memória antiga.
 */
export function ensureManifestForUrls(urls: string[]) {
  const fp = fingerprintUrls(urls);
  const current = safeGet(KEY_FINGERPRINT);

  if (current !== fp) {
    // "versão" mudou -> limpa
    safeRemove(KEY_MANIFEST);
    safeSet(KEY_FINGERPRINT, fp);
    return { cleared: true, fingerprint: fp };
  }

  return { cleared: false, fingerprint: fp };
}

export function hasUrl(url: string) {
  const m = loadManifest();
  return m[url] === 1;
}

export function markUrlOk(url: string) {
  const m = loadManifest();
  if (m[url] === 1) return; // já marcado
  m[url] = 1;
  saveManifest(m);
}

export function filterMissingUrls(urls: string[]) {
  const m = loadManifest();
  return urls.filter((u) => m[u] !== 1);
}
