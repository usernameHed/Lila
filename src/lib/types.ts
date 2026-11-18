// Shapes of the static JSON written by pipeline/build.py.

export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown';

export type EventType = 'Kill' | 'Killed' | 'BotKill' | 'BotKilled' | 'KilledByStorm' | 'Loot';

export interface MapConfig {
  id: MapId;
  scale: number;
  originX: number;
  originZ: number;
}

export interface MatchSummary {
  id: string;
  map: MapId;
  day: string; // YYYY-MM-DD, from the data's day folder
  durationMs: number;
  humans: number;
  bots: number;
  rows: number;
  events: Partial<Record<EventType, number>>;
}

export interface Index {
  maps: MapConfig[];
  days: string[];
  uvUnits: number; // u and v below are in [0, uvUnits]
  matches: MatchSummary[];
}

export interface Player {
  id: string;
  bot: boolean;
  path: number[]; // flat triples: t (ms since match start), u, v
}

/** [t (ms), type, u, v, index of the player in Match.players] */
export type MatchEvent = [number, EventType, number, number, number];

export interface Match {
  id: string;
  map: MapId;
  day: string;
  players: Player[];
  events: MatchEvent[];
}
