// Contour lines (isolines) of a square scalar field, by marching squares: the band edges of the toon heatmap,
// drawn as vector paths so they stay razor sharp at any zoom.

/**
 * Segments where `field` (n x n, row 0 at the top) crosses `level`, as a flat array [x0, y0, x1, y1, ...] in
 * 0-1 map units (x right, y down). Corners are pixel centers; crossings are linearly interpolated.
 */
export function isolines(field: Float32Array, n: number, level: number): number[] {
  const out: number[] = [];
  const at = (x: number, y: number) => field[y * n + x];
  const unit = (v: number) => (v + 0.5) / n;
  for (let y = 0; y < n - 1; y++)
    for (let x = 0; x < n - 1; x++) {
      const a = at(x, y); // top-left
      const b = at(x + 1, y); // top-right
      const c = at(x + 1, y + 1); // bottom-right
      const d = at(x, y + 1); // bottom-left
      const code = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const lerp = (p: number, q: number) => (p === q ? 0.5 : (level - p) / (q - p));
      const top = () => [unit(x + lerp(a, b)), unit(y)];
      const right = () => [unit(x + 1), unit(y + lerp(b, c))];
      const bottom = () => [unit(x + lerp(d, c)), unit(y + 1)];
      const left = () => [unit(x), unit(y + lerp(a, d))];
      const seg = (p: number[], q: number[]) => out.push(p[0], p[1], q[0], q[1]);
      const center = (a + b + c + d) / 4 > level;
      switch (code) {
        case 1: case 14: seg(left(), bottom()); break;
        case 2: case 13: seg(bottom(), right()); break;
        case 3: case 12: seg(left(), right()); break;
        case 4: case 11: seg(top(), right()); break;
        case 6: case 9: seg(top(), bottom()); break;
        case 7: case 8: seg(left(), top()); break;
        case 5: // a and c low... (b, d high): saddle, resolved by the center value
          if (center) (seg(left(), top()), seg(bottom(), right()));
          else (seg(top(), right()), seg(left(), bottom()));
          break;
        case 10:
          if (center) (seg(top(), right()), seg(left(), bottom()));
          else (seg(left(), top()), seg(bottom(), right()));
          break;
      }
    }
  return out;
}

/** The segments as one Path2D in 0-1 units (scale the context to the map size before stroking). */
export function contourPath(segments: number[]): Path2D {
  const p = new Path2D();
  for (let i = 0; i < segments.length; i += 4) {
    p.moveTo(segments[i], segments[i + 1]);
    p.lineTo(segments[i + 2], segments[i + 3]);
  }
  return p;
}
