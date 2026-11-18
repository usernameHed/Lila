import { describe, expect, it } from 'vitest';
import { blur, colorAt, scaleTop, sumDays, toPixels } from './heat';

describe('heatmap', () => {
  it('sums only the chosen days', () => {
    const byDay = { a: [0, 2, 3, 1], b: [0, 5] };
    expect(Array.from(sumDays(byDay, ['a', 'b'], 2))).toEqual([7, 0, 0, 1]);
    expect(Array.from(sumDays(byDay, ['b', 'missing'], 2))).toEqual([5, 0, 0, 0]);
  });

  it('blurs without losing mass away from the edges', () => {
    const grid = 9;
    const src = new Float32Array(grid * grid);
    src[4 * grid + 4] = 16;
    const out = blur(src, grid, 2);
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(16);
    expect(out[4 * grid + 4]).toBeLessThan(16);
    expect(out[4 * grid + 3]).toBeGreaterThan(0);
  });

  it('caps the scale at a high quantile, ignoring zeros', () => {
    const v = new Float32Array([0, 0, ...Array.from({ length: 99 }, (_, i) => i + 1), 1000]);
    expect(scaleTop(v)).toBe(99);
    expect(scaleTop(new Float32Array(4))).toBe(0);
  });

  it('leaves empty cells transparent and colors the hottest ones', () => {
    const px = toPixels(new Float32Array([0, 10, 0, 0]), 2, [255, 0, 0]);
    expect(px[3]).toBe(0);
    expect(px[7]).toBeGreaterThan(200);
    expect(colorAt(0, [255, 0, 0])[3]).toBe(0);
  });

  it("keeps the kind's color, paler only at the hottest spots", () => {
    expect(colorAt(0.5, [61, 220, 132]).slice(0, 3)).toEqual([61, 220, 132]);
    const hot = colorAt(1, [61, 220, 132]);
    expect(hot[0]).toBeGreaterThan(61);
    expect(hot[1]).toBeGreaterThanOrEqual(220);
  });
});
