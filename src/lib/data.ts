import type { HeatData, Index, MapId, Match } from './types';

// The data never changes between deploys: each file is fetched once per page load and kept in memory.
const cache = new Map<string, Promise<unknown>>();

function getJson<T>(url: string): Promise<T> {
  let hit = cache.get(url);
  if (!hit) {
    hit = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.json();
    });
    hit.catch(() => cache.delete(url)); // a failed load can be retried
    cache.set(url, hit);
  }
  return hit as Promise<T>;
}

export const loadIndex = () => getJson<Index>('/data/index.json');
export const loadMatch = (id: string) => getJson<Match>(`/data/matches/${id}.json`);
export const loadHeat = (map: MapId) => getJson<HeatData>(`/data/heat/${map}.json`);
export const minimapUrl = (map: string) => `/minimaps/${map}.jpg`;
