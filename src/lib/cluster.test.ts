import { describe, expect, it } from 'vitest';
import { cluster, groupScale } from './cluster';

const p = (x: number, y: number, kind = 'loot') => ({ x, y, kind, item: `${kind}@${x},${y}` });

describe('cluster', () => {
  it('groups close points of the same kind, at their center', () => {
    const g = cluster([p(1, 1), p(5, 5), p(50, 50), p(3, 3, 'kill')], 20);
    const loot = g.filter((x) => x.kind === 'loot').sort((a, b) => b.items.length - a.items.length);
    expect(loot.map((x) => x.items.length)).toEqual([2, 1]);
    expect([loot[0].x, loot[0].y]).toEqual([3, 3]);
    expect(g.filter((x) => x.kind === 'kill')).toHaveLength(1); // kinds never mix
  });

  it('keeps every point apart when grouping is off', () => {
    expect(cluster([p(1, 1), p(2, 2)], 0)).toHaveLength(2);
  });

  it('grows the icon slowly with the count', () => {
    expect(groupScale(1)).toBe(1);
    expect(groupScale(100)).toBeCloseTo(2.2);
  });
});
