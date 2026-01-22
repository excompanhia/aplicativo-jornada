/// <reference lib="webworker" />

import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { createPartialResponse } from "workbox-range-requests";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ✅ NÃO precachear mídia grande (áudio/imagem)
const precacheManifest = (self.__SW_MANIFEST || []).filter(
  (entry) =>
    !entry.url.startsWith("/audio/") &&
    !entry.url.startsWith("/img/")
);

precacheAndRoute(precacheManifest);

/**
 * 🎧 ÁUDIO (robusto offline)
 * Estratégia:
 * - Se o áudio ainda não estiver no cache: baixa o arquivo INTEIRO (sem Range) e salva.
 * - Se vier Range request: responde com o pedaço a partir do arquivo inteiro no cache.
 * Isso evita "toca um pouco e para" quando fica offline.
 */
registerRoute(
  ({ url }) => url.pathname.startsWith("/audio/"),
  async ({ request }) => {
    const cache = await caches.open("audio-cache");

    // 1) Garantir que existe uma cópia COMPLETA (200) no cache
    let cached = await cache.match(request.url);

    if (!cached) {
      // Faz um fetch SEM o header Range (para baixar o arquivo inteiro)
      const headers = new Headers(request.headers);
      headers.delete("range");

      const fullRequest = new Request(request.url, {
        method: "GET",
        headers,
        credentials: request.credentials,
        redirect: request.redirect,
        mode: request.mode,
      });

      const networkResponse = await fetch(fullRequest);

      // Só cacheia se veio um 200 OK completo
      if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
        await cache.put(request.url, networkResponse.clone());
        cached = await cache.match(request.url);
      } else {
        // Se não conseguiu baixar completo, devolve o que veio
        return networkResponse;
      }
    }

    // 2) Se for Range request, devolve o pedaço a partir do cache completo
    const rangeHeader = request.headers.get("range");
    if (rangeHeader && cached) {
      return createPartialResponse(request, cached);
    }

    // 3) Se não for Range, devolve o arquivo completo do cache
    return cached!;
  }
);

// 🖼️ IMAGENS — runtime cache (leve)
registerRoute(
  ({ url }) => url.pathname.startsWith("/img/"),
  new StaleWhileRevalidate({
    cacheName: "image-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 40,
        maxAgeSeconds: 60 * 60 * 24,
      }),
    ],
  })
);
