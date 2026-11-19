// Canvas drawing for the map: a match at a given time, and heatmap pixels.
import { uvToPixel } from './coords';
import { EVENT_LAYER, EVENT_STYLE, FIRE_COLOR, MANY_MATCHES, MATCH_COLORS, PATH_COLOR, type MarkerShape } from './style';
import { drawMarker } from './icons';

export { drawMarker };
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
  width: number; // path thickness factor (setting)
  alpha: number; // path opacity factor (setting)
}

/** What a legend row can point at: an event type, or the killer-to-victim lines. */
export type LegendKey = EventType | 'fights' | 'humanPath' | 'botPath';

export interface ReplayOptions {
  mono?: boolean; // one color for every match
  hidden?: ReadonlySet<LegendKey>; // legend rows turned off
  hover?: LegendKey | null; // legend row under the mouse: its markers pulse, the rest fade
  activeEvent?: MatchEvent | null; // one event pointed at (map, timeline, card): it pulses
  iconScale?: number; // size of the event icons (1 = default)
  phase?: number; // animation clock (ms) for the pulse
  /** 0 -> 1, eased: how far the rest has faded back because something is hovered (never fully hidden). */
  dim?: number;
  /** The path under the mouse: highlighted, under the icons. */
  hoverPath?: { match: string; player: number } | null;
  pathWidth?: number; // path thickness factor (1 = default)
  pathAlpha?: number; // path opacity factor (1 = default)
}

/** How much the rest fades when something is hovered, at the end of the fade: it stays readable. */
export const HOVER_FADE = { icons: 0.5, paths: 0.4, lines: 0.5 };

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
      fade: 1 - HOVER_FADE.paths * (o.dim ?? 0) * (o.hover === 'humanPath' || o.hover === 'botPath' ? 0 : 1),
      width: o.pathWidth ?? 1,
      alpha: o.pathAlpha ?? 1,
    }),
  );

  const hp = o.hoverPath;
  const hm = hp ? matches.find((m) => m.id === hp.match) : undefined;
  if (hp && hm) drawPathHover(ctx, hm, hp.player, uvUnits, size, t);
  // Events after every path, so no marker is hidden under another match's lines.
  // Past events, plus the future ones of the hovered kind and the pointed-at event (drawn faded).
  const events = matches.flatMap((m) => m.events).filter((e) => !hidden.has(e[1]));
  drawEvents(ctx, events, uvUnits, size, t, playing, (many ? 0.55 : 1) * (o.iconScale ?? 1), o);
  // Killer-to-victim lines last: short (median ~9 m), they would hide under the markers.
  if (!hidden.has('fights')) {
    const fade = o.hover === 'fights' ? 1 : 1 - HOVER_FADE.lines * (o.dim ?? 0);
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
    const width = (p.bot ? 2 : 2.4) * (look.faint ? 0.8 : 1) * look.width;
    const alpha = Math.min(1, (p.bot ? 0.85 : 0.95) * (look.faint ? (look.density ?? 0.22) : 1) * look.alpha) * (look.fade ?? 1);
    ctx.beginPath();
    for (let i = 0; i < n * 3; i += 3) {
      const { x, y } = px(p.path[i + 1], p.path[i + 2]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const head = positionAt(p.path, t);
    if (head) {
      const { x, y } = px(head.u, head.v);
      ctx.lineTo(x, y);
    }
    ctx.lineJoin = 'round';
    ctx.setLineDash(p.bot ? [6 * look.width, 4 * look.width] : []);
    // A dark edge under each line (few matches only), so it reads on bright parts of the minimap.
    if (!look.faint) {
      ctx.globalAlpha = alpha * 0.45;
      ctx.lineWidth = width + 2;
      ctx.strokeStyle = '#05060a';
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (head && (playing || t < p.path[p.path.length - 3])) {
      const { x, y } = px(head.u, head.v);
      drawHead(ctx, x, y, color, p.bot || look.faint);
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/**
 * Event icons. Nothing is ever hidden by a hover: the rest fades back (eased, by `o.dim`) while what is pointed at
 * (a legend kind, one event) stays bright and pulses. Loot is drawn first, kills and deaths on top.
 */
function drawEvents(ctx: CanvasRenderingContext2D, all: MatchEvent[], uvUnits: number, size: number, t: number, playing: boolean, scale: number, o: ReplayOptions) {
  const px = (u: number, v: number) => uvToPixel(u, v, uvUnits, size);
  const k = pulse(o.phase);
  const dim = o.dim ?? 0;
  const past = all.filter((e) => e[0] <= t).sort((a, b) => EVENT_LAYER[a[1]] - EVENT_LAYER[b[1]]);
  const lit = (e: MatchEvent) => e[1] === o.hover || e === o.activeEvent;

  for (const e of past) {
    if (lit(e)) continue;
    const style = EVENT_STYLE[e[1]];
    const { x, y } = px(e[2], e[3]);
    const r = style.size * scale;
    ctx.globalAlpha = 1 - HOVER_FADE.icons * dim;
    if (playing && !dim && e[1] !== 'loot' && t - e[0] < FRESH_MS) {
      const age = (t - e[0]) / FRESH_MS;
      ring(ctx, x, y, r + 4 + age * 10, style.color, 2, 1 - age);
    }
    stampMarker(ctx, style.shape, style.color, x, y, r);
  }
  ctx.globalAlpha = 1;

  // The hovered kind: bright and pulsing; its future events (not happened yet) see-through.
  if (o.hover)
    for (const e of all) {
      if (e[1] !== o.hover || e === o.activeEvent) continue;
      const style = EVENT_STYLE[e[1]];
      const { x, y } = px(e[2], e[3]);
      const r = style.size * scale;
      if (e[0] > t) {
        ctx.globalAlpha = 0.35;
        stampMarker(ctx, style.shape, style.color, x, y, r);
        ctx.globalAlpha = 1;
        continue;
      }
      ring(ctx, x, y, r + 3 + k * 12, style.color, 2, 1 - k);
      stampMarker(ctx, style.shape, style.color, x, y, r * (1.15 + 0.15 * k));
    }

  // One event pointed at (map, timeline, card): biggest, pulsing ring, faded if it has not happened yet.
  const e = o.activeEvent;
  if (e) {
    const style = EVENT_STYLE[e[1]];
    const { x, y } = px(e[2], e[3]);
    const r = style.size * scale * 1.4;
    const future = e[0] > t;
    ring(ctx, x, y, r + 3 + k * 18, style.color, 3, (1 - k) * (future ? 0.5 : 1));
    ctx.globalAlpha = future ? 0.4 : 1;
    stampMarker(ctx, style.shape, style.color, x, y, r * (1 + 0.15 * k));
    ctx.globalAlpha = 1;
  }
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width: number, alpha: number) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = alpha;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
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
  const half = q * 1.6 + 4; // room for the bones and the outline
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

/** The path under the mouse: drawn again on top, thicker and brighter, on a dark edge (the map is not dimmed). */
export function drawPathHover(ctx: CanvasRenderingContext2D, match: Match, index: number, uvUnits: number, size: number, t: number) {
  const p = match.players[index];
  if (!p) return;
  const n = samplesUntil(p.path, t);
  if (n < 1) return;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const { x, y } = uvToPixel(p.path[i * 3 + 1], p.path[i * 3 + 2], uvUnits, size);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  const head = positionAt(p.path, t);
  if (head) {
    const { x, y } = uvToPixel(head.u, head.v, uvUnits, size);
    ctx.lineTo(x, y);
  }
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = p.bot ? PATH_COLOR.bot : '#ffffff';
  ctx.stroke();
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
