import { describe, expect, it } from 'vitest';
import { viewshed, visibleShare } from './viewshed';
import type { Terrain } from './types';

// A 20 x 20 flat map at 0 m with a 30 m wall along column 12 (rows 0-19).
const g = 20;
const h = new Array(g * g).fill(0);
for (let r = 0; r < g; r++) h[r * g + 12] = 300;
const terrain: Terrain = { grid: g, h, known: 1 };

describe('viewshed', () => {
  it('sees the flat ground on its side and not behind the wall', () => {
    // Viewer at column 5, row 10 (map 200 m wide: 10 m cells), range 250 m covers the map.
    const shed = viewshed(terrain, 200, (5.5 / g) * 10_000, (1 - 10.5 / g) * 10_000, 10_000);
    expect(shed[10 * g + 8]).toBe(1); // in front of the wall
    expect(shed[10 * g + 16]).toBe(0); // behind it
    expect(shed[10 * g + 12]).toBe(1); // the wall top itself is seen
  });

  it('leaves cells beyond the range out, and counts the visible share', () => {
    const shed = viewshed(terrain, 200, (5.5 / g) * 10_000, (1 - 10.5 / g) * 10_000, 10_000, 40);
    expect(shed[0]).toBe(-1);
    const share = visibleShare(shed);
    expect(share).toBeGreaterThan(0.9); // within 40 m of column 5 the wall is never in the way
  });
});
