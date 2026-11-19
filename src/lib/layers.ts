// What can be drawn on the map: each kind of data as icons (or path lines) on the replay, and, for some, a heatmap
// of the whole selection. Two lists in the panel (elements, heatmaps), one row model.
import type { LegendKey } from './draw';
import type { HeatLayer, Who } from './types';
import { ALL_LAYERS, toggleLayer, type View } from './view';

export interface LayerRow {
  id: string;
  /** The replay kind it draws as icons or lines (null: heat only). */
  icons: LegendKey | null;
  /** The heatmap it draws; kills and deaths are split by the other side (`who`). */
  heat: { layer: HeatLayer; who?: Exclude<Who, 'both'> } | null;
  /** The row's name in the heatmap list. */
  heatLabel?: string;
  /** Explanation key (EXPLAIN) of its heatmap. */
  heatTip?: string;
  /** Heat-only rows computed from the others. */
  analysis?: true;
}

export const LAYER_ROWS: LayerRow[] = [
  { id: 'humanPath', icons: 'humanPath', heat: { layer: 'traffic' }, heatLabel: 'Traffic', heatTip: 'traffic' },
  { id: 'botPath', icons: 'botPath', heat: null },
  { id: 'loot', icons: 'loot', heat: { layer: 'loot' }, heatLabel: 'Loot', heatTip: 'heatLoot' },
  { id: 'killBot', icons: 'killBot', heat: { layer: 'kills', who: 'bots' }, heatLabel: 'Bot kills', heatTip: 'kills' },
  { id: 'killPlayer', icons: 'killPlayer', heat: null },
  { id: 'diedToBot', icons: 'diedToBot', heat: { layer: 'deaths', who: 'bots' }, heatLabel: 'Deaths by bot', heatTip: 'deaths' },
  { id: 'diedToPlayer', icons: 'diedToPlayer', heat: { layer: 'deaths', who: 'players' }, heatLabel: 'Deaths by player', heatTip: 'deaths' },
  { id: 'storm', icons: 'storm', heat: null },
  { id: 'fights', icons: 'fights', heat: null },
  { id: 'botKill', icons: 'botKill', heat: null },
  { id: 'botDeath', icons: 'botDeath', heat: null },
  { id: 'power', icons: null, heat: { layer: 'power' }, heatLabel: 'Power positions', heatTip: 'power', analysis: true },
  { id: 'raised', icons: null, heat: { layer: 'raised' }, heatLabel: 'Raised kills', heatTip: 'raised', analysis: true },
];

type HeatState = Pick<View, 'layers' | 'kills' | 'deaths' | 'heatUnder'>;

/** The heatmap kinds actually drawn (none while the heatmap is off). */
const drawn = (v: HeatState) => (v.heatUnder ? v.layers : []);

/** The sides shown for a split kind: kills of bots, of players, or both. */
function sides(v: HeatState, layer: 'kills' | 'deaths'): Set<Exclude<Who, 'both'>> {
  if (!drawn(v).includes(layer)) return new Set();
  const who = v[layer];
  return new Set(who === 'both' ? ['bots', 'players'] : [who]);
}

/** Whether a row's heatmap is on. */
export function heatOn(v: HeatState, row: LayerRow): boolean {
  const h = row.heat;
  if (!h) return false;
  if (h.who && (h.layer === 'kills' || h.layer === 'deaths')) return sides(v, h.layer).has(h.who);
  return drawn(v).includes(h.layer);
}

/** Turn a row's heatmap on or off: a split kind keeps the other side as it was. */
export function toggleHeat(v: HeatState, row: LayerRow): Partial<View> {
  const h = row.heat;
  if (!h) return {};
  let layers = drawn(v);
  const patch: Partial<View> = {};
  if (h.who && (h.layer === 'kills' || h.layer === 'deaths')) {
    const s = sides(v, h.layer);
    if (s.has(h.who)) s.delete(h.who);
    else s.add(h.who);
    const has = layers.includes(h.layer);
    if (!s.size) layers = has ? toggleLayer(layers, h.layer) : layers;
    else {
      if (!has) layers = toggleLayer(layers, h.layer);
      patch[h.layer] = s.size === 2 ? 'both' : [...s][0];
    }
  } else layers = toggleLayer(layers, h.layer);
  return { ...patch, layers, heatUnder: layers.length > 0 };
}

/** Every heatmap on (kills of bots, deaths of both kinds), or none. */
export const allHeat = (on: boolean): Partial<View> =>
  on ? { layers: [...ALL_LAYERS], kills: 'bots', deaths: 'both', heatUnder: true } : { layers: [], heatUnder: false };
