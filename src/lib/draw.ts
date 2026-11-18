// Canvas drawing for the map: a match at a given time, and heatmap pixels.
import { uvToPixel } from './coords';
import { EVENT_LAYER, EVENT_STYLE, FIRE_COLOR, HEIGHT_STEPS, MANY_MATCHES, MATCH_COLORS, PATH_COLOR, heightColor, type MarkerShape } from './style';
import { heightAt, positionAt, samplesUntil } from './timeline';
import type { EventType, Match, MatchEvent } from './types';

/** How long (match time) a fresh event keeps a ring around it during playback. */
const FRESH_MS = 8000;

interface Look {
  human: string; // player path color
  faint: boolean; // many matches at once: thinner, lighter lines, no loot
  height?: { min: number; max: number }; // color paths by height (dm range) instead of by player
}

/** What a legend row can point at: an event type, or the killer-to-victim lines. */
export type LegendKey = EventType | 'fights';

export interface ReplayOptions {
  mono?: boolean; // one color for every match
  heightRange?: { min: number; max: number } | null; // color paths by height (dm), dark = low, bright = high
  hidden?: ReadonlySet<LegendKey>; // legend rows turned off
  hover?: LegendKey | null; // legend row under the mouse: its markers pulse, the rest fade
  phase?: number; // animation clock (ms) for the pulse
}

/** Several matches on one clock: all start at t = 0 (each match's own clock). */
export function drawMatches(ctx: CanvasRenderingContext2D, matches: Match[], uvUnits: number, size: number, t: number, playing: boolean, o: ReplayOptions = {}) {
  const many = matches.length > MANY_MATCHES;
  const hidden = o.hidden ?? new Set<LegendKey>();
  matches.forEach((m, i) =>
    drawPaths(ctx, m, uvUnits, size, t, playing, { human: many || o.mono ? PATH_COLOR.human : MATCH_COLORS[i], faint: many, height: o.heightRange ?? undefined }),
  );

  // Events after every path, so no marker is hidden under another match's lines.
  const events = matches.flatMap((m) => m.events).filter((e) => e[0] <= t && !hidden.has(e[1]) && !(many && e[1] === 'loot' && o.hover !== 'loot'));
  drawEvents(ctx, events, uvUnits, size, t, playing, many ? 0.55 : 1, o);
  // Killer-to-victim lines last: short (median ~9 m), they would hide under the markers.
  if (!hidden.has('fights')) {
    const fade = o.hover && o.hover !== 'fights' ? 0.25 : 1;
    for (const m of matches)
      for (const [time, ku, kv, vu, vv, killer] of m.fights ?? [])
        if (time <= t) drawFightLine(ctx, uvToPixel(ku, kv, uvUnits, size), uvToPixel(vu, vv, uvUnits, size), m.players[killer]?.bot ?? false, fade, o.hover === 'fights' ? pulse(o.phase) : 0);
  }
}

/** 0 -> 1 -> 0 every 900 ms: the hover pulse. */
const pulse = (phase = 0) => 0.5 - 0.5 * Math.cos((phase / 900) * Math.PI * 2);

/** The paths of one match up to time t, with each player's current position while it moves. */
function drawPaths(ctx: CanvasRenderingContext2D, match: Match, uvUnits: number, size: number, t: number, playing: boolean, look: Look) {
  const px = (u: number, v: number) => uvToPixel(u, v, uvUnits, size);

  // Bots first, so human paths stay on top.
  const players = [...match.players].sort((a, b) => Number(b.bot) - Number(a.bot));
  for (const p of players) {
    const n = samplesUntil(p.path, t);
    if (!n) continue;
    const color = p.bot ? PATH_COLOR.bot : look.human;
    ctx.beginPath();
    ctx.lineWidth = (p.bot ? 1.25 : 2.25) * (look.faint ? 0.5 : 1);
    ctx.strokeStyle = color;
    ctx.setLineDash(p.bot ? [4, 3] : []);
    ctx.globalAlpha = (p.bot ? 0.7 : 0.95) * (look.faint ? 0.22 : 1);
    for (let i = 0; i < n * 3; i += 3) {
      const { x, y } = px(p.path[i + 1], p.path[i + 2]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const head = positionAt(p.path, t);
    if (look.height && p.h) {
      strokeByHeight(ctx, p.path, p.h, n, head, heightAt(p.path, p.h, t), look.height, px);
    } else if (head) {
      const { x, y } = px(head.u, head.v);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else ctx.stroke();
    ctx.globalAlpha = 1;
    if (head && (playing || t < p.path[p.path.length - 3])) {
      const { x, y } = px(head.u, head.v);
      const k = look.height ? heightK(heightAt(p.path, p.h, t) ?? 0, look.height) : 0;
      drawHead(ctx, x, y, look.height ? heightColor(k) : color, p.bot || look.faint);
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

const heightK = (h: number, r: { min: number; max: number }) => (h - r.min) / Math.max(1, r.max - r.min);

/**
 * A path colored by height: each segment takes the color of its mean height, in HEIGHT_STEPS bands, and each
 * band is stroked once (a stroke per segment would be ~40k strokes a frame with every match shown).
 */
function strokeByHeight(
  ctx: CanvasRenderingContext2D, path: number[], h: number[], n: number,
  head: { u: number; v: number } | null, headH: number | null, range: { min: number; max: number },
  px: (u: number, v: number) => { x: number; y: number },
) {
  const bands: Path2D[] = Array.from({ length: HEIGHT_STEPS }, () => new Path2D());
  const add = (u0: number, v0: number, h0: number, u1: number, v1: number, h1: number) => {
    const k = heightK((h0 + h1) / 2, range);
    const band = bands[Math.min(HEIGHT_STEPS - 1, Math.max(0, Math.floor(k * HEIGHT_STEPS)))];
    const a = px(u0, v0);
    const b = px(u1, v1);
    band.moveTo(a.x, a.y);
    band.lineTo(b.x, b.y);
  };
  for (let s = 1; s < n; s++) add(path[s * 3 - 2], path[s * 3 - 1], h[s - 1], path[s * 3 + 1], path[s * 3 + 2], h[s]);
  if (head && headH !== null && n > 0) add(path[n * 3 - 2], path[n * 3 - 1], h[n - 1], head.u, head.v, headH);
  ctx.lineCap = 'round';
  bands.forEach((band, i) => {
    ctx.strokeStyle = heightColor((i + 0.5) / HEIGHT_STEPS);
    ctx.stroke(band);
  });
  ctx.lineCap = 'butt';
}

/** Event markers; `scale` shrinks them when many matches share the map; the hovered type pulses. */
function drawEvents(ctx: CanvasRenderingContext2D, all: MatchEvent[], uvUnits: number, size: number, t: number, playing: boolean, scale: number, o: ReplayOptions) {
  const px = (u: number, v: number) => uvToPixel(u, v, uvUnits, size);
  const lit = (type: EventType) => o.hover === type;
  // The hovered type is drawn last, on top of everything.
  const events = [...all].sort((a, b) => Number(lit(a[1])) - Number(lit(b[1])) || EVENT_LAYER[a[1]] - EVENT_LAYER[b[1]]);
  const k = pulse(o.phase);
  for (const [time, type, u, v] of events) {
    const { x, y } = px(u, v);
    const style = EVENT_STYLE[type];
    const r = style.size * scale;
    if (o.hover) ctx.globalAlpha = lit(type) ? 1 : 0.2;
    if (lit(type)) {
      ctx.beginPath();
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - k;
      ctx.arc(x, y, r + 3 + k * 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (playing && t - time < FRESH_MS && type !== 'loot' && !o.hover) {
      ctx.beginPath();
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - (t - time) / FRESH_MS;
      ctx.arc(x, y, r + 4 + ((t - time) / FRESH_MS) * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawMarker(ctx, style.shape, style.color, x, y, lit(type) ? r * (1.25 + 0.25 * k) : r);
  }
  ctx.globalAlpha = 1;
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
