// The view (what is on screen) lives in the URL hash, so a Level Designer can share exactly what they see.
import type { Ended, Length, MatchFilter, SortBy } from './matchFilter';
import type { HeatLayer, MapId, Who } from './types';

export type Mode = 'overview' | 'replay';

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
  /** Replayed matches: one color for all instead of one per match. */
  mono: boolean;
  /** Heatmap: one color for all kinds instead of one per kind. */
  heatMono: boolean;
  /** Match list filters and order (see matchFilter.ts). */
  players: MatchFilter['players'];
  others: MatchFilter['others'];
  ended: Ended;
  length: Length;
  sort: SortBy;
  /** Legend rows turned off: event types, 'fights' (killer-to-victim lines), 'humanPath', 'botPath'. */
  hidden: string[];
  /** Draw the chosen heatmap kinds on the map (under the replay). */
  heatUnder: boolean;
  /** Replay: 3D view (height from the data's y) instead of the flat map. */
  view3d: boolean;
  /** 3D: vertical exaggeration (1-8). */
  exaggeration: number;
  /** 3D: ground shaped by the terrain estimated from paths, or flat. */
  terrain: boolean;
}

export const ALL = 'all';

export const DEFAULT_VIEW: View = { mode: 'overview', map: 'AmbroseValley', day: 'all', matches: [], layers: ['traffic'], kills: 'both', deaths: 'both', mono: false, heatMono: false, players: 'all', others: 'any', ended: 'any', length: 'any', sort: 'day', hidden: [], heatUnder: false, view3d: false, exaggeration: 4, terrain: true };

const MAPS: MapId[] = ['AmbroseValley', 'GrandRift', 'Lockdown'];
const LAYERS: HeatLayer[] = ['traffic', 'loot', 'power', 'raised', 'fire', 'kills', 'deaths', 'storm']; // drawing order
const WHO: Who[] = ['both', 'bots', 'players'];

/** Read a view from a hash like "#mode=heat&map=Lockdown&layer=kills". Unknown values fall back to defaults. */
export function parseView(hash: string): View {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T =>
    allowed.includes(q.get(key) as T) ? (q.get(key) as T) : fallback;
  const day = q.get('day');
  // Old links: the Heatmaps tab is now the heatmap panel of Match replay, with paths hidden.
  const legacyHeat = q.get('mode') === 'heat';
  return {
    mode: legacyHeat ? 'replay' : pick<Mode>('mode', ['overview', 'replay'], DEFAULT_VIEW.mode),
    map: pick('map', MAPS, DEFAULT_VIEW.map),
    day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : 'all',
    matches: parseMatches(q.get('match')),
    layers: parseLayers(q.get('layer')),
    kills: pick('kills', WHO, 'both'),
    deaths: pick('deaths', WHO, 'both'),
    mono: q.get('mono') === '1',
    heatMono: q.get('hmono') === '1' || (legacyHeat && q.get('mono') === '1'),
    players: pick<View['players']>('players', ['all', 'once'], 'all'),
    others: pick<View['others']>('others', ['any', 'recorded'], 'any'),
    // Old links: "players=pvp" was the player-vs-player filter, now "ended: killed by a player".
    ended: q.get('players') === 'pvp' ? 'player' : pick<Ended>('end', ['any', 'survived', 'bot', 'storm', 'player'], 'any'),
    length: pick<Length>('len', ['any', 'short', 'mid', 'long'], 'any'),
    sort: pick<SortBy>('sort', ['day', 'longest', 'shortest', 'kills', 'loot'], 'day'),
    hidden: legacyHeat ? ['humanPath', 'botPath'] : (q.get('hide') ?? '').split(',').filter((k) => /^[a-zA-Z]{2,20}$/.test(k)),
    heatUnder: legacyHeat || q.get('under') === '1',
    view3d: q.get('view') === '3d',
    terrain: q.get('ground') !== 'flat',
    exaggeration: Math.min(8, Math.max(1, Math.round(Number(q.get('ex')) || DEFAULT_VIEW.exaggeration))),
  };
}

/** "kills,traffic" -> known kinds in drawing order, defaults when none. */
function parseLayers(raw: string | null): HeatLayer[] {
  if (raw === null) return DEFAULT_VIEW.layers;
  const asked = new Set(raw.split(','));
  return LAYERS.filter((l) => asked.has(l));
}

export const ALL_LAYERS = LAYERS;

/** Show or hide one heatmap kind (kept in drawing order). */
export function toggleLayer(current: HeatLayer[], layer: HeatLayer): HeatLayer[] {
  return current.includes(layer) ? current.filter((l) => l !== layer) : LAYERS.filter((l) => l === layer || current.includes(l));
}

function parseMatches(raw: string | null): string[] | typeof ALL {
  if (raw === ALL) return ALL;
  const ids = (raw ?? '').split(',').filter((id) => /^[\w-]{1,64}$/.test(id));
  return [...new Set(ids)];
}

/** The hash for a view, keeping only what the mode uses. */
export function viewHash(v: View): string {
  const q = new URLSearchParams({ mode: v.mode, map: v.map });
  if (v.mode !== 'replay') return `#${q}`;
  if (v.day !== 'all') q.set('day', v.day);
  if (v.matches.length) q.set('match', v.matches === ALL ? ALL : v.matches.join(','));
  if (v.mono) q.set('mono', '1');
  if (v.players !== 'all') q.set('players', v.players);
  if (v.others !== 'any') q.set('others', v.others);
  if (v.ended !== 'any') q.set('end', v.ended);
  if (v.length !== 'any') q.set('len', v.length);
  if (v.sort !== 'day') q.set('sort', v.sort);
  if (v.hidden.length) q.set('hide', v.hidden.join(','));
  if (v.view3d) q.set('view', '3d');
  if (v.view3d && v.exaggeration !== DEFAULT_VIEW.exaggeration) q.set('ex', String(v.exaggeration));
  if (v.view3d && !v.terrain) q.set('ground', 'flat');
  if (v.heatUnder) {
    q.set('under', '1');
    q.set('layer', v.layers.join(','));
    if (v.kills !== 'both' && v.layers.includes('kills')) q.set('kills', v.kills);
    if (v.deaths !== 'both' && v.layers.includes('deaths')) q.set('deaths', v.deaths);
    if (v.heatMono) q.set('hmono', '1');
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

/** Legend row clicked: show or hide that kind. */
export const legendToggle = (hidden: string[], k: string): string[] => (hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k]);

/** Tick or untick several matches at once (a whole day); never down to nothing. */
export function setMany(current: string[], ids: string[], on: boolean): string[] {
  const next = on ? [...current, ...ids.filter((id) => !current.includes(id))] : current.filter((id) => !ids.includes(id));
  return next.length ? next : current.slice(0, 1);
}
