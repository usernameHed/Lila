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
    expect(row('killPlayer').heat).toBeNull(); // no heatmap for the 3 player kills
    const deaths = { ...off, ...toggleHeat(off, row('diedToBot')) } as typeof off;
    const both = { ...deaths, ...toggleHeat(deaths, row('diedToPlayer')) } as typeof off;
    expect(both.deaths).toBe('both');
    const players = { ...both, ...toggleHeat(both, row('diedToBot')) } as typeof off;
    expect(players.deaths).toBe('players');
    const none = { ...players, ...toggleHeat(players, row('diedToPlayer')) } as typeof off;
    expect(none.layers).toEqual([]);
    expect(none.heatUnder).toBe(false);
  });

  it('has rows with no heatmap (bot paths) and heat-only analysis rows', () => {
    expect(toggleHeat(off, row('botPath'))).toEqual({});
    expect(row('power').icons).toBeNull();
    expect(allHeat(false)).toEqual({ layers: [], heatUnder: false });
  });
});
