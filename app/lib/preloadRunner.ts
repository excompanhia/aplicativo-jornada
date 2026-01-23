/**
 * Faz preload progressivo de assets (áudio/imagem)
 * - baixa 1 por vez
 * - passa pelo Service Worker
 * - não lança erro fatal
 */
export async function preloadAssets(
  urls: string[],
  options?: {
    onProgress?: (current: number, total: number, url: string) => void;
    delayMs?: number;
  }
) {
  const total = urls.length;
  const delayMs = options?.delayMs ?? 300;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    try {
      // fetch simples: o Service Worker intercepta
      await fetch(url, { cache: "no-store" });
    } catch (err) {
      console.warn("Erro ao fazer preload de", url, err);
      // não interrompe o processo
    }

    // callback de progresso (se existir)
    options?.onProgress?.(i + 1, total, url);

    // pequeno respiro entre downloads
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
