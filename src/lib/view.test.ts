import { describe, expect, it } from 'vitest';
import { ALL, DEFAULT_VIEW, legendOnly, legendToggle, parseView, resolveSelection, toggleLayer, toggleMatch, viewHash, type View } from './view';

describe('view in the URL', () => {
  it('round-trips a view', () => {
    const v = { mode: 'heat', map: 'Lockdown', day: '2026-02-12', matches: [], layers: ['kills', 'storm'], kills: 'bots', deaths: 'both', mono: true, players: 'all', hidden: [], heatUnder: false, view3d: false, colorBy: 'player', exaggeration: 4, terrain: true } as View;
    expect(parseView(viewHash(v))).toEqual(v);
    const r: View = { ...DEFAULT_VIEW, mode: 'replay', matches: ['abc-123', 'def-456'], players: 'once', hidden: ['loot', 'fights'], heatUnder: true, layers: ['traffic', 'kills'], view3d: true, colorBy: 'height', exaggeration: 6, terrain: false };
    expect(parseView(viewHash(r))).toEqual(r);
    const all: View = { ...DEFAULT_VIEW, mode: 'replay', matches: ALL };
    expect(viewHash(all)).toContain('match=all');
    expect(parseView(viewHash(all))).toEqual(all);
  });

  it('falls back to defaults on junk', () => {
    expect(parseView('#mode=x&map=Nowhere&day=yesterday&layer=lava')).toEqual(DEFAULT_VIEW);
    expect(parseView('')).toEqual(DEFAULT_VIEW);
    expect(parseView('#match=a,a,<script>,b').matches).toEqual(['a', 'b']);
  });
});

describe('match selection', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('resolves all, chosen ones in chosen order, or the first', () => {
    expect(resolveSelection(ALL, list)).toEqual(list);
    expect(resolveSelection(['c', 'x', 'a'], list).map((m) => m.id)).toEqual(['c', 'a']);
    expect(resolveSelection(['x'], list).map((m) => m.id)).toEqual(['a']);
    expect(resolveSelection([], [])).toEqual([]);
  });
  it('toggles, never down to nothing', () => {
    expect(toggleMatch(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleMatch(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleMatch(['a'], 'a')).toEqual(['a']);
  });
});

describe('heatmap kinds', () => {
  it('reads old single-kind links and keeps drawing order', () => {
    expect(parseView('#mode=heat&layer=storm').layers).toEqual(['storm']);
    expect(parseView('#mode=heat&layer=storm,traffic,lava').layers).toEqual(['traffic', 'storm']);
  });
  it('toggles kinds in drawing order, never down to none', () => {
    expect(toggleLayer(['kills'], 'traffic')).toEqual(['traffic', 'kills']);
    expect(toggleLayer(['traffic', 'kills'], 'traffic')).toEqual(['kills']);
    expect(toggleLayer(['kills'], 'kills')).toEqual(['kills']);
  });
});

describe('legend clicks', () => {
  const all = ['a', 'b', 'c'];
  it('shows one kind alone, then everything again', () => {
    expect(legendOnly([], 'b', all)).toEqual(['a', 'c']);
    expect(legendOnly(['a', 'c'], 'b', all)).toEqual([]);
    expect(legendOnly(['a'], 'b', all)).toEqual(['a', 'c']);
  });
  it('toggles one kind', () => {
    expect(legendToggle([], 'a')).toEqual(['a']);
    expect(legendToggle(['a', 'b'], 'a')).toEqual(['b']);
  });
});
