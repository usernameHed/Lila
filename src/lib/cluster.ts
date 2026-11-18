// Grouping nearby icons of the same kind into one, by screen distance: zoomed out, a crowd of loot icons becomes
// one bigger icon with its count; zooming in splits it again (the grid is in screen pixels).

export interface Placed<T> {
  x: number; // screen pixels
  y: number;
  kind: string;
  item: T;
}

export interface Group<T> {
  x: number; // center of its members
  y: number;
  kind: string;
  items: T[];
}

/** Groups points of the same kind falling in the same `cell` x `cell` pixel square. cell <= 0: no grouping. */
export function cluster<T>(points: Placed<T>[], cell: number): Group<T>[] {
  if (cell <= 0) return points.map((p) => ({ x: p.x, y: p.y, kind: p.kind, items: [p.item] }));
  const groups = new Map<string, { sx: number; sy: number; kind: string; items: T[] }>();
  for (const p of points) {
    const key = `${p.kind}|${Math.floor(p.x / cell)}|${Math.floor(p.y / cell)}`;
    const g = groups.get(key);
    if (g) {
      g.sx += p.x;
      g.sy += p.y;
      g.items.push(p.item);
    } else groups.set(key, { sx: p.x, sy: p.y, kind: p.kind, items: [p.item] });
  }
  return [...groups.values()].map((g) => ({ x: g.sx / g.items.length, y: g.sy / g.items.length, kind: g.kind, items: g.items }));
}

/** Icon size factor for a group: grows slowly with its count (1 for a single icon, about 2.2 for 100). */
export const groupScale = (count: number) => 1 + Math.log10(count) * 0.6;
