import type { EventType, MapId } from './types';

// One place for labels and colors, shared by the canvas and the legend.

export const MAP_LABEL: Record<MapId, string> = {
  AmbroseValley: 'Ambrose Valley',
  GrandRift: 'Grand Rift',
  Lockdown: 'Lockdown',
};

export const PATH_COLOR = { human: '#4cc9f0', bot: '#f4a261' };

export type MarkerShape = 'cross' | 'skull' | 'diamond' | 'storm';

export const EVENT_STYLE: Record<EventType, { label: string; color: string; shape: MarkerShape }> = {
  Kill: { label: 'Killed a player', color: '#ff4d6d', shape: 'cross' },
  BotKill: { label: 'Killed a bot', color: '#ff8fa3', shape: 'cross' },
  Killed: { label: 'Killed by a player', color: '#ffffff', shape: 'skull' },
  BotKilled: { label: 'Killed by a bot', color: '#c9c9c9', shape: 'skull' },
  KilledByStorm: { label: 'Died to the storm', color: '#b388ff', shape: 'storm' },
  Loot: { label: 'Looted an item', color: '#ffd166', shape: 'diamond' },
};

export function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
