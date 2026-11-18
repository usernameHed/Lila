// Canvas drawing for the map: a match at a given time, and heatmap pixels.
import { uvToPixel } from './coords';
import { EVENT_LAYER, EVENT_STYLE, FIRE_COLOR, MANY_MATCHES, MATCH_COLORS, PATH_COLOR, type MarkerShape } from './style';
import { positionAt, samplesUntil } from './timeline';
import type { Match, MatchEvent } from './types';

/** How long (match time) a fresh event keeps a ring around it during playback. */
const FRESH_MS = 8000;

interface Look {
  human: string; // player path color
  faint: boolean; // many matches at once: thinner, lighter lines, no loot
}

/** Several matches on one clock: all start at t = 0 (each match's own clock). `mono`: one color for all. */
export function drawMatches(ctx: CanvasRenderingContext2D, matches: Match[], uvUnits: number, size: number, t: number, playing: boolean, mono = false) {
  const many = matches.length > MANY_MATCHES;
  matches.forEach((m, i) =>
    drawPaths(ctx, m, uvUnits, size, t, playing, { human: many || mono ? PATH_COLOR.human : MATCH_COLORS[i], faint: many }),
  );

  // Events after every path, so no marker is hidden under another match's lines.
  const events = matches.flatMap((m) => m.events).filter((e) => e[0] <= t && !(many && e[1] === 'loot'));
  drawEvents(ctx, events, uvUnits, size, t, playing, many ? 0.55 : 1);
  // Killer-to-victim lines last: short (median ~12 m), they would hide under the markers.
  for (const m of matches) drawFights(ctx, m, uvUnits, size, t);
}

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
    if (head) {
      const { x, y } = px(head.u, head.v);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (playing || t < p.path[p.path.length - 3]) drawHead(ctx, x, y, color, p.bot || look.faint);
    } else ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

/** Event markers; `scale` shrinks them when many matches share the map. */
function drawEvents(ctx: CanvasRenderingContext2D, all: MatchEvent[], uvUnits: number, size: number, t: number, playing: boolean, scale: number) {
  const px = (u: number, v: number) => uvToPixel(u, v, uvUnits, size);
  const events = [...all].sort((a, b) => EVENT_LAYER[a[1]] - EVENT_LAYER[b[1]]);
  for (const [time, type, u, v] of events) {
    const { x, y } = px(u, v);
    const style = EVENT_STYLE[type];
    if (playing && t - time < FRESH_MS && type !== 'loot') {
      ctx.beginPath();
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - (t - time) / FRESH_MS;
      ctx.arc(x, y, style.size * scale + 4 + ((t - time) / FRESH_MS) * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawMarker(ctx, style.shape, style.color, x, y, style.size * scale);
  }
}

/** Killer to victim, for the kills whose victim's death is recorded too: a line with an arrow at the victim. */
function drawFights(ctx: CanvasRenderingContext2D, match: Match, uvUnits: number, size: number, t: number) {
  for (const [time, ku, kv, vu, vv, killer] of match.fights ?? []) {
    if (time > t) continue;
    const a = uvToPixel(ku, kv, uvUnits, size);
    const b = uvToPixel(vu, vv, uvUnits, size);
    const color = match.players[killer]?.bot ? PATH_COLOR.bot : FIRE_COLOR;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - 9 * Math.cos(angle - 0.45), b.y - 9 * Math.sin(angle - 0.45));
    ctx.lineTo(b.x - 9 * Math.cos(angle + 0.45), b.y - 9 * Math.sin(angle + 0.45));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
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

/** Heatmap pixels (n x n RGBA) stretched over the map; smoothed for the gradient look, crisp for toon bands. */
export function drawHeat(ctx: CanvasRenderingContext2D, pixels: Uint8ClampedArray<ArrayBuffer>, n: number, size: number, smooth: boolean) {
  const off = document.createElement('canvas');
  off.width = n;
  off.height = n;
  off.getContext('2d')?.putImageData(new ImageData(pixels, n, n), 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = smooth || n < size; // bands are 512 px: smoothing only blends their edges slightly
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, 0, 0, size, size);
  ctx.restore();
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
