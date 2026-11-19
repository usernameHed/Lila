import { describe, expect, it } from 'vitest';
import { BAND_SCALE, bandOf, blur, colorAt, normalize, powerGrid, render, scaleTop, sumDays, upscale } from './heat';

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

  it('leaves empty cells transparent', () => {
    const { pixels } = render(new Float32Array(16), 4, [255, 0, 0]);
    expect(pixels.every((v) => v === 0)).toBe(true);
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
  it('normalizes each kind to 0-1', () => {
    const a = normalize(new Float32Array([0, 4, 100]));
    expect(a[0]).toBe(0);
    expect(a[2]).toBe(1);
  });

  it('cuts intensity into 4 flat bands, nothing under the floor', () => {
    expect([0.05, 0.2, 0.4, 0.6, 1].map(bandOf)).toEqual([0, 1, 2, 3, 4]);
  });

  it('anti-aliases band edges: in-between colors only on a thin edge, flat bands elsewhere', () => {
    const grid = 16;
    const k = new Float32Array(grid * grid);
    for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) k[y * grid + x] = Math.max(0, 1 - Math.hypot(x - 8, y - 8) / 7);
    const { pixels } = render(k, grid, [255, 0, 0]);
    const alphas = new Map<number, number>();
    let drawn = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) (drawn++, alphas.set(pixels[i], (alphas.get(pixels[i]) ?? 0) + 1));
    const flat = [...alphas.values()].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0);
    expect(flat / drawn).toBeGreaterThan(0.6); // most pixels sit in a few flat bands...
    expect(alphas.size).toBeGreaterThan(10); // ...and the edges have intermediate values (smooth, not stair-stepped)
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
    const { pixels, size } = render(k, grid, [255, 0, 0], true);
    expect(size).toBe(grid * BAND_SCALE);
    const alphas = new Set<number>();
    const reds = new Set<number>();
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3]) (alphas.add(pixels[i + 3]), reds.add(pixels[i]));
    expect(alphas.size).toBeGreaterThan(0);
    expect(Math.min(...reds)).toBeLessThan(100); // the dark outline
  });
});

describe('powerGrid', () => {
  it('is 0 at the map average, 1 at 4x, and ignores places nobody spends time', () => {
    const grid = 16;
    const time = new Float32Array(grid * grid).fill(100);
    const kills = new Float32Array(grid * grid).fill(1);
    for (let i = 0; i < 9; i++) kills[(6 + Math.floor(i / 3)) * grid + 6 + (i % 3)] = 8; // a hot 3x3 spot
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) time[r * grid + c] = 0; // an empty corner...
    kills[2 * grid + 2] = 5; // ...with one lucky kill in it
    const p = powerGrid(kills, time, grid);
    expect(p[7 * grid + 7]).toBeGreaterThan(0.6); // the hot spot
    expect(p[14 * grid + 14]).toBe(0); // an average place
    expect(p[2 * grid + 2]).toBe(0);
  });
});
