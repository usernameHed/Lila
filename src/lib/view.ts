// The view (what is on screen) lives in the URL hash, so a Level Designer can share exactly what they see.
import type { HeatLayer, MapId, Who } from './types';

export type Mode = 'overview' | 'replay' | 'heat';

export interface View {
  mode: Mode;
  map: MapId;
  day: string; // 'all' or YYYY-MM-DD
  /** Matches replayed together. ALL = every match of the current map and day (kept short in the URL). */
  matches: string[] | typeof ALL;
  /** Heatmap kinds shown together, at least one. */
  layers: HeatLayer[];
  /** Kills and deaths: against bots, players or both. */
  kills: Who;
  deaths: Who;
  /** One color for everything (heatmap kinds, or replayed matches) instead of one color each. */
  mono: boolean;
  /** Replay: every match, or only matches of players who never played again. */
  players: 'all' | 'once';
  /** Replay: legend rows turned off (event types, or 'fights' for the killer-to-victim lines). */
  hidden: string[];
  /** Replay: draw the chosen heatmap kinds under the replay. */
  heatUnder: boolean;
  /** Replay: 3D view (height from the data's y) instead of the flat map. */
  view3d: boolean;
  /** Replay: color paths by player (or match) or by height. */
  colorBy: 'player' | 'height';
  /** 3D: vertical exaggeration (1-8). */
  exaggeration: number;
  /** 3D: ground shaped by the terrain estimated from paths, or flat. */
  terrain: boolean;
}

export const ALL = 'all';

export const DEFAULT_VIEW: View = { mode: 'overview', map: 'AmbroseValley', day: 'all', matches: [], layers: ['traffic'], kills: 'both', deaths: 'both', mono: false, players: 'all', hidden: [], heatUnder: false, view3d: false, colorBy: 'player', exaggeration: 4, terrain: true };

const MAPS: MapId[] = ['AmbroseValley', 'GrandRift', 'Lockdown'];
const LAYERS: HeatLayer[] = ['traffic', 'loot', 'fire', 'kills', 'deaths', 'storm']; // drawing order
const WHO: Who[] = ['both', 'bots', 'players'];

/** Read a view from a hash like "#mode=heat&map=Lockdown&layer=kills". Unknown values fall back to defaults. */
export function parseView(hash: string): View {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T =>
    allowed.includes(q.get(key) as T) ? (q.get(key) as T) : fallback;
  const day = q.get('day');
  return {
    mode: pick<Mode>('mode', ['overview', 'replay', 'heat'], DEFAULT_VIEW.mode),
    map: pick('map', MAPS, DEFAULT_VIEW.map),
    day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : 'all',
    matches: parseMatches(q.get('match')),
    layers: parseLayers(q.get('layer')),
    kills: pick('kills', WHO, 'both'),
    deaths: pick('deaths', WHO, 'both'),
    mono: q.get('mono') === '1',
    players: pick<View['players']>('players', ['all', 'once'], 'all'),
    hidden: (q.get('hide') ?? '').split(',').filter((k) => /^[a-zA-Z]{2,20}$/.test(k)),
    heatUnder: q.get('under') === '1',
    view3d: q.get('view') === '3d',
    colorBy: pick<View['colorBy']>('color', ['player', 'height'], 'player'),
    terrain: q.get('ground') !== 'flat',
    exaggeration: Math.min(8, Math.max(1, Math.round(Number(q.get('ex')) || DEFAULT_VIEW.exaggeration))),
  };
}

/** "kills,traffic" -> known kinds in drawing order, defaults when none. */
function parseLayers(raw: string | null): HeatLayer[] {
  const asked = new Set((raw ?? '').split(','));
  const layers = LAYERS.filter((l) => asked.has(l));
  return layers.length ? layers : DEFAULT_VIEW.layers;
}

/** Show or hide one heatmap kind; the last one shown stays (an empty map would say nothing). */
export function toggleLayer(current: HeatLayer[], layer: HeatLayer): HeatLayer[] {
  if (!current.includes(layer)) return LAYERS.filter((l) => l === layer || current.includes(l));
  return current.length > 1 ? current.filter((l) => l !== layer) : current;
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
  if (v.mode === 'heat') {
    q.set('layer', v.layers.join(','));
    if (v.kills !== 'both' && v.layers.includes('kills')) q.set('kills', v.kills);
    if (v.deaths !== 'both' && v.layers.includes('deaths')) q.set('deaths', v.deaths);
  }
  if (v.mono) q.set('mono', '1');
  if (v.mode === 'replay' && v.players === 'once') q.set('players', 'once');
  if (v.mode === 'replay' && v.hidden.length) q.set('hide', v.hidden.join(','));
  if (v.mode === 'replay' && v.view3d) q.set('view', '3d');
  if (v.mode === 'replay' && v.view3d && v.exaggeration !== DEFAULT_VIEW.exaggeration) q.set('ex', String(v.exaggeration));
  if (v.mode === 'replay' && v.colorBy === 'height') q.set('color', 'height');
  if (v.mode === 'replay' && v.view3d && !v.terrain) q.set('ground', 'flat');
  if (v.mode === 'replay' && v.heatUnder) {
    q.set('under', '1');
    q.set('layer', v.layers.join(','));
  }
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

/** Legend row clicked: only that kind is shown; clicked again while alone: everything comes back. */
export function legendOnly(hidden: string[], k: string, all: readonly string[]): string[] {
  const alone = all.every((x) => (x === k) !== hidden.includes(x));
  return alone ? [] : all.filter((x) => x !== k);
}

/** Legend box clicked: show or hide that kind. */
export const legendToggle = (hidden: string[], k: string): string[] => (hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k]);
