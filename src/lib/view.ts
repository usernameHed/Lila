// The view (what is on screen) lives in the URL hash, so a Level Designer can share exactly what they see.
import type { HeatLayer, MapId } from './types';

export type Mode = 'replay' | 'heat';

export interface View {
  mode: Mode;
  map: MapId;
  day: string; // 'all' or YYYY-MM-DD
  match: string | null;
  layer: HeatLayer;
}

export const DEFAULT_VIEW: View = { mode: 'replay', map: 'AmbroseValley', day: 'all', match: null, layer: 'traffic' };

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
    match: q.get('match') || null,
    layer: pick('layer', LAYERS, DEFAULT_VIEW.layer),
  };
}

/** The hash for a view, keeping only what the mode uses. */
export function viewHash(v: View): string {
  const q = new URLSearchParams({ mode: v.mode, map: v.map });
  if (v.day !== 'all') q.set('day', v.day);
  if (v.mode === 'replay' && v.match) q.set('match', v.match);
  if (v.mode === 'heat') q.set('layer', v.layer);
  return `#${q}`;
}
