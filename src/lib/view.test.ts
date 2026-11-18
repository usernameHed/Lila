import { describe, expect, it } from 'vitest';
import { DEFAULT_VIEW, parseView, viewHash } from './view';

describe('view in the URL', () => {
  it('round-trips a view', () => {
    const v = { mode: 'heat', map: 'Lockdown', day: '2026-02-12', match: null, layer: 'kills' } as const;
    expect(parseView(viewHash(v))).toEqual(v);
    const r = { ...DEFAULT_VIEW, match: 'abc-123' };
    expect(parseView(viewHash(r))).toEqual(r);
  });

  it('falls back to defaults on junk', () => {
    expect(parseView('#mode=x&map=Nowhere&day=yesterday&layer=lava')).toEqual(DEFAULT_VIEW);
    expect(parseView('')).toEqual(DEFAULT_VIEW);
  });
});
