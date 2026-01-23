import { Station } from "./stations";

/**
 * Extrai todas as URLs (áudios + imagens) das estações
 * Remove duplicadas
 */
export function collectStationAssets(stations: Station[]): string[] {
  const urls = new Set<string>();

  for (const station of stations) {
    if (station.audioSrc) {
      urls.add(station.audioSrc);
    }

    if (Array.isArray(station.images)) {
      for (const img of station.images) {
        if (img) urls.add(img);
      }
    }
  }

  return Array.from(urls);
}
