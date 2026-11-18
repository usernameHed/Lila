import { currentSource } from './sources';
import type { HeatData, Index, MapId, Match, MatchSummary, Terrain } from './types';

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

// An uploaded dataset (see sources.ts) is already in memory: the loaders read it instead of the static files.
const mem = () => currentSource().dataset;

/** The built-in dataset's index, whatever the active source (for its card in the Data tab). */
export const loadBuiltinIndex = () => getJson<Index>('/data/index.json');
export const loadIndex = () => (mem() ? Promise.resolve(mem()!.index) : getJson<Index>('/data/index.json'));
export const loadHeat = (map: MapId): Promise<HeatData> =>
  mem() ? Promise.resolve(mem()!.heat[map] ?? { grid: 128, layers: {}, fights: [] }) : getJson<HeatData>(`/data/heat/${map}.json`);
export const loadTerrain = (map: MapId): Promise<Terrain> =>
  mem() ? (mem()!.terrain[map] ? Promise.resolve(mem()!.terrain[map]!) : Promise.reject(new Error('no terrain'))) : getJson<Terrain>(`/data/terrain/${map}.json`);
export const minimapUrl = (map: string) => `/minimaps/${map}.jpg`;

const matchUrl = (id: string) => `/data/matches/${id}.json`;
const bundleUrl = (map: string, day: string) => `/data/bundles/${map}_${day}.json`;

/** Up to this many matches, fetch each one's small file; above, fetch whole map-day bundles instead. */
export const BUNDLE_ABOVE = 5;

/** Which files to fetch for these matches: never one request per match when many are asked for. */
export function planLoads(summaries: MatchSummary[]): { matches: string[]; bundles: string[] } {
  if (summaries.length <= BUNDLE_ABOVE) return { matches: summaries.map((s) => matchUrl(s.id)), bundles: [] };
  const bundles = [...new Set(summaries.map((s) => bundleUrl(s.map, s.day)))];
  return { matches: [], bundles };
}

/** The matches, in the order asked, loaded by the cheapest plan. */
export async function loadMatches(summaries: MatchSummary[]): Promise<Match[]> {
  const d = mem();
  if (d) return summaries.map((s) => d.matches[s.id]).filter((m): m is Match => !!m);
  const plan = planLoads(summaries);
  const byId = new Map<string, Match>();
  const singles = await Promise.all(plan.matches.map((u) => getJson<Match>(u)));
  for (const m of singles) byId.set(m.id, m);
  const bundles = await Promise.all(plan.bundles.map((u) => getJson<Match[]>(u)));
  for (const b of bundles) for (const m of b) byId.set(m.id, m);
  return summaries.map((s) => byId.get(s.id)).filter((m): m is Match => !!m);
}
