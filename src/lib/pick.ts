// Which player a click on the map means: the nearest path (drawn up to time t) or current position.
import { positionAt, samplesUntil } from './timeline';
import type { Match, MatchEvent } from './types';

export interface Focus {
  match: string; // match id
  player: number; // index in match.players
}

/** Distance from point p to segment ab (all in UV units). */
export function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const k = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + k * dx), py - (ay + k * dy));
}

/** The nearest player within `tolerance` of (u, v), humans first on a tie; null if nothing is close enough. */
export function pickPlayer(matches: Match[], t: number, u: number, v: number, tolerance: number): Focus | null {
  let best: { d: number; focus: Focus; bot: boolean } | null = null;
  for (const m of matches)
    m.players.forEach((p, i) => {
      const n = samplesUntil(p.path, t);
      let d = Infinity;
      for (let s = 1; s < n; s++) {
        const j = s * 3;
        d = Math.min(d, segmentDistance(u, v, p.path[j - 2], p.path[j - 1], p.path[j + 1], p.path[j + 2]));
      }
      const head = positionAt(p.path, t);
      if (head) d = Math.min(d, Math.hypot(u - head.u, v - head.v));
      if (n === 1) d = Math.min(d, Math.hypot(u - p.path[1], v - p.path[2]));
      const better = !best || d < best.d - 1e-9 || (Math.abs(d - best.d) < 1e-9 && best.bot && !p.bot);
      if (d <= tolerance && better) best = { d, focus: { match: m.id, player: i }, bot: p.bot };
    });
  return best ? (best as { focus: Focus }).focus : null;
}

/** An event pointed at on the map, in the timeline or in the details card. */
export interface PointedEvent {
  match: string;
  event: MatchEvent; // the event object itself, as loaded (identity is stable)
}

/** The nearest event marker within `tolerance` of (u, v), among those shown at time t and not hidden. */
export function pickEvent(matches: Match[], t: number, u: number, v: number, tolerance: number, hidden: ReadonlySet<string>): PointedEvent | null {
  let best: { d: number; p: PointedEvent } | null = null;
  for (const m of matches)
    for (const e of m.events) {
      if (e[0] > t || hidden.has(e[1])) continue;
      const d = Math.hypot(u - e[2], v - e[3]);
      if (d <= tolerance && (!best || d < best.d)) best = { d, p: { match: m.id, event: e } };
    }
  return best?.p ?? null;
}
