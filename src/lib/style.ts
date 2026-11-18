import type { EventType, HeatLayer, MapId, Who } from './types';

// One place for labels and colors, shared by the canvas and the legend.

export const MAP_LABEL: Record<MapId, string> = {
  AmbroseValley: 'Ambrose Valley',
  GrandRift: 'Grand Rift',
  Lockdown: 'Lockdown',
};

export const PATH_COLOR = { human: '#4cc9f0', bot: '#f4a261' };

/** Killer-to-victim line when a player is the killer (a bot killer uses the bot color). */
export const FIRE_COLOR = '#ff8c42';

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
export const HEAT_LAYERS: Record<HeatLayer, { label: string; hint: string; rgb: [number, number, number]; split?: true }> = {
  traffic: { label: 'Traffic', hint: 'where players spend time', rgb: [61, 220, 132] },
  loot: { label: 'Loot', hint: 'where players pick up items', rgb: [255, 209, 102] },
  fire: { label: 'Line of fire', hint: 'arrow from killer to victim: 39 recorded fights, 6 inferred (lighter)', rgb: [255, 140, 66] },
  kills: { label: 'Position when killing', hint: 'where players stand when they kill', rgb: [255, 51, 85], split: true },
  deaths: { label: 'Position when killed', hint: 'where players die to bots or players', rgb: [240, 244, 255], split: true },
  storm: { label: 'Storm deaths', hint: 'where the storm catches players', rgb: [179, 136, 255] },
};

/** One-color mode, for heatmaps and for replays of several matches. */
export const MONO_RGB: [number, number, number] = [76, 201, 240];

export const WHO_LABEL: Record<Who, string> = { bots: 'Bots', players: 'Players', both: 'Both' };

export const rgbCss = ([r, g, b]: [number, number, number], a = 1) => `rgba(${r},${g},${b},${a})`;

export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Height colors: one hue (cyan), dark = low, bright = high; 8 steps so a path can be drawn in 8 strokes. */
export const HEIGHT_STEPS = 8;
export const heightColor = (k: number) => `hsl(188, 85%, ${Math.round(28 + 62 * Math.max(0, Math.min(1, k)))}%)`;
export const HEIGHT_RAMP = `linear-gradient(90deg, ${heightColor(0)}, ${heightColor(0.5)}, ${heightColor(1)})`;
