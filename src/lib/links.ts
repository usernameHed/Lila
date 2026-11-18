// The same data seen from two panels: a legend row (markers on the replay) and a heatmap kind (the aggregate).
import type { LegendKey } from './draw';
import type { HeatLayer } from './types';

const TO_HEAT: Partial<Record<LegendKey, HeatLayer>> = {
  killBot: 'kills',
  killPlayer: 'kills',
  diedToBot: 'deaths',
  diedToPlayer: 'deaths',
  storm: 'storm',
  loot: 'loot',
  fights: 'fire',
};

/** The heatmap kind showing the same events as a legend row, if any. */
export const heatOf = (k: LegendKey): HeatLayer | null => TO_HEAT[k] ?? null;

/** The legend rows showing the same events as a heatmap kind. */
export const legendOf = (h: HeatLayer): LegendKey[] => (Object.keys(TO_HEAT) as LegendKey[]).filter((k) => TO_HEAT[k] === h);
