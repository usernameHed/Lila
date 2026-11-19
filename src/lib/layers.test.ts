import { describe, expect, it } from 'vitest';
import { LAYER_ROWS, allHeat, heatOn, toggleHeat } from './layers';

const row = (id: string) => LAYER_ROWS.find((r) => r.id === id)!;
const off = { layers: ['traffic' as const], kills: 'both' as const, deaths: 'both' as const, heatUnder: false };

describe('one layer list for icons and heatmaps', () => {
  it('reads a heatmap as off while the heatmap is off, whatever kinds are remembered', () => {
    expect(heatOn(off, row('humanPath'))).toBe(false);
    expect(heatOn({ ...off, heatUnder: true }, row('humanPath'))).toBe(true);
  });

  it('turns a plain kind on and off, and the heatmap with it', () => {
    const on = toggleHeat(off, row('loot'));
    expect(on).toEqual({ layers: ['loot'], heatUnder: true });
    expect(toggleHeat({ ...off, ...on } as typeof off, row('loot'))).toEqual({ layers: [], heatUnder: false });
  });

  it('splits kills by side: one row per side, both rows on = both', () => {
    const bots = { ...off, ...toggleHeat(off, row('killBot')) } as typeof off;
    expect(bots.layers).toEqual(['kills']);
    expect(bots.kills).toBe('bots');
    expect(heatOn(bots, row('killPlayer'))).toBe(false);
    const both = { ...bots, ...toggleHeat(bots, row('killPlayer')) } as typeof off;
    expect(both.kills).toBe('both');
    const players = { ...both, ...toggleHeat(both, row('killBot')) } as typeof off;
    expect(players.kills).toBe('players');
    expect(players.layers).toEqual(['kills']);
    const none = { ...players, ...toggleHeat(players, row('killPlayer')) } as typeof off;
    expect(none.layers).toEqual([]);
    expect(none.heatUnder).toBe(false);
  });

  it('has rows with no heatmap (bot paths) and heat-only analysis rows', () => {
    expect(toggleHeat(off, row('botPath'))).toEqual({});
    expect(row('power').icons).toBeNull();
    expect(allHeat(false)).toEqual({ layers: [], heatUnder: false });
  });
});
