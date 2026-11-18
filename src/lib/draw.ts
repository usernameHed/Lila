// Canvas drawing for the map: a match at a given time, and heatmap pixels.
import { uvToPixel } from './coords';
import { EVENT_LAYER, EVENT_STYLE, PATH_COLOR, type MarkerShape } from './style';
import { positionAt, samplesUntil } from './timeline';
import type { Match } from './types';

/** How long (match time) a fresh event keeps a ring around it during playback. */
const FRESH_MS = 8000;

export function drawMatch(ctx: CanvasRenderingContext2D, match: Match, uvUnits: number, size: number, t: number, playing: boolean) {
  const px = (u: number, v: number) => uvToPixel(u, v, uvUnits, size);

  // Bots first, so human paths stay on top.
  const players = [...match.players].sort((a, b) => Number(b.bot) - Number(a.bot));
  for (const p of players) {
    const n = samplesUntil(p.path, t);
    if (!n) continue;
    const color = p.bot ? PATH_COLOR.bot : PATH_COLOR.human;
    ctx.beginPath();
    ctx.lineWidth = p.bot ? 1.25 : 2.25;
    ctx.strokeStyle = color;
    ctx.setLineDash(p.bot ? [4, 3] : []);
    ctx.globalAlpha = p.bot ? 0.7 : 0.95;
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
      if (playing || t < p.path[p.path.length - 3]) drawHead(ctx, x, y, color, p.bot);
    } else ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  const events = match.events.filter((e) => e[0] <= t).sort((a, b) => EVENT_LAYER[a[1]] - EVENT_LAYER[b[1]]);
  for (const [time, type, u, v] of events) {
    const { x, y } = px(u, v);
    const style = EVENT_STYLE[type];
    if (playing && t - time < FRESH_MS && type !== 'loot') {
      ctx.beginPath();
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 1 - (t - time) / FRESH_MS;
      ctx.arc(x, y, style.size + 4 + ((t - time) / FRESH_MS) * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    drawMarker(ctx, style.shape, style.color, x, y, style.size);
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

/** Heatmap pixels (grid x grid RGBA) stretched over the map with smoothing. */
export function drawHeat(ctx: CanvasRenderingContext2D, pixels: Uint8ClampedArray<ArrayBuffer>, grid: number, size: number) {
  const off = document.createElement('canvas');
  off.width = grid;
  off.height = grid;
  off.getContext('2d')?.putImageData(new ImageData(pixels, grid, grid), 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
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
