// Heatmaps: per-day grids from the pipeline, summed over the chosen days, smoothed, then colored.

/** Sum the sparse per-day grids ([cell, count, ...]) of the given days into one dense grid. */
export function sumDays(byDay: Record<string, number[]>, days: string[], grid: number): Float32Array {
  const out = new Float32Array(grid * grid);
  for (const day of days) {
    const cells = byDay[day];
    if (!cells) continue;
    for (let i = 0; i < cells.length; i += 2) out[cells[i]] += cells[i + 1];
  }
  return out;
}

/** Separable blur with a small binomial kernel, so a single event reads as a soft spot, not a hard square. */
export function blur(src: Float32Array, grid: number, radius = 2): Float32Array {
  const kernel = binomial(radius * 2);
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < grid; y++)
    for (let x = 0; x < grid; x++) {
      let s = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < grid) s += src[y * grid + xx] * kernel[k + radius];
      }
      tmp[y * grid + x] = s;
    }
  for (let y = 0; y < grid; y++)
    for (let x = 0; x < grid; x++) {
      let s = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < grid) s += tmp[yy * grid + x] * kernel[k + radius];
      }
      out[y * grid + x] = s;
    }
  return out;
}

function binomial(n: number): number[] {
  const row = [1];
  for (let i = 0; i < n; i++) row.push((row[i] * (n - i)) / (i + 1));
  const total = 2 ** n;
  return row.map((c) => c / total);
}

/**
 * Value at the given quantile of the non-zero cells: the top of the color scale. Using the 98th percentile
 * instead of the max keeps one extreme hot spot from washing out every other area.
 */
export function scaleTop(values: Float32Array, q = 0.98): number {
  const nz = Array.from(values).filter((v) => v > 0).sort((a, b) => a - b);
  if (!nz.length) return 0;
  return nz[Math.min(nz.length - 1, Math.floor(q * nz.length))];
}

// Transparent -> deep purple -> red -> orange -> pale yellow: reads on both dark and colorful minimaps.
const STOPS: [number, number, number, number, number][] = [
  [0, 20, 0, 60, 0],
  [0.2, 90, 20, 140, 150],
  [0.5, 220, 40, 60, 200],
  [0.8, 255, 150, 30, 225],
  [1, 255, 245, 180, 240],
];

export function colorAt(k: number): [number, number, number, number] {
  const x = Math.max(0, Math.min(1, k));
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, ...c1] = STOPS[i];
    const [p0, ...c0] = STOPS[i - 1];
    if (x <= p1) {
      const f = (x - p0) / (p1 - p0);
      return c0.map((c, j) => Math.round(c + (c1[j] - c) * f)) as [number, number, number, number];
    }
  }
  return STOPS[STOPS.length - 1].slice(1) as [number, number, number, number];
}

/** RGBA pixels (grid x grid) for the grid, with a square-root scale so quieter areas stay visible. */
export function toPixels(values: Float32Array, grid: number): Uint8ClampedArray<ArrayBuffer> {
  const top = scaleTop(values);
  const px = new Uint8ClampedArray(new ArrayBuffer(grid * grid * 4));
  if (!top) return px;
  const floor = top * 0.01;
  for (let i = 0; i < values.length; i++) {
    if (values[i] <= floor) continue;
    const c = colorAt(Math.sqrt(values[i] / top));
    px.set(c, i * 4);
  }
  return px;
}
