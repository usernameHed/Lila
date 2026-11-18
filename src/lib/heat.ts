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

export type Rgb = [number, number, number];

/**
 * One color per heatmap kind: transparent where nothing happens, then the kind's color getting more opaque, and
 * paler toward white at the very hottest spots, so several kinds can sit on the map together and stay apart.
 */
export function colorAt(k: number, rgb: Rgb): [number, number, number, number] {
  const x = Math.max(0, Math.min(1, k));
  const white = Math.max(0, (x - 0.75) / 0.25) * 0.45;
  const [r, g, b] = rgb.map((c) => Math.round(c + (255 - c) * white));
  return [r, g, b, x ? Math.round(20 + 215 * x * x) : 0];
}

export type Look = 'smooth' | 'bands';

/** Intensity 0-1 per cell: square-root scale up to the 98th percentile, so quieter areas stay visible. */
export function normalize(values: Float32Array): Float32Array {
  const top = scaleTop(values);
  const out = new Float32Array(values.length);
  if (!top) return out;
  for (let i = 0; i < values.length; i++) {
    const k = values[i] / top;
    out[i] = k <= 0.01 ? 0 : Math.min(1, Math.sqrt(k));
  }
  return out;
}

/** One-color mode: every kind scaled to its own range, then the strongest per cell (no kind drowns another). */
export function strongest(layers: Float32Array[]): Float32Array {
  const out = new Float32Array(layers[0]?.length ?? 0);
  for (const l of layers) for (let i = 0; i < l.length; i++) out[i] = Math.max(out[i], l[i]);
  return out;
}

/** Smooth: RGBA (grid x grid), opacity follows intensity. */
export function toPixels(k: Float32Array, grid: number, rgb: Rgb): Uint8ClampedArray<ArrayBuffer> {
  const px = new Uint8ClampedArray(new ArrayBuffer(grid * grid * 4));
  for (let i = 0; i < k.length; i++) if (k[i] > 0) px.set(colorAt(k[i], rgb), i * 4);
  return px;
}

export const BANDS = 4;
export const BAND_SCALE = 8; // bands are computed at 8x the grid (1024 px), so their edges stay smooth on screen

/** Catmull-Rom weight: a smooth curve through the grid values (bilinear shows diamond-shaped edges). */
function cubic(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

/** Bicubic upscale of a square grid by `f`, clamped to 0-1, so band edges follow smooth curves. */
export function upscale(k: Float32Array, grid: number, f: number): Float32Array {
  const n = grid * f;
  const at = (x: number, y: number) => k[Math.min(grid - 1, Math.max(0, y)) * grid + Math.min(grid - 1, Math.max(0, x))];
  const out = new Float32Array(n * n);
  const row = new Float32Array(4);
  for (let y = 0; y < n; y++) {
    const gy = Math.min(grid - 1, Math.max(0, (y + 0.5) / f - 0.5));
    const y1 = Math.floor(gy), ty = gy - y1;
    for (let x = 0; x < n; x++) {
      const gx = Math.min(grid - 1, Math.max(0, (x + 0.5) / f - 0.5));
      const x1 = Math.floor(gx), tx = gx - x1;
      for (let j = 0; j < 4; j++) {
        const yy = y1 - 1 + j;
        row[j] = cubic(at(x1 - 1, yy), at(x1, yy), at(x1 + 1, yy), at(x1 + 2, yy), tx);
      }
      out[y * n + x] = Math.min(1, Math.max(0, cubic(row[0], row[1], row[2], row[3], ty)));
    }
  }
  return out;
}

/** Intensity 0-1 to a band 0..BANDS (0 = nothing). */
export const bandOf = (k: number) => (k < 0.18 ? 0 : Math.min(BANDS, Math.ceil(k * BANDS)));

/**
 * Toon look (cel shading): a few flat bands of the kind's color instead of a gradient, each band edge drawn
 * as a dark outline. RGBA at (grid x BAND_SCALE) per side.
 */
export function toBands(k: Float32Array, grid: number, rgb: Rgb): Uint8ClampedArray<ArrayBuffer> {
  const n = grid * BAND_SCALE;
  const up = upscale(k, grid, BAND_SCALE);
  const band = new Uint8Array(n * n);
  for (let i = 0; i < up.length; i++) band[i] = bandOf(up[i]);
  const fills = Array.from({ length: BANDS + 1 }, (_, b) => (b ? colorAt(b / BANDS, rgb) : null));
  const edge: [number, number, number, number] = [...(rgb.map((c) => Math.round(c * 0.35)) as Rgb), 235];
  const px = new Uint8ClampedArray(new ArrayBuffer(n * n * 4));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const b = band[i];
      if (!b) continue;
      const lower = (j: number) => band[j] < b;
      const isEdge = (x > 0 && lower(i - 1)) || (x < n - 1 && lower(i + 1)) || (y > 0 && lower(i - n)) || (y < n - 1 && lower(i + n));
      px.set(isEdge ? edge : (fills[b] as number[]), i * 4);
    }
  return px;
}

/** The picture for one intensity grid, in the chosen look: pixels and their size per side. */
export function render(k: Float32Array, grid: number, rgb: Rgb, look: Look) {
  return look === 'bands' ? { pixels: toBands(k, grid, rgb), size: grid * BAND_SCALE } : { pixels: toPixels(k, grid, rgb), size: grid };
}
