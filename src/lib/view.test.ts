import { describe, expect, it } from 'vitest';
import { ALL, DEFAULT_VIEW, NONE, legendToggle, parseView, resolveSelection, setMany, toggleLayer, toggleMatch, viewHash, type View } from './view';

describe('view in the URL', () => {
  it('round-trips a view', () => {
    const v: View = { ...DEFAULT_VIEW, mode: 'replay', map: 'Lockdown', day: '2026-02-12', layers: ['loot', 'kills'], kills: 'bots', heatUnder: true, mono: true };
    expect(parseView(viewHash(v))).toEqual(v);
    const r: View = { ...DEFAULT_VIEW, mode: 'replay', matches: ['abc-123', 'def-456'], ended: 'storm', length: 'long', sort: 'kills', hidden: ['loot', 'fights', 'botPath'], heatUnder: true, replayOn: false, iconScale: 1.4, layers: [], view3d: true, exaggeration: 6, terrain: false };
    expect(parseView(viewHash(r))).toEqual(r);
    const all: View = { ...DEFAULT_VIEW, mode: 'replay', matches: ALL };
    expect(viewHash(all)).toContain('match=all');
    expect(parseView(viewHash(all))).toEqual(all);
  });

  it('falls back to defaults on junk', () => {
    expect(parseView('#mode=x&map=Nowhere&day=yesterday&layer=lava')).toEqual({ ...DEFAULT_VIEW, layers: [] });
    expect(parseView('')).toEqual(DEFAULT_VIEW);
    expect(parseView('#match=a,a,<script>,b').matches).toEqual(['a', 'b']);
  });
});

describe('match selection', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('resolves all, chosen ones in chosen order, or the first', () => {
    expect(resolveSelection(ALL, list)).toEqual(list);
    expect(resolveSelection(ALL, list, 10).map((m) => m.id)).toEqual(list.slice(-10).map((m) => m.id));
    const big = Array.from({ length: 50 }, (_, i) => ({ id: `m${i}` }));
    const a = resolveSelection(ALL, big, 10, true, 1);
    expect(a).toHaveLength(10);
    expect(resolveSelection(ALL, big, 10, true, 1)).toEqual(a); // same seed, same draw
    expect(resolveSelection(ALL, big, 10, true, 2)).not.toEqual(a);
    expect(parseView(viewHash({ ...DEFAULT_VIEW, mode: 'replay', matches: ALL, recent: 100 })).recent).toBe(100);
    const picked = [{ match: 'abc-1', player: 0 }, { match: 'def-2', player: 3 }];
    expect(parseView(viewHash({ ...DEFAULT_VIEW, mode: 'replay', picked })).picked).toEqual(picked);
    expect(parseView(viewHash({ ...DEFAULT_VIEW, mode: 'replay', offMap: ['abc-1'] })).offMap).toEqual(['abc-1']);
    expect(resolveSelection(['c', 'x', 'a'], list).map((m) => m.id)).toEqual(['c', 'a']);
    expect(resolveSelection(['x'], list).map((m) => m.id)).toEqual(['a']);
    expect(resolveSelection([], [])).toEqual([]);
  });
  it('toggles, never down to nothing', () => {
    expect(toggleMatch(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleMatch(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleMatch(['a'], 'a')).toBe(NONE);
    expect(resolveSelection(NONE, list)).toEqual([]);
    expect(parseView(viewHash({ ...DEFAULT_VIEW, mode: 'replay', matches: NONE })).matches).toBe(NONE);
  });
});

describe('old links', () => {
  it('turns the old player-vs-player filter into "ended: killed by a player"', () => {
    expect(parseView('#mode=replay&players=pvp').ended).toBe('player');
  });
});

describe('heatmap kinds', () => {
  it('opens old Heatmaps links in the replay, heatmap on, paths hidden, drawing order kept', () => {
    const v = parseView('#mode=heat&map=Lockdown&layer=deaths,traffic,lava,storm');
    expect(v.mode).toBe('replay');
    expect(v.heatUnder).toBe(true);
    expect(v.hidden).toEqual(['humanPath', 'botPath']);
    expect(v.layers).toEqual(['traffic', 'deaths']); // unknown and removed kinds (storm, line of fire) dropped
  });
  it('toggles kinds in drawing order, down to none', () => {
    expect(toggleLayer(['kills'], 'traffic')).toEqual(['traffic', 'kills']);
    expect(toggleLayer(['traffic', 'kills'], 'traffic')).toEqual(['kills']);
    expect(toggleLayer(['kills'], 'kills')).toEqual([]);
  });
});

describe('legend clicks', () => {
  it('toggles one kind', () => {
    expect(legendToggle([], 'a')).toEqual(['a']);
    expect(legendToggle(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('setMany', () => {
  it('ticks or unticks a whole day, never down to nothing', () => {
    expect(setMany(['a'], ['b', 'c'], true)).toEqual(['a', 'b', 'c']);
    expect(setMany(['a', 'b', 'c'], ['b', 'c'], false)).toEqual(['a']);
    expect(setMany(['b'], ['b'], false)).toBe(NONE);
  });
});
