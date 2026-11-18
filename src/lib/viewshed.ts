// Line of sight over the estimated terrain: from one spot, which ground can be seen in 360 degrees.
// Terrain only: walls, buildings and cover are not in the data, so this answers "does the ground block the view",
// an upper bound on what a sniper there can see.
import type { Terrain } from './types';

export const EYE_M = 1.7; // eye height of the viewer
export const TARGET_M = 1.2; // a standing target's chest height
export const RANGE_M = 250;

/** Cell values: 1 visible, 0 hidden by the ground, -1 out of range. Row 0 is the top of the image. */
export function viewshed(t: Terrain, mapScale: number, u: number, v: number, uvUnits: number, range = RANGE_M): Int8Array {
  const g = t.grid;
  const cellM = mapScale / g;
  const h = (r: number, c: number) => t.h[Math.min(g - 1, Math.max(0, r)) * g + Math.min(g - 1, Math.max(0, c))] / 10;
  // Viewer position in fractional cells (cell centers at integer + 0.5).
  const vc = (u / uvUnits) * g;
  const vr = (1 - v / uvUnits) * g;
  const eye = h(Math.floor(vr), Math.floor(vc)) + EYE_M;
  const out = new Int8Array(g * g).fill(-1);
  const rangeCells = range / cellM;
  for (let r = 0; r < g; r++)
    for (let c = 0; c < g; c++) {
      const dr = r + 0.5 - vr;
      const dc = c + 0.5 - vc;
      const dist = Math.hypot(dr, dc);
      if (dist > rangeCells) continue;
      const target = h(r, c) + TARGET_M;
      const steps = Math.max(1, Math.ceil(dist * 2)); // half a cell per step
      let visible = true;
      for (let s = 1; s < steps; s++) {
        const k = s / steps;
        const sr = Math.floor(vr + dr * k);
        const sc = Math.floor(vc + dc * k);
        if (sr === r && sc === c) break; // reached the target's own cell: nothing left in between
        const ground = h(sr, sc);
        // The sight line's height at this point vs the ground under it.
        if (ground > eye + (target - eye) * k) {
          visible = false;
          break;
        }
      }
      out[r * g + c] = visible ? 1 : 0;
    }
  return out;
}

/** Share of in-range cells that are visible (0-1): a quick "how exposed / how commanding" number. */
export function visibleShare(shed: Int8Array): number {
  let seen = 0;
  let all = 0;
  for (const x of shed) if (x >= 0) (all++, (seen += x));
  return all ? seen / all : 0;
}
