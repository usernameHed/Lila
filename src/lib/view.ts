// The view (what is on screen) lives in the URL hash, so a Level Designer can share exactly what they see.
import type { Ended, Game, Length, SortBy } from './matchFilter';
import type { HeatLayer, MapId, Who } from './types';

export type Mode = 'overview' | 'replay' | 'data';

export interface View {
  mode: Mode;
  map: MapId;
  day: string; // 'all' or YYYY-MM-DD
  /** Matches replayed together. ALL = every match of the current map and day; NONE = every match unticked. */
  matches: string[] | typeof ALL | typeof NONE;
  /** With ALL: only N matches of the chosen day(s), 0 = every one. */
  recent: 0 | 10 | 100;
  /** N random matches (a fixed draw, `seed`), or the last N of the data. */
  random: boolean;
  seed: number;
  /** Players picked on the map or in the "On the map" list (highlighted; the last one's card is open). */
  picked: { match: string; player: number }[];
  /** Matches unticked in the "On the map" list: hidden from the map (all shown by default). */
  offMap: string[];
  /** Heatmap kinds shown together, at least one. */
  layers: HeatLayer[];
  /** Kills and deaths: against bots, players or both. */
  kills: Who;
  deaths: Who;
  /** Replayed matches: one color for all instead of one per match. */
  mono: boolean;
  /** Match list filters and order (see matchFilter.ts). */
  ended: Ended;
  length: Length;
  game: Game;
  sort: SortBy;
  /** Legend rows turned off: event types, 'fights' (killer-to-victim lines), 'humanPath', 'botPath'. */
  hidden: string[];
  /** Draw the chosen heatmap kinds on the map (under the replay). */
  heatUnder: boolean;
  /** Draw the replay itself (paths, events, lines of fire); off = the heatmap alone. */
  replayOn: boolean;
  /** Size of the event icons on the map (1 = default). */
  iconScale: number;
  /** Group icons of the same kind closer than this many screen pixels (0 = never). */
  pathWidth: number; // path thickness factor
  pathAlpha: number; // path opacity factor
  /** Replay: 3D view (height from the data's y) instead of the flat map. */
  view3d: boolean;
  /** 3D: vertical exaggeration (1-8). */
  exaggeration: number;
  /** 3D: ground shaped by the terrain estimated from paths, or flat. */
  terrain: boolean;
}

export const ALL = 'all';
export const NONE = 'none';

export const DEFAULT_VIEW: View = { mode: 'overview', map: 'AmbroseValley', day: 'all', matches: [], recent: 0, random: true, seed: 0, picked: [], offMap: [], layers: ['traffic'], kills: 'both', deaths: 'both', mono: false, ended: 'any', length: 'any', game: 'any', sort: 'day', hidden: [], heatUnder: false, replayOn: true, iconScale: 1, pathWidth: 1.5, pathAlpha: 1.3, view3d: false, exaggeration: 4, terrain: true };

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
    mode: legacyHeat ? 'replay' : pick<Mode>('mode', ['overview', 'replay', 'data'], DEFAULT_VIEW.mode),
    map: pick('map', MAPS, DEFAULT_VIEW.map),
    day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : 'all',
    matches: parseMatches(q.get('match')),
    recent: q.get('last') === '10' ? 10 : q.get('last') === '100' ? 100 : 0,
    random: q.get('rnd') !== '0',
    seed: Math.max(0, Math.min(1e6, Math.round(Number(q.get('seed')) || 0))),
    picked: parsePicked(q.get('pick')),
    offMap: (q.get('off') ?? '').split(',').filter((id) => /^[\w-]{1,64}$/.test(id)),
    layers: parseLayers(q.get('layer')),
    kills: pick('kills', WHO, 'both'),
    deaths: pick('deaths', WHO, 'both'),
    mono: q.get('mono') === '1',
    // Old links: "players=pvp" was the player-vs-player filter, now "ended: killed by a player".
    ended: q.get('players') === 'pvp' ? 'player' : pick<Ended>('end', ['any', 'survived', 'bot', 'storm', 'player'], 'any'),
    length: pick<Length>('len', ['any', 'short', 'mid', 'long'], 'any'),
    game: pick<Game>('game', ['any', 'bots', 'player', 'multi'], 'any'),
    sort: pick<SortBy>('sort', ['day', 'longest', 'shortest', 'kills', 'loot'], 'day'),
    hidden: legacyHeat ? ['humanPath', 'botPath'] : (q.get('hide') ?? '').split(',').filter((k) => /^[a-zA-Z]{2,20}$/.test(k)),
    heatUnder: legacyHeat || q.get('under') === '1',
    replayOn: q.get('replay') !== '0',
    pathWidth: q.has('pw') ? Math.min(4, Math.max(0.5, Math.round(Number(q.get('pw')) * 10) / 10 || DEFAULT_VIEW.pathWidth)) : DEFAULT_VIEW.pathWidth,
    pathAlpha: q.has('pa') ? Math.min(7.5, Math.max(0.3, Math.round(Number(q.get('pa')) * 10) / 10 || DEFAULT_VIEW.pathAlpha)) : DEFAULT_VIEW.pathAlpha,
    iconScale: Math.min(4, Math.max(0.6, Math.round((Number(q.get('icons')) || 1) * 10) / 10)),
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

function parsePicked(raw: string | null): View['picked'] {
  return (raw ?? '')
    .split(',')
    .map((s) => /^([\w-]{1,64})\.(\d{1,3})$/.exec(s))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ match: m[1], player: Number(m[2]) }));
}

function parseMatches(raw: string | null): View['matches'] {
  if (raw === ALL) return ALL;
  if (raw === NONE) return NONE;
  const ids = (raw ?? '').split(',').filter((id) => /^[\w-]{1,64}$/.test(id));
  return [...new Set(ids)];
}

/** The hash for a view, keeping only what the mode uses. */
export function viewHash(v: View): string {
  const q = new URLSearchParams({ mode: v.mode, map: v.map });
  if (v.mode !== 'replay') return `#${q}`;
  if (v.day !== 'all') q.set('day', v.day);
  if (v.matches === ALL || v.matches === NONE) q.set('match', v.matches);
  else if (v.matches.length) q.set('match', v.matches.join(','));
  if (v.matches === ALL && v.recent) {
    q.set('last', String(v.recent));
    if (!v.random) q.set('rnd', '0');
    else if (v.seed) q.set('seed', String(v.seed));
  }
  if (v.offMap.length) q.set('off', v.offMap.join(','));
  if (v.picked.length) q.set('pick', v.picked.map((p) => `${p.match}.${p.player}`).join(','));
  if (v.mono) q.set('mono', '1');
  if (v.ended !== 'any') q.set('end', v.ended);
  if (v.length !== 'any') q.set('len', v.length);
  if (v.game !== 'any') q.set('game', v.game);
  if (v.sort !== 'day') q.set('sort', v.sort);
  if (v.hidden.length) q.set('hide', v.hidden.join(','));
  if (!v.replayOn) q.set('replay', '0');
  if (v.iconScale !== 1) q.set('icons', String(v.iconScale));
  if (v.pathWidth !== DEFAULT_VIEW.pathWidth) q.set('pw', String(v.pathWidth));
  if (v.pathAlpha !== DEFAULT_VIEW.pathAlpha) q.set('pa', String(v.pathAlpha));
  if (v.view3d) q.set('view', '3d');
  if (v.view3d && v.exaggeration !== DEFAULT_VIEW.exaggeration) q.set('ex', String(v.exaggeration));
  if (v.view3d && !v.terrain) q.set('ground', 'flat');
  if (v.heatUnder) {
    q.set('under', '1');
    q.set('layer', v.layers.join(','));
    if (v.kills !== 'both' && v.layers.includes('kills')) q.set('kills', v.kills);
    if (v.deaths !== 'both' && v.layers.includes('deaths')) q.set('deaths', v.deaths);
  }
  return `#${q}`;
}

/** A number for an id and a seed (FNV-1a): the same draw every time for the same seed. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** N matches drawn at random but reproducibly (same seed, same draw), kept in the list's order. */
export function draw<T extends { id: string }>(list: T[], n: number, seed: number): T[] {
  const keep = new Set([...list].sort((a, b) => hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`)).slice(0, n));
  return list.filter((m) => keep.has(m));
}

/**
 * The matches to replay, as summaries of the current list: every one for ALL, else the chosen ones still in the
 * list (in the order chosen, which sets their colors), else the first match (a link with no choice yet). NONE: none.
 */
export function resolveSelection<T extends { id: string }>(chosen: View['matches'], list: T[], recent: View['recent'] = 0, random = false, seed = 0): T[] {
  if (chosen === ALL) return !recent ? list : random ? draw(list, recent, seed) : list.slice(-recent);
  if (chosen === NONE) return [];
  const byId = new Map(list.map((m) => [m.id, m]));
  const picked = chosen.map((id) => byId.get(id)).filter((m): m is T => !!m);
  return picked.length ? picked : list.slice(0, 1);
}

/** Tick or untick one match; unticking the last one leaves none (NONE). */
export function toggleMatch(current: string[], id: string): string[] | typeof NONE {
  if (!current.includes(id)) return [...current, id];
  const next = current.filter((x) => x !== id);
  return next.length ? next : NONE;
}

/** Legend row clicked: show or hide that kind. */
export const legendToggle = (hidden: string[], k: string): string[] => (hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k]);

/** Tick or untick several matches at once (a whole day); unticking all leaves none (NONE). */
export function setMany(current: string[], ids: string[], on: boolean): string[] | typeof NONE {
  const next = on ? [...current, ...ids.filter((id) => !current.includes(id))] : current.filter((id) => !ids.includes(id));
  return next.length ? next : NONE;
}
