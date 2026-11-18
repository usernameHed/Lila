// Match playback: where each player is at a given time. Paths are flat [t, u, v, t, u, v, ...], sorted by t.

/** Number of samples with time <= t (binary search). */
export function samplesUntil(path: number[], t: number): number {
  let lo = 0;
  let hi = path.length / 3;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (path[mid * 3] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Position at time t, linearly interpolated between the two samples around it (samples are ~5 s apart).
 * null before the first sample; the last sample after the end (the player is dead or extracted).
 */
export function positionAt(path: number[], t: number): { u: number; v: number } | null {
  const n = samplesUntil(path, t);
  if (n === 0) return null;
  const i = (n - 1) * 3;
  if (n * 3 >= path.length) return { u: path[i + 1], v: path[i + 2] };
  const j = i + 3;
  const span = path[j] - path[i];
  const k = span > 0 ? (t - path[i]) / span : 0;
  return { u: path[i + 1] + (path[j + 1] - path[i + 1]) * k, v: path[i + 2] + (path[j + 2] - path[i + 2]) * k };
}

/** Last moment anything happens in the match (path sample or event). */
export function matchEnd(paths: number[][], eventTimes: number[]): number {
  let end = 0;
  for (const p of paths) if (p.length) end = Math.max(end, p[p.length - 3]);
  for (const t of eventTimes) end = Math.max(end, t);
  return end;
}

/** Height (dm) at time t, interpolated like positionAt; null before the first sample. */
export function heightAt(path: number[], h: number[], t: number): number | null {
  const n = samplesUntil(path, t);
  if (n === 0) return null;
  if (n >= h.length) return h[h.length - 1];
  const i = (n - 1) * 3;
  const span = path[i + 3] - path[i];
  const k = span > 0 ? (t - path[i]) / span : 0;
  return h[n - 1] + (h[n] - h[n - 1]) * k;
}
