import { isolines } from './contours';

// Heatmaps: per-day grids from the pipeline, summed over the chosen days, blurred, then drawn as toon bands.

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

const BANDS = 4;
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
/** Where each band starts, in intensity (0-1): below the first, nothing is drawn. */
export const BAND_EDGES = [0.18, 0.25, 0.5, 0.75];

/** Intensity 0-1 to a band 0..BANDS (0 = nothing). */
export const bandOf = (k: number) => BAND_EDGES.filter((e) => k > e).length;

const EDGE_PX = 0.9; // half-width of the outline, in pixels of the band picture

/**
 * Toon look (cel shading): flat bands of the kind's color with a dark outline at each band edge, anti-aliased.
 * For every pixel, the distance to the nearest band edge is measured in pixels (value difference divided by the
 * local slope), so pixels that straddle an edge blend the two bands and the outline smoothly, like vector art.
 * RGBA at (grid x BAND_SCALE) per side.
 */
function toBands(k: Float32Array, grid: number, rgb: Rgb, outline: boolean): Uint8ClampedArray<ArrayBuffer> {
  const n = grid * BAND_SCALE;
  const up = upscale(k, grid, BAND_SCALE);
  const fills = Array.from({ length: BANDS + 1 }, (_, b) => (b ? colorAt(b / BANDS, rgb) : ([0, 0, 0, 0] as const)));
  const edge = rgb.map((c) => Math.round(c * 0.35)) as Rgb;
  const px = new Uint8ClampedArray(new ArrayBuffer(n * n * 4));
  const at = (x: number, y: number) => up[Math.min(n - 1, Math.max(0, y)) * n + Math.min(n - 1, Math.max(0, x))];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = up[y * n + x];
      if (v < BAND_EDGES[0] - 0.05) continue; // far from any band: transparent
      const slope = Math.hypot(at(x + 1, y) - at(x - 1, y), at(x, y + 1) - at(x, y - 1)) / 2 || 1e-6;
      // The nearest band edge and the signed distance to it, in pixels (> 0: on the upper side).
      let e = BAND_EDGES[0];
      for (const t of BAND_EDGES) if (Math.abs(v - t) < Math.abs(v - e)) e = t;
      const d = (v - e) / slope;
      const upper = BAND_EDGES.indexOf(e) + 1; // band on the upper side of that edge
      const cover = Math.max(0, Math.min(1, d + 0.5)); // share of the pixel on the upper side
      const lo = fills[upper - 1];
      const hi = fills[upper];
      // Fill: the two bands mixed by coverage (premultiplied, so the transparent outside blends cleanly).
      let a = lo[3] * (1 - cover) + hi[3] * cover;
      let r = (lo[0] * lo[3] * (1 - cover) + hi[0] * hi[3] * cover) / (a || 1);
      let g = (lo[1] * lo[3] * (1 - cover) + hi[1] * hi[3] * cover) / (a || 1);
      let b = (lo[2] * lo[3] * (1 - cover) + hi[2] * hi[3] * cover) / (a || 1);
      // Outline: full at the edge, fading out over EDGE_PX on each side.
      const line = outline ? Math.max(0, Math.min(1, EDGE_PX + 0.5 - Math.abs(d))) : 0;
      if (line > 0) {
        const la = 235 * line;
        const outA = la + a * (1 - line);
        r = (edge[0] * la + r * a * (1 - line)) / (outA || 1);
        g = (edge[1] * la + g * a * (1 - line)) / (outA || 1);
        b = (edge[2] * la + b * a * (1 - line)) / (outA || 1);
        a = outA;
      }
      if (a < 1) continue;
      const i = (y * n + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  return px;
}

/**
 * The fill picture for one intensity grid: toon band pixels and their size per side. With `outline`, band edges
 * get a raster outline; the app instead draws vector outlines on top (see bandEdges), sharp at any zoom.
 */
export function render(k: Float32Array, grid: number, rgb: Rgb, outline = false) {
  return { pixels: toBands(k, grid, rgb, outline), size: grid * BAND_SCALE };
}

/** The band edges as contour segments (0-1 map units), one list per edge level, traced on a 4x smoothed field. */
export function bandEdges(k: Float32Array, grid: number): number[][] {
  const f = 4;
  const up = upscale(k, grid, f);
  return BAND_EDGES.map((level) => isolines(up, grid * f, level));
}

/** The outline color of a kind: its own hue, darkened. */
export const edgeColor = (rgb: Rgb) => `rgba(${rgb.map((c) => Math.round(c * 0.3)).join(',')}, 0.95)`;

/** Power positions: how many times the map's average kill rate (kills per minute spent) a spot has. */
export const POWER_FULL = 4; // 4x the map average or more = the hottest band

/**
 * Kills per unit of time spent, per cell, as a 0-1 intensity: 0 at or below the map's average rate, 1 at
 * POWER_FULL times it. Both grids are blurred first (a spot, not a single cell), and cells where players spent
 * little time are left out: one lucky kill in an empty corner is not a strong position.
 */
export function powerGrid(kills: Float32Array, time: Float32Array, grid: number, minTime = 6): Float32Array {
  const k = blur(kills, grid, 2);
  const t = blur(time, grid, 2);
  const totalK = kills.reduce((a, b) => a + b, 0);
  const totalT = time.reduce((a, b) => a + b, 0);
  const out = new Float32Array(k.length);
  if (!totalK || !totalT) return out;
  const avg = totalK / totalT;
  for (let i = 0; i < out.length; i++) {
    if (t[i] < minTime) continue;
    out[i] = Math.max(0, Math.min(1, (k[i] / t[i] / avg - 1) / (POWER_FULL - 1)));
  }
  return out;
}
