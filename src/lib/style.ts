import type { EventType, HeatLayer, MapId } from './types';

// One place for labels and colors, shared by the canvas and the legend.

export const MAP_LABEL: Record<MapId, string> = {
  AmbroseValley: 'Ambrose Valley',
  GrandRift: 'Grand Rift',
  Lockdown: 'Lockdown',
};

export const PATH_COLOR = { human: '#4cc9f0', bot: '#f4a261' };

/** One color per match when several are replayed together (bots keep their dashed orange). */
export const MATCH_COLORS = ['#4cc9f0', '#80ed99', '#ff70a6', '#c77dff', '#ffffff', '#00f5d4', '#f9f871', '#7aa2ff', '#ff9e9e', '#b5e48c', '#e0aaff', '#9ef0ff'];

/** Above this many matches, one color for all players and no loot markers: the map stays readable. */
export const MANY_MATCHES = MATCH_COLORS.length;

export type MarkerShape = 'cross' | 'skull' | 'diamond' | 'storm';

export const EVENT_STYLE: Record<EventType, { label: string; color: string; shape: MarkerShape; size: number }> = {
  killBot: { label: 'Player killed a bot', color: '#ff4d6d', shape: 'cross', size: 6 },
  killPlayer: { label: 'Player killed a player', color: '#ff0a54', shape: 'cross', size: 8 },
  diedToBot: { label: 'Player killed by a bot', color: '#f1f1f1', shape: 'skull', size: 7 },
  diedToPlayer: { label: 'Player killed by a player', color: '#ff0a54', shape: 'skull', size: 8 },
  storm: { label: 'Player died to the storm', color: '#b388ff', shape: 'storm', size: 8 },
  loot: { label: 'Player looted an item', color: '#ffd166', shape: 'diamond', size: 3.5 },
  botKill: { label: 'Bot killed someone', color: '#f4a261', shape: 'cross', size: 4.5 },
  botDeath: { label: 'Bot died', color: '#f4a261', shape: 'skull', size: 4.5 },
};

/** Draw order: loot under everything, then bot events, then the human combat events that matter most. */
export const EVENT_LAYER: Record<EventType, number> = {
  loot: 0, botKill: 1, botDeath: 1, killBot: 2, killPlayer: 2, diedToBot: 3, diedToPlayer: 3, storm: 3,
};

/** Heatmap kinds, in drawing order (traffic at the bottom, the rarest on top), each with its own color. */
export const HEAT_LAYERS: Record<HeatLayer, { label: string; hint: string; rgb: [number, number, number] }> = {
  traffic: { label: 'Traffic', hint: 'where players spend time', rgb: [61, 220, 132] },
  loot: { label: 'Loot', hint: 'where players pick up items', rgb: [255, 209, 102] },
  kills: { label: 'Kills', hint: 'where players kill bots and players', rgb: [255, 51, 85] },
  deaths: { label: 'Deaths', hint: 'where players die, to anything', rgb: [240, 244, 255] },
  storm: { label: 'Storm deaths', hint: 'where the storm catches players', rgb: [179, 136, 255] },
};

export const rgbCss = ([r, g, b]: [number, number, number], a = 1) => `rgba(${r},${g},${b},${a})`;

export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
