// The data pipeline in the browser: the same steps as pipeline/build.py, so a dropped dataset becomes exactly the
// structures the app reads (index, matches, heat grids, terrain). Pure functions: the Web Worker feeds them rows.
// Keep in step with pipeline/build.py (and _Claude/DATA.md for the reasons behind each rule).
import type { EventType, Fight, HeatData, Index, MapConfig, MapId, Match, MatchEvent, MatchSummary, Player, Terrain } from './types';

/** One parquet row, decoded. `sec` is the ts column's number (typed ms, but it counts seconds). */
export interface RawRow {
  user: string;
  match: string;
  map: string;
  x: number;
  y: number;
  z: number;
  sec: number;
  event: string;
  day: string; // YYYY-MM-DD, from the file's folder
}

export interface Dataset {
  index: Index;
  matches: Record<string, Match>;
  heat: Partial<Record<MapId, HeatData>>;
  terrain: Partial<Record<MapId, Terrain>>;
}

export const MAPS: Record<MapId, { scale: number; originX: number; originZ: number }> = {
  AmbroseValley: { scale: 900, originX: -370, originZ: -473 },
  GrandRift: { scale: 581, originX: -290, originZ: -290 },
  Lockdown: { scale: 1000, originX: -500, originZ: -500 },
};

export const UV_UNITS = 10_000;
const HEAT_GRID = 128;
const TERRAIN_GRID = 96;
const TERRAIN_LOW = 0.1;
const RAISED_METERS = 3;
const PAIR_WITHIN_MS = 1000;
const PAIR_MAX_METERS = 60;
const INFER_MAX_METERS = 40;
const INFER_PATH_END_MS = 10_000;
const BOT_ID = /^\d+$/;
const POSITION = new Set(['Position', 'BotPosition']);

const CATEGORY: Record<string, EventType> = {
  'h:Kill': 'killPlayer',
  'h:BotKill': 'killBot',
  'h:Killed': 'diedToPlayer',
  'h:BotKilled': 'diedToBot',
  'h:KilledByStorm': 'storm',
  'h:Loot': 'loot',
  'b:BotKill': 'botKill',
  'b:BotKilled': 'botDeath',
};

const HEAT_OF: Partial<Record<EventType, string>> = {
  loot: 'loot',
  killBot: 'killsBot',
  killPlayer: 'killsPlayer',
  diedToBot: 'deathsBot',
  diedToPlayer: 'deathsPlayer',
  storm: 'storm',
};
const HEAT_LAYERS = ['traffic', 'loot', 'killsBot', 'killsPlayer', 'deathsBot', 'deathsPlayer', 'storm', 'killsRaised'];

export const isMap = (m: string): m is MapId => m in MAPS;

/** Python's round(): exact halves go to the even neighbor (JavaScript's Math.round sends them up). Same output as
 * pipeline/build.py, value for value. */
export function pyRound(x: number): number {
  const r = Math.round(x);
  return Math.abs(x - Math.trunc(x)) === 0.5 ? 2 * Math.round(x / 2) : r;
}

/** World (x, z) to map UV x UV_UNITS, rounded. */
export function toUv(map: MapId, x: number, z: number): [number, number] {
  const m = MAPS[map];
  return [pyRound(((x - m.originX) / m.scale) * UV_UNITS), pyRound(((z - m.originZ) / m.scale) * UV_UNITS)];
}

const height = (y: number) => pyRound(y * 10);

/** Bot or human per user: BotPosition = bot, Position = human, the id only when there is no movement. */
export function classifyBots(rows: RawRow[]): Map<string, boolean> {
  const moves = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!moves.has(r.user)) moves.set(r.user, new Set());
    moves.get(r.user)!.add(r.event);
  }
  const out = new Map<string, boolean>();
  for (const [user, ev] of moves) out.set(user, ev.has('BotPosition') ? true : ev.has('Position') ? false : BOT_ID.test(user));
  return out;
}

function heatCell(u: number, v: number, grid: number): number {
  const col = Math.min(grid - 1, Math.max(0, Math.floor((u * grid) / UV_UNITS)));
  const row = Math.min(grid - 1, Math.max(0, Math.floor(((UV_UNITS - v) * grid) / UV_UNITS)));
  return row * grid + col;
}

/** Ground height per cell (meters): 10th percentile of heights seen there, gaps flood-filled, 2 smoothing passes. */
export function buildTerrain(points: { u: number; v: number; y: number }[], g = TERRAIN_GRID): number[] | null {
  const cells = new Map<number, number[]>();
  for (const p of points) {
    const c = heatCell(p.u, p.v, g);
    if (!cells.has(c)) cells.set(c, []);
    cells.get(c)!.push(p.y);
  }
  if (!cells.size) return null;
  let h = new Array<number>(g * g).fill(0);
  const filled = new Array<boolean>(g * g).fill(false);
  for (const [c, ys] of cells) {
    ys.sort((a, b) => a - b);
    h[c] = ys[Math.floor(TERRAIN_LOW * (ys.length - 1))];
    filled[c] = true;
  }
  const near = (i: number) => {
    const r = Math.floor(i / g);
    const c = i % g;
    return [r ? i - g : -1, r < g - 1 ? i + g : -1, c ? i - 1 : -1, c < g - 1 ? i + 1 : -1].filter((j) => j >= 0);
  };
  let ring = [...cells.keys()];
  while (ring.length) {
    const next: number[] = [];
    for (const i of ring) for (const j of near(i)) if (!filled[j]) (filled[j] = true), next.push(j);
    const done = new Set(next);
    for (const j of next) {
      const ns = near(j).filter((k) => filled[k] && !done.has(k));
      h[j] = ns.reduce((a, k) => a + h[k], 0) / ns.length;
    }
    ring = next;
  }
  for (let pass = 0; pass < 2; pass++) {
    const out = h.slice();
    for (let i = 0; i < g * g; i++) {
      const r = Math.floor(i / g);
      const c = i % g;
      let sum = 0;
      let n = 0;
      for (let rr = r - 1; rr <= r + 1; rr++) for (let cc = c - 1; cc <= c + 1; cc++) if (rr >= 0 && rr < g && cc >= 0 && cc < g) (sum += h[rr * g + cc]), n++;
      out[i] = sum / n;
    }
    h = out;
  }
  return h;
}

/** Kill-death pairs recorded on both sides: same second, within 60 m, never a player with themself. */
export function pairFights(events: MatchEvent[], scale: number): Fight[] {
  const fights: Fight[] = [];
  const maxUv = (PAIR_MAX_METERS / scale) * UV_UNITS;
  for (const [killCat, deathCat] of [['killBot', 'botDeath'], ['botKill', 'diedToBot'], ['killPlayer', 'diedToPlayer']] as const) {
    const deaths = events.filter((e) => e[1] === deathCat);
    const used = new Set<number>();
    for (const [t, cat, u, v, killer, h] of events) {
      if (cat !== killCat) continue;
      let best = -1;
      let bestDt = Infinity;
      deaths.forEach((d, i) => {
        const dt = Math.abs(d[0] - t);
        if (!used.has(i) && d[4] !== killer && dt <= PAIR_WITHIN_MS && Math.hypot(d[2] - u, d[3] - v) <= maxUv && dt < bestDt) (best = i), (bestDt = dt);
      });
      if (best < 0) continue;
      used.add(best);
      const d = deaths[best];
      fights.push([t, u, v, d[2], d[3], killer, d[4], h, d[5], 0]);
    }
  }
  return fights;
}

/** Pairs deduced from bot paths (flagged inferred): a bot alive near a death to a bot, a bot path ending at a kill. */
export function inferFights(events: MatchEvent[], players: Player[], scale: number, recorded: Fight[]): Fight[] {
  const bots = players.map((p, i) => ({ p, i })).filter(({ p }) => p.bot && p.path.length >= 3);
  if (!bots.length) return [];
  const maxUv = (INFER_MAX_METERS / scale) * UV_UNITS;
  const done = new Set([...recorded.map((f) => `${f[0]}|${f[5]}`), ...recorded.map((f) => `${f[0]}|${f[6]}`)]);
  const out: Fight[] = [];
  for (const [t, cat, u, v, who, h] of events) {
    if (players[who].bot || done.has(`${t}|${who}`) || (cat !== 'diedToBot' && cat !== 'killBot')) continue;
    let best: [number, number, number, number, number] | null = null;
    for (const { p, i } of bots) {
      const ts = p.path.filter((_, k) => k % 3 === 0);
      if (cat === 'diedToBot' && !(ts[0] - 5000 <= t && t <= ts[ts.length - 1] + 5000)) continue;
      if (cat === 'killBot' && Math.abs(ts[ts.length - 1] - t) > INFER_PATH_END_MS) continue;
      let k = ts.length - 1;
      if (cat === 'diedToBot') {
        k = 0;
        for (let q = 1; q < ts.length; q++) if (Math.abs(ts[q] - t) < Math.abs(ts[k] - t)) k = q;
      }
      const bu = p.path[k * 3 + 1];
      const bv = p.path[k * 3 + 2];
      const d = Math.hypot(bu - u, bv - v);
      if (d <= maxUv && (!best || d < best[0])) best = [d, i, bu, bv, p.h[k]];
    }
    if (!best) continue;
    const [, bi, bu, bv, bh] = best;
    out.push(cat === 'diedToBot' ? [t, bu, bv, u, v, bi, who, bh, h, 1] : [t, u, v, bu, bv, who, bi, h, bh, 1]);
  }
  return out;
}

export interface BuildReport {
  rows: number;
  skippedRows: number; // unknown map or event
  unknownMaps: string[];
}

/** All rows (already de-duplicated by file) to the app's dataset. */
export function buildDataset(all: RawRow[]): { dataset: Dataset; report: BuildReport } {
  const unknownMaps = new Set<string>();
  let skipped = 0;
  const byMatch = new Map<string, RawRow[]>();
  for (const r of all) {
    if (!isMap(r.map)) {
      unknownMaps.add(r.map);
      skipped++;
      continue;
    }
    if (!byMatch.has(r.match)) byMatch.set(r.match, []);
    byMatch.get(r.match)!.push(r);
  }

  // Terrain first: "raised kills" are judged against the ground.
  const ground: Partial<Record<MapId, number[]>> = {};
  const terrain: Partial<Record<MapId, Terrain>> = {};
  const range: Partial<Record<MapId, { hMin: number; hMax: number }>> = {};
  for (const map of Object.keys(MAPS) as MapId[]) {
    const rows = all.filter((r) => r.map === map);
    if (!rows.length) continue;
    const pts = rows.map((r) => {
      const [u, v] = toUv(map, r.x, r.z);
      return { u, v, y: r.y };
    });
    const t = buildTerrain(pts);
    if (t) {
      ground[map] = t;
      const known = new Set(pts.map((p) => heatCell(p.u, p.v, TERRAIN_GRID))).size / (TERRAIN_GRID * TERRAIN_GRID);
      terrain[map] = { grid: TERRAIN_GRID, h: t.map((x) => Math.round(x * 10)), known: Math.round(known * 1000) / 1000 };
    }
    const ys = rows.map((r) => r.y).sort((a, b) => a - b);
    const pick = (q: number) => Math.round(ys[Math.floor(q * (ys.length - 1))] * 10) / 10;
    range[map] = { hMin: pick(0.01), hMax: pick(0.99) };
  }

  const heatAcc: Partial<Record<MapId, Record<string, Map<string, Map<number, number>>>>> = {};
  const add = (map: MapId, layer: string, day: string, cell: number) => {
    const m = (heatAcc[map] ??= Object.fromEntries(HEAT_LAYERS.map((l) => [l, new Map()])));
    const d = m[layer].get(day) ?? new Map<number, number>();
    d.set(cell, (d.get(cell) ?? 0) + 1);
    m[layer].set(day, d);
  };
  const fightsByMap: Partial<Record<MapId, HeatData['fights']>> = {};
  const matches: Record<string, Match> = {};
  const summaries: MatchSummary[] = [];
  const humanMatches = new Map<string, number>();

  for (const [matchId, rowsUnsorted] of [...byMatch.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const rows = rowsUnsorted.sort((a, b) => a.sec - b.sec || (a.user < b.user ? -1 : a.user > b.user ? 1 : 0));
    const map = rows[0].map as MapId;
    const day = rows.map((r) => r.day).sort()[0];
    const t0 = rows[0].sec;
    const bots = classifyBots(rows);
    const players: Player[] = [];
    const indexOf = new Map<string, number>();
    const events: MatchEvent[] = [];
    const counts: Partial<Record<EventType, number>> = {};
    for (const r of rows) {
      let i = indexOf.get(r.user);
      if (i === undefined) {
        i = players.length;
        indexOf.set(r.user, i);
        players.push({ id: r.user, bot: bots.get(r.user)!, path: [], h: [] });
      }
      const p = players[i];
      const [u, v] = toUv(map, r.x, r.z);
      const t = (r.sec - t0) * 1000;
      if (POSITION.has(r.event)) {
        p.path.push(t, u, v);
        p.h.push(height(r.y));
        if (!p.bot) add(map, 'traffic', day, heatCell(u, v, HEAT_GRID));
        continue;
      }
      const cat = CATEGORY[`${p.bot ? 'b' : 'h'}:${r.event}`];
      if (!cat) {
        skipped++;
        continue;
      }
      counts[cat] = (counts[cat] ?? 0) + 1;
      events.push([t, cat, u, v, i, height(r.y)]);
      const layer = HEAT_OF[cat];
      if (layer) add(map, layer, day, heatCell(u, v, HEAT_GRID));
      const g = ground[map];
      if ((cat === 'killBot' || cat === 'killPlayer') && g && r.y - g[heatCell(u, v, TERRAIN_GRID)] > RAISED_METERS) add(map, 'killsRaised', day, heatCell(u, v, HEAT_GRID));
    }
    const scale = MAPS[map].scale;
    const recorded = pairFights(events, scale);
    const fights = [...recorded, ...inferFights(events, players, scale, recorded)].sort((a, b) => a[0] - b[0]);
    for (const f of fights) (fightsByMap[map] ??= []).push([day, f[1], f[2], f[3], f[4], players[f[5]].bot, f[7], f[8], f[9]]);
    const id = matchId.replace(/\.nakama-0$/, '');
    matches[id] = { id, map, day, players, events, fights };
    for (const p of players) if (!p.bot) humanMatches.set(p.id, (humanMatches.get(p.id) ?? 0) + 1);
    summaries.push({
      id, map, day,
      durationMs: (rows[rows.length - 1].sec - t0) * 1000,
      humans: players.filter((p) => !p.bot).length,
      bots: players.filter((p) => p.bot).length,
      rows: rows.length,
      fights: fights.length,
      onlyMatch: false,
      events: Object.fromEntries(Object.entries(counts).sort()) as MatchSummary['events'],
    });
  }
  for (const s of summaries) s.onlyMatch = matches[s.id].players.some((p) => !p.bot && humanMatches.get(p.id) === 1);

  const heat: Partial<Record<MapId, HeatData>> = {};
  for (const map of Object.keys(heatAcc) as MapId[]) {
    const layers: HeatData['layers'] = {};
    for (const [layer, days] of Object.entries(heatAcc[map]!))
      layers[layer] = Object.fromEntries(
        [...days.entries()].sort().map(([d, cells]) => [d, [...cells.entries()].sort((a, b) => a[0] - b[0]).flat()]),
      );
    heat[map] = { grid: HEAT_GRID, layers, fights: (fightsByMap[map] ?? []).sort() };
  }

  const maps: MapConfig[] = (Object.keys(MAPS) as MapId[]).map((id) => ({ id, ...MAPS[id], hMin: range[id]?.hMin ?? 0, hMax: range[id]?.hMax ?? 1 }));
  const index: Index = {
    maps,
    days: [...new Set(summaries.map((s) => s.day))].sort(),
    uvUnits: UV_UNITS,
    matches: summaries.sort((a, b) => (a.day + a.map + a.id < b.day + b.map + b.id ? -1 : 1)),
    totals: { rows: summaries.reduce((n, s) => n + s.rows, 0), humans: humanMatches.size, bots: new Set(Object.values(matches).flatMap((m) => m.players.filter((p) => p.bot).map((p) => p.id))).size },
  };
  return { dataset: { index, matches, heat, terrain }, report: { rows: all.length, skippedRows: skipped, unknownMaps: [...unknownMaps] } };
}

/** A folder name like "February_10" to "2026-02-10" (the dataset's year); anything else to a stable placeholder. */
export function dayOfFolder(path: string): string {
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  for (const part of path.split('/').reverse()) {
    const m = /^([A-Za-z]+)_(\d{1,2})$/.exec(part);
    const mi = m ? months.indexOf(m[1].toLowerCase()) : -1;
    if (m && mi >= 0) return `2026-${String(mi + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return '2026-01-01';
}
