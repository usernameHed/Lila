// Canvas drawing for the map: a match at a given time, and heatmap pixels.
import { uvToPixel } from './coords';
import { EVENT_LAYER, EVENT_STYLE, FIRE_COLOR, MANY_MATCHES, MATCH_COLORS, PATH_COLOR, type MarkerShape } from './style';
import { cluster, groupScale } from './cluster';
import { positionAt, samplesUntil } from './timeline';
import type { EventType, Match, MatchEvent } from './types';

/** How long (match time) a fresh event keeps a ring around it during playback. */
const FRESH_MS = 8000;

interface Look {
  human: string; // player path color
  faint: boolean; // many matches at once: thinner, lighter lines, no loot
  density?: number; // per-line opacity when many matches overlap (see pathDensity)
  hideHumans?: boolean;
  hideBots?: boolean;
  fade?: number; // something else is hovered: paths step back
}

/** What a legend row can point at: an event type, or the killer-to-victim lines. */
export type LegendKey = EventType | 'fights' | 'humanPath' | 'botPath';

export interface ReplayOptions {
  mono?: boolean; // one color for every match
  hidden?: ReadonlySet<LegendKey>; // legend rows turned off
  hover?: LegendKey | null; // legend row under the mouse: its markers pulse, the rest fade
  activeEvent?: MatchEvent | null; // one event pointed at (map, timeline, card): it pulses
  iconScale?: number; // size of the event icons (1 = default)
  groupPx?: number; // group icons of the same kind closer than this many screen pixels (0 = never)
  phase?: number; // animation clock (ms) for the pulse
}

/** Several matches on one clock: all start at t = 0 (each match's own clock). */
export function drawMatches(ctx: CanvasRenderingContext2D, matches: Match[], uvUnits: number, size: number, t: number, playing: boolean, o: ReplayOptions = {}) {
  const many = matches.length > MANY_MATCHES;
  const hidden = o.hidden ?? new Set<LegendKey>();
  const density = pathDensity(matches.length);
  matches.forEach((m, i) =>
    drawPaths(ctx, m, uvUnits, size, t, playing, {
      human: many || o.mono ? PATH_COLOR.human : MATCH_COLORS[i],
      faint: many,
      density,
      hideHumans: hidden.has('humanPath'),
      hideBots: hidden.has('botPath'),
      fade: o.hover && o.hover !== 'humanPath' && o.hover !== 'botPath' ? 0.35 : 1,
    }),
  );

  // Events after every path, so no marker is hidden under another match's lines.
  // Past events, plus the future ones of the hovered kind and the pointed-at event (drawn faded).
  const events = matches
    .flatMap((m) => m.events)
    .filter((e) => (e[0] <= t || e[1] === o.hover || e === o.activeEvent) && !hidden.has(e[1]));
  drawEvents(ctx, events, uvUnits, size, t, playing, (many ? 0.55 : 1) * (o.iconScale ?? 1), o);
  // Killer-to-victim lines last: short (median ~9 m), they would hide under the markers.
  if (!hidden.has('fights')) {
    const fade = o.hover && o.hover !== 'fights' ? 0.25 : 1;
    for (const m of matches)
      for (const [time, ku, kv, vu, vv, killer, , , , inferred] of m.fights ?? [])
        if (time <= t) drawFightLine(ctx, uvToPixel(ku, kv, uvUnits, size), uvToPixel(vu, vv, uvUnits, size), m.players[killer]?.bot ?? false, fade * (inferred ? 0.55 : 1), o.hover === 'fights' ? pulse(o.phase) : 0);
  }
}

/**
 * Per-line opacity for many overlapping paths, so the busiest corridor reaches the same brightness whatever the
 * number of matches (566 on Ambrose Valley or 59 on Grand Rift): if about 5% of the matches go through it,
 * n = 0.05 N lines overlap there, and 1 - (1 - a)^n = 0.9 gives a = 1 - 0.1^(1/n).
 */
export const DENSITY_SHARE = 0.05;

export function pathDensity(matchCount: number): number {
  const n = Math.max(1, DENSITY_SHARE * matchCount);
  return Math.min(0.6, 1 - Math.pow(0.1, 1 / n));
}

/** 0 -> 1 -> 0 every 900 ms: the hover pulse. */
const pulse = (phase = 0) => 0.5 - 0.5 * Math.cos((phase / 900) * Math.PI * 2);

/** The paths of one match up to time t, with each player's current position while it moves. */
function drawPaths(ctx: CanvasRenderingContext2D, match: Match, uvUnits: number, size: number, t: number, playing: boolean, look: Look) {
  const px = (u: number, v: number) => uvToPixel(u, v, uvUnits, size);

  // Bots first, so human paths stay on top.
  const players = [...match.players].sort((a, b) => Number(b.bot) - Number(a.bot));
  for (const p of players) {
    if (p.bot ? look.hideBots : look.hideHumans) continue;
    const n = samplesUntil(p.path, t);
    if (!n) continue;
    const color = p.bot ? PATH_COLOR.bot : look.human;
    ctx.beginPath();
    ctx.lineWidth = (p.bot ? 2 : 2.25) * (look.faint ? 0.5 : 1);
    ctx.strokeStyle = color;
    ctx.setLineDash(p.bot ? [6, 4] : []);
    ctx.globalAlpha = (p.bot ? 0.9 : 0.95) * (look.faint ? (look.density ?? 0.22) : 1) * (look.fade ?? 1);
    for (let i = 0; i < n * 3; i += 3) {
      const { x, y } = px(p.path[i + 1], p.path[i + 2]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const head = positionAt(p.path, t);
    if (head) {
      const { x, y } = px(head.u, head.v);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else ctx.stroke();
    ctx.globalAlpha = 1;
    if (head && (playing || t < p.path[p.path.length - 3])) {
      const { x, y } = px(head.u, head.v);
      drawHead(ctx, x, y, color, p.bot || look.faint);
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/** Event markers; `scale` shrinks them when many matches share the map; the hovered type pulses. */
function drawEvents(ctx: CanvasRenderingContext2D, all: MatchEvent[], uvUnits: number, size: number, t: number, playing: boolean, scale: number, o: ReplayOptions) {
  const px = (u: number, v: number) => uvToPixel(u, v, uvUnits, size);
  const one = (e: MatchEvent) => e === o.activeEvent;
  const lit = (e: MatchEvent) => o.hover === e[1] || one(e);
  const k = pulse(o.phase);
  const dimming = !!o.hover || !!o.activeEvent;

  // Everything not hovered: grouped by screen distance (a crowd of loot = one bigger icon with its count),
  // drawn from cached icon images. The hovered kind and the pointed-at event come after, one by one, on top.
  const plain = all.filter((e) => !lit(e)).sort((a, b) => EVENT_LAYER[a[1]] - EVENT_LAYER[b[1]]);
  const groups = cluster(
    plain.map((e) => ({ ...px(e[2], e[3]), kind: e[1], item: e })),
    o.groupPx ?? 0,
  );
  ctx.globalAlpha = dimming ? 0.2 : 1;
  for (const g of groups) {
    const type = g.kind as EventType;
    const style = EVENT_STYLE[type];
    const n = g.items.length;
    const r = style.size * scale * groupScale(n);
    if (n === 1 && playing && !dimming && type !== 'loot' && t - g.items[0][0] < FRESH_MS) {
      const age = (t - g.items[0][0]) / FRESH_MS;
      ctx.beginPath();
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - age;
      ctx.arc(g.x, g.y, r + 4 + age * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    stampMarker(ctx, style.shape, style.color, g.x, g.y, r);
    if (n >= 3 && !dimming) drawCount(ctx, g.x + r * 0.9, g.y - r * 0.9, n);
  }

  for (const e of all.filter(lit).sort((a, b) => Number(one(a)) - Number(one(b)))) {
    const [time, type, u, v] = e;
    const { x, y } = px(u, v);
    const style = EVENT_STYLE[type];
    const r = style.size * scale * (one(e) ? 1.4 : 1);
    const future = time > t;
    ctx.beginPath();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = one(e) ? 3 : 2;
    ctx.globalAlpha = (1 - k) * (future ? 0.5 : 1);
    ctx.arc(x, y, r + 3 + k * (one(e) ? 18 : 12), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = future ? 0.35 : 1; // future events (shown on hover only) are see-through
    stampMarker(ctx, style.shape, style.color, x, y, r * (1.25 + 0.25 * k));
  }
  ctx.globalAlpha = 1;
}

/** A group's count, in a small dark pill at its top-right. */
function drawCount(ctx: CanvasRenderingContext2D, x: number, y: number, n: number) {
  const text = n > 999 ? `${Math.round(n / 1000)}k` : String(n);
  ctx.save();
  ctx.font = '600 10px Inter, system-ui, sans-serif';
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = 'rgba(8,9,12,0.85)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 7, w, 14, 7);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

/**
 * Icons are drawn once per (shape, color, size) into a small image, then stamped: thousands of loot icons cost
 * one image copy each instead of a vector path (several times faster).
 */
const sprites = new Map<string, HTMLCanvasElement>();
function stampMarker(ctx: CanvasRenderingContext2D, shape: MarkerShape, color: string, x: number, y: number, r: number) {
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const q = Math.max(1, Math.round(r * 2)) / 2; // half-pixel steps: few cached sizes
  const key = `${shape}|${color}|${q}|${dpr}`;
  let img = sprites.get(key);
  const half = q * 1.6 + 4; // room for the outline
  if (!img) {
    img = document.createElement('canvas');
    img.width = img.height = Math.ceil(half * 2 * dpr);
    const c = img.getContext('2d')!;
    c.scale(dpr, dpr);
    drawMarker(c, shape, color, half, half, q);
    sprites.set(key, img);
  }
  ctx.drawImage(img, x - half, y - half, half * 2, half * 2);
}

/**
 * Killer to victim: a dashed line on a dark outline, a dot at the killer, an arrow head at the victim.
 * Orange when a player is the killer, the bot color when a bot is. `glow` (0-1) pulses it when hovered.
 */
export function drawFightLine(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, botKiller: boolean, alpha = 1, glow = 0) {
  const color = botKiller ? PATH_COLOR.bot : FIRE_COLOR;
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const head = 11;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  // Outline first, so the line reads on any part of the minimap.
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.lineWidth = 6 + glow * 6;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3 + glow * 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(a.x, a.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(b.x + Math.cos(angle) * 3, b.y + Math.sin(angle) * 3);
  ctx.lineTo(b.x - head * Math.cos(angle - 0.5), b.y - head * Math.sin(angle - 0.5));
  ctx.lineTo(b.x - head * Math.cos(angle + 0.5), b.y - head * Math.sin(angle + 0.5));
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, bot: boolean) {
  ctx.beginPath();
  ctx.arc(x, y, bot ? 3.5 : 5.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0b0c0f';
  ctx.stroke();
}

/** A heatmap picture (prepared once, see heatCanvas) stretched over the map. */
export function drawHeat(ctx: CanvasRenderingContext2D, picture: HTMLCanvasElement, size: number) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(picture, 0, 0, size, size);
  ctx.restore();
}

/** RGBA pixels into a canvas, once: redrawing it every frame (replay over a heatmap) is then cheap. */
export function heatCanvas(pixels: Uint8ClampedArray<ArrayBuffer>, n: number): HTMLCanvasElement {
  const off = document.createElement('canvas');
  off.width = n;
  off.height = n;
  off.getContext('2d')?.putImageData(new ImageData(pixels, n, n), 0, 0);
  return off;
}

export function drawMarker(ctx: CanvasRenderingContext2D, shape: MarkerShape, color: string, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (shape) {
    case 'cross':
      ctx.lineCap = 'round';
      ctx.lineWidth = r * 0.75 + 1.5;
      ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r);
      ctx.stroke();
      ctx.lineWidth = r * 0.375 + 0.5;
      ctx.strokeStyle = color;
      ctx.stroke();
      break;
    case 'skull':
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = '#111';
      ctx.arc(-r / 2.6, -r / 6, r / 3.6, 0, Math.PI * 2);
      ctx.arc(r / 2.6, -r / 6, r / 3.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'storm':
      ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = '#111';
      ctx.arc(0, 0, r / 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'diamond':
      ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/**
 * One player in focus: the rest of the map dims, the path so far is bold, the path still to come is a dashed
 * ghost (where they will go), every one of their events shows (future ones faded), and their fights are drawn.
 */
export function drawFocus(
  ctx: CanvasRenderingContext2D, match: Match, index: number, uvUnits: number, size: number, t: number,
  active: MatchEvent | null = null, phase = 0, opponents: number[] = [],
) {
  const p = match.players[index];
  if (!p) return;
  const px = (u: number, v: number) => uvToPixel(u, v, uvUnits, size);
  ctx.save();
  ctx.fillStyle = 'rgba(8, 9, 12, 0.55)';
  ctx.fillRect(0, 0, size, size);
  // Everyone this player fought: their path so far, bold, in their own color, so both sides of a fight show.
  for (const o of opponents) {
    const q = match.players[o];
    if (!q) continue;
    const n = samplesUntil(q.path, t);
    if (n < 1) continue;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const { x, y } = px(q.path[i * 3 + 1], q.path[i * 3 + 2]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const head = positionAt(q.path, t);
    if (head) {
      const { x, y } = px(head.u, head.v);
      ctx.lineTo(x, y);
    }
    const color = q.bot ? PATH_COLOR.bot : PATH_COLOR.human;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = 5.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = color;
    ctx.stroke();
    if (head && t < q.path[q.path.length - 3]) {
      const { x, y } = px(head.u, head.v);
      drawHead(ctx, x, y, color, q.bot);
    }
  }
  const n = samplesUntil(p.path, t);
  const line = (from: number, to: number) => {
    ctx.beginPath();
    for (let i = from; i < to; i++) {
      const { x, y } = px(p.path[i * 3 + 1], p.path[i * 3 + 2]);
      if (i === from) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  const total = p.path.length / 3;
  const color = p.bot ? PATH_COLOR.bot : '#ffffff';
  // Future: where this player is going next.
  line(Math.max(0, n - 1), total);
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.stroke();
  ctx.setLineDash([]);
  // Past: bold, on a dark outline.
  line(0, n);
  const head = positionAt(p.path, t);
  if (head) {
    const { x, y } = px(head.u, head.v);
    ctx.lineTo(x, y);
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = color;
  ctx.stroke();
  const k = pulse(phase);
  for (const e of match.events) {
    const [time, type, u, v, who] = e;
    if (who !== index) continue;
    const s = EVENT_STYLE[type];
    const { x, y } = px(u, v);
    ctx.globalAlpha = time <= t ? 1 : 0.4;
    if (e === active) {
      // The event pointed at in the card, the timeline or on the map: a pulsing ring.
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 1 - k;
      ctx.arc(x, y, s.size * 1.6 + 3 + k * 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = time <= t ? 1 : 0.4;
    }
    drawMarker(ctx, s.shape, s.color, x, y, s.size * (e === active ? 1.6 + 0.3 * k : 1.2));
  }
  ctx.globalAlpha = 1;
  for (const [time, ku, kv, vu, vv, killer, victim, , , inferred] of match.fights ?? [])
    if (killer === index || victim === index)
      drawFightLine(ctx, px(ku, kv), px(vu, vv), match.players[killer]?.bot ?? false, (time <= t ? 1 : 0.4) * (inferred ? 0.7 : 1));
  if (head) {
    const { x, y } = px(head.u, head.v);
    drawHead(ctx, x, y, color, false);
  }
  ctx.restore();
}
