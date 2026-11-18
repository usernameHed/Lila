import { describe, expect, it } from 'vitest';
import { ALL, DEFAULT_VIEW, parseView, resolveSelection, toggleMatch, viewHash, type View } from './view';

describe('view in the URL', () => {
  it('round-trips a view', () => {
    const v = { mode: 'heat', map: 'Lockdown', day: '2026-02-12', matches: [], layer: 'kills' } as View;
    expect(parseView(viewHash(v))).toEqual(v);
    const r: View = { ...DEFAULT_VIEW, matches: ['abc-123', 'def-456'] };
    expect(parseView(viewHash(r))).toEqual(r);
    const all: View = { ...DEFAULT_VIEW, matches: ALL };
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
