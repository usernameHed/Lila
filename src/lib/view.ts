// The view (what is on screen) lives in the URL hash, so a Level Designer can share exactly what they see.
import type { HeatLayer, MapId } from './types';

export type Mode = 'replay' | 'heat';

export interface View {
  mode: Mode;
  map: MapId;
  day: string; // 'all' or YYYY-MM-DD
  /** Matches replayed together. ALL = every match of the current map and day (kept short in the URL). */
  matches: string[] | typeof ALL;
  layer: HeatLayer;
}

export const ALL = 'all';

export const DEFAULT_VIEW: View = { mode: 'replay', map: 'AmbroseValley', day: 'all', matches: [], layer: 'traffic' };

const MAPS: MapId[] = ['AmbroseValley', 'GrandRift', 'Lockdown'];
const LAYERS: HeatLayer[] = ['traffic', 'kills', 'deaths', 'storm', 'loot'];

/** Read a view from a hash like "#mode=heat&map=Lockdown&layer=kills". Unknown values fall back to defaults. */
export function parseView(hash: string): View {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T =>
    allowed.includes(q.get(key) as T) ? (q.get(key) as T) : fallback;
  const day = q.get('day');
  return {
    mode: pick<Mode>('mode', ['replay', 'heat'], DEFAULT_VIEW.mode),
    map: pick('map', MAPS, DEFAULT_VIEW.map),
    day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : 'all',
    matches: parseMatches(q.get('match')),
    layer: pick('layer', LAYERS, DEFAULT_VIEW.layer),
  };
}

function parseMatches(raw: string | null): string[] | typeof ALL {
  if (raw === ALL) return ALL;
  const ids = (raw ?? '').split(',').filter((id) => /^[\w-]{1,64}$/.test(id));
  return [...new Set(ids)];
}

/** The hash for a view, keeping only what the mode uses. */
export function viewHash(v: View): string {
  const q = new URLSearchParams({ mode: v.mode, map: v.map });
  if (v.day !== 'all') q.set('day', v.day);
  if (v.mode === 'replay' && v.matches.length) q.set('match', v.matches === ALL ? ALL : v.matches.join(','));
  if (v.mode === 'heat') q.set('layer', v.layer);
  return `#${q}`;
}

/**
 * The matches to replay, as summaries of the current list: every one for ALL, else the chosen ones still in the
 * list (in the order chosen, which sets their colors), else the first match so the map is never empty.
 */
export function resolveSelection<T extends { id: string }>(chosen: View['matches'], list: T[]): T[] {
  if (chosen === ALL) return list;
  const byId = new Map(list.map((m) => [m.id, m]));
  const picked = chosen.map((id) => byId.get(id)).filter((m): m is T => !!m);
  return picked.length ? picked : list.slice(0, 1);
}

/** Tick or untick one match; the last ticked one cannot be removed (the map would go empty). */
export function toggleMatch(current: string[], id: string): string[] {
  if (!current.includes(id)) return [...current, id];
  return current.length > 1 ? current.filter((x) => x !== id) : current;
}
