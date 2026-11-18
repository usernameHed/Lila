import type { EventType, HeatLayer, MapId } from './types';

// One place for labels and colors, shared by the canvas and the legend.

export const MAP_LABEL: Record<MapId, string> = {
  AmbroseValley: 'Ambrose Valley',
  GrandRift: 'Grand Rift',
  Lockdown: 'Lockdown',
};

export const PATH_COLOR = { human: '#4cc9f0', bot: '#f4a261' };

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

export const HEAT_LAYERS: Record<HeatLayer, { label: string; hint: string }> = {
  traffic: { label: 'Traffic', hint: 'Where players spend time (position samples, humans only)' },
  kills: { label: 'Kills', hint: 'Where players kill bots and other players' },
  deaths: { label: 'Deaths', hint: 'Where players die: to bots, players or the storm' },
  storm: { label: 'Storm deaths', hint: 'Where the storm catches players' },
  loot: { label: 'Loot', hint: 'Where players pick up items' },
};

export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
