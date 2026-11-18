import { describe, expect, it } from 'vitest';
import { isolines } from './contours';

describe('isolines', () => {
  it('traces a closed ring around a peak, at the interpolated crossing', () => {
    const n = 5;
    const f = new Float32Array(n * n);
    f[2 * n + 2] = 1; // a single peak in the middle
    const segs = isolines(f, n, 0.5);
    expect(segs.length).toBe(4 * 4); // 4 segments around the peak
    // Every point sits halfway between the peak (cell center 2.5/5) and its neighbors (1.5/5 or 3.5/5).
    for (let i = 0; i < segs.length; i += 2) {
      const dx = Math.abs(segs[i] - 0.5);
      const dy = Math.abs(segs[i + 1] - 0.5);
      expect(Math.max(dx, dy)).toBeCloseTo(0.1); // half a cell = 0.1 of the map
    }
  });

  it('draws nothing on a flat field', () => {
    expect(isolines(new Float32Array(16).fill(0.7), 4, 0.5)).toEqual([]);
  });
});
