import { describe, expect, it } from 'vitest';
import { BAND_SCALE, bandOf, blur, colorAt, normalize, render, scaleTop, strongest, sumDays, toPixels, upscale } from './heat';

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
    const px = toPixels(normalize(new Float32Array([0, 10, 0, 0])), 2, [255, 0, 0]);
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

describe('one color and toon bands', () => {
  it('normalizes each kind to 0-1 and keeps the strongest per cell', () => {
    const a = normalize(new Float32Array([0, 4, 100]));
    expect(a[0]).toBe(0);
    expect(a[2]).toBe(1);
    expect(Array.from(strongest([new Float32Array([0.2, 0.9]), new Float32Array([0.5, 0.1])]))).toEqual([
      expect.closeTo(0.5), expect.closeTo(0.9),
    ]);
  });

  it('cuts intensity into 4 flat bands, nothing under the floor', () => {
    expect([0.05, 0.2, 0.4, 0.6, 1].map(bandOf)).toEqual([0, 1, 2, 3, 4]);
  });

  it('upscales smoothly and keeps the corners', () => {
    const up = upscale(new Float32Array([0, 1, 0, 1]), 2, 4);
    expect(up.length).toBe(64);
    expect(up[0]).toBe(0);
    expect(up[7]).toBe(1);
    expect(up[2]).toBeGreaterThan(0);
    expect(up[2]).toBeLessThan(1);
  });

  it('draws bands at a higher resolution, with a dark edge around each band', () => {
    const grid = 8;
    const k = new Float32Array(grid * grid);
    k[3 * grid + 3] = 1;
    k[3 * grid + 4] = 1;
    const { pixels, size } = render(k, grid, [255, 0, 0], 'bands');
    expect(size).toBe(grid * BAND_SCALE);
    const alphas = new Set<number>();
    const reds = new Set<number>();
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3]) (alphas.add(pixels[i + 3]), reds.add(pixels[i]));
    expect(alphas.size).toBeLessThanOrEqual(5); // 4 bands + the edge: flat, no gradient
    expect(Math.min(...reds)).toBeLessThan(100); // the dark outline
  });
});
