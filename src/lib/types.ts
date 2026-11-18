// Shapes of the static JSON written by pipeline/build.py.

export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown';

/** Event categories from the emitter's point of view (see pipeline/build.py CATEGORY and _Claude/DATA.md). */
export type EventType =
  | 'killPlayer'
  | 'killBot'
  | 'diedToPlayer'
  | 'diedToBot'
  | 'storm'
  | 'loot'
  | 'botKill'
  | 'botDeath';

/** Heatmap kinds as the app shows them. */
export type HeatLayer = 'traffic' | 'loot' | 'fire' | 'kills' | 'deaths' | 'storm';

/** Who the other side of a kill or death was. */
export type Who = 'both' | 'bots' | 'players';

export interface HeatData {
  grid: number; // cells per side, row 0 at the top of the image
  // pipeline layer (traffic, loot, killsBot, killsPlayer, deathsBot, deathsPlayer, storm, fire)
  // -> day -> flat [cell, count, cell, count, ...]
  layers: Record<string, Record<string, number[]>>;
  /** Killer-to-victim lines of this map: [day, killer u, killer v, victim u, victim v, killer is a bot]. */
  fights: [string, number, number, number, number, boolean, number, number][];
}

/** A kill whose victim's death is also recorded: [t, killer u, v, victim u, v, killer, victim, killer h, victim h]. */
export type Fight = [number, number, number, number, number, number, number, number, number];

export interface MapConfig {
  id: MapId;
  scale: number;
  originX: number;
  originZ: number;
  hMin: number; // height range in meters (1st-99th percentile): height colors, 3D view
  hMax: number;
}

export interface MatchSummary {
  id: string;
  map: MapId;
  day: string; // YYYY-MM-DD, from the data's day folder
  durationMs: number;
  humans: number;
  bots: number;
  rows: number;
  fights: number; // kills whose victim's death is also recorded (see Fight)
  onlyMatch: boolean; // a human in it never played another match in the 5 days
  events: Partial<Record<EventType, number>>;
}


export interface Player {
  id: string;
  bot: boolean;
  path: number[]; // flat triples: t (ms since match start), u, v
  h: number[]; // height of each path sample, in decimeters
}

/** [t (ms), type, u, v, index of the player in Match.players, height (dm)] */
export type MatchEvent = [number, EventType, number, number, number, number];

export interface Match {
  id: string;
  map: MapId;
  day: string;
  players: Player[];
  events: MatchEvent[];
  fights: Fight[];
}

/** Estimated ground height, from where players and bots walked (pipeline write_terrain). */
export interface Terrain {
  grid: number; // cells per side, row 0 at the top of the image
  h: number[]; // decimeters
  known: number; // share of cells with real samples (the rest is filled from neighbors)
}

export interface Index {
  maps: MapConfig[];
  days: string[];
  uvUnits: number;
  matches: MatchSummary[];
  totals: { rows: number; humans: number; bots: number };
}
