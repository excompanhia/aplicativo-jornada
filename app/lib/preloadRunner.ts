/**
 * Faz preload progressivo de assets (áudio/imagem)
 * - baixa 1 por vez
 * - passa pelo Service Worker
 * - não lança erro fatal
 * - AGORA: informa sucesso/erro por item (para permitir persistência/versionamento)
 */
export async function preloadAssets(
  urls: string[],
  options?: {
    onProgress?: (current: number, total: number, url: string) => void;
    onResult?: (url: string, ok: boolean) => void; // <-- NOVO
    delayMs?: number;
  }
) {
  const total = urls.length;
  const delayMs = options?.delayMs ?? 300;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    let ok = false;

    try {
      // fetch simples: o Service Worker intercepta
      const res = await fetch(url, { cache: "no-store" });
      ok = res.ok;
    } catch (err) {
      console.warn("Erro ao fazer preload de", url, err);
      ok = false;
      // não interrompe o processo
    }

    // NOVO: avisa se deu certo ou não
    options?.onResult?.(url, ok);

    // callback de progresso (se existir)
    options?.onProgress?.(i + 1, total, url);

    // pequeno respiro entre downloads
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
