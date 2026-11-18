import { describe, expect, it } from 'vitest';
import { heatOf, legendOf } from './links';

describe('legend <-> heatmap links', () => {
  it('pairs the rows that show the same events', () => {
    expect(heatOf('killBot')).toBe('kills');
    expect(heatOf('diedToPlayer')).toBe('deaths');
    expect(heatOf('humanPath')).toBeNull();
    expect(legendOf('deaths')).toEqual(['diedToBot', 'diedToPlayer']);
    expect(legendOf('fire')).toEqual(['fights']);
    expect(legendOf('traffic')).toEqual([]);
  });
});
