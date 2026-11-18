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

/** Map icons (src/lib/icons.ts): a skull for a death, a skull over crossed bones for a kill. */
export type MarkerShape = 'skullBones' | 'skull' | 'diamond' | 'storm';

export const EVENT_STYLE: Record<EventType, { label: string; color: string; shape: MarkerShape; size: number }> = {
  killBot: { label: 'Player killed a bot', color: '#ff4d6d', shape: 'skullBones', size: 6 },
  killPlayer: { label: 'Player killed a player', color: '#ff0a54', shape: 'skullBones', size: 8 },
  diedToBot: { label: 'Player killed by a bot', color: '#f1f1f1', shape: 'skull', size: 7 },
  diedToPlayer: { label: 'Player killed by a player', color: '#ff0a54', shape: 'skull', size: 8 },
  storm: { label: 'Player died to the storm', color: '#b388ff', shape: 'storm', size: 8 },
  loot: { label: 'Player looted an item', color: '#ffd166', shape: 'diamond', size: 5 },
  botKill: { label: 'Bot killed someone', color: '#f4a261', shape: 'skullBones', size: 4.5 },
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
  power: { label: 'Power positions', hint: 'kills per minute spent, 1x to 4x the map average: spots that win fights', rgb: [255, 110, 199] },
  raised: { label: 'Raised kills', hint: 'kills made 3 m or more above the ground: rooftops, towers, ledges', rgb: [77, 163, 255] },
  fire: { label: 'Line of fire', hint: 'arrow from killer to victim: 36 recorded fights, 6 inferred (lighter)', rgb: [255, 140, 66] },
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

/**
 * What each row means, in plain words: shown as a tooltip on hover (legend and heatmap). Written for a level
 * designer who has never seen the data.
 */
export const EXPLAIN: Record<string, string> = {
  // Legend
  humanPath: 'Where the player walked. One line per player, drawn up to the current time of the replay.',
  botPath: 'Where a bot walked (dashed). Bots are only recorded in 52 of the 796 matches.',
  killBot: 'A player killed a bot here. The cross is where the player stood when shooting, not where the bot fell.',
  killPlayer: 'A player killed another player here (where the shooter stood). Only 3 in the whole data.',
  diedToBot: 'A player was killed by a bot here: where the player fell.',
  diedToPlayer: 'A player was killed by another player here: where the player fell. Only 3 in the whole data.',
  storm: 'A player died to the storm here. The storm only kills after minute 10.9 of a match.',
  loot: 'A player picked up an item here.',
  botKill: 'A bot killed someone here (where the bot stood). Only when the bot itself was recorded.',
  botDeath: 'A bot died here. Only when the bot itself was recorded.',
  fights:
    'An arrow from the killer to the victim: who shot whom, and from where. Only for the 42 fights where both are in the data (36 recorded, 6 inferred, drawn lighter); most kills do not say who the victim was. Short arrows: most fights are close (about 9 m).',
  // Heatmap
  traffic: 'Where players spend time. The game records where each player is every ~5 s: brighter = more time spent there. Shows busy routes and ignored areas.',
  heatLoot: 'Where items are picked up. Brighter = more pickups.',
  power:
    'Spots that win fights. For each area: kills made there divided by the time players spend there, compared with the map average. Light = as good as average, bright pink = 4x better or more. Good positions to fight from: check each one can be reached and contested from several routes. Today nearly all kills are against bots.',
  raised: 'Kills made from 3 m or more above the ground around them: rooftops, towers, ledges. Overwatch and sniping spots.',
  fire: 'The same arrows as "Killer to victim" in the legend: who shot whom, from where. 42 fights only: most kills do not record the victim.',
  kills: 'Where players stand when they kill. Bots / Players / Both: who the victim was.',
  deaths: 'Where players die to bots or to other players (the storm has its own row). Bots / Players / Both: who killed them.',
  heatStorm: 'Where the storm catches players.',
};
