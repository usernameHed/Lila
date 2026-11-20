// The map icons: a crosshair where someone killed, a robot head where a bot died (with a crosshair over it where a
// player killed a bot), a skull over crossed bones where a player died, a diamond with a hole for a storm death, a
// small diamond for loot. Filled in the kind's color on a dark outline, so they read on any part of the minimap.
import type { MarkerShape } from './style';

const OUTLINE = 'rgba(0,0,0,0.85)';

/** Draws one icon centered on (x, y), about `r` in radius. */
export function drawMarker(ctx: CanvasRenderingContext2D, shape: MarkerShape, color: string, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (shape) {
    case 'skullBones':
      bones(ctx, color, r * 0.92);
      skull(ctx, color, r * 0.95);
      break;
    case 'skull':
      skull(ctx, color, r);
      break;
    case 'crosshair':
      crosshair(ctx, color, r);
      break;
    case 'botTarget':
      botHead(ctx, color, r);
      sight(ctx, r);
      break;
    case 'botHead':
      botHead(ctx, color, r * 1.25); // no crosshair around it: the head fills the icon's size
      break;
    case 'storm':
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = '#111';
      ctx.arc(0, 0, r / 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** The round skull: a filled disc with two eye holes. */
function skull(ctx: CanvasRenderingContext2D, color: string, r: number) {
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.beginPath();
  ctx.fillStyle = '#111';
  ctx.arc(-r / 2.6, -r / 6, r / 3.6, 0, Math.PI * 2);
  ctx.arc(r / 2.6, -r / 6, r / 3.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Two crossed bones (the old kill cross, with a knob pair at each end), drawn behind the skull. */
function bones(ctx: CanvasRenderingContext2D, color: string, r: number) {
  const a = r * 1.05;
  const w = r * 0.32 + 0.6; // bone thickness
  const k = w * 0.62; // knob radius
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-a, -a); ctx.lineTo(a, a); ctx.moveTo(a, -a); ctx.lineTo(-a, a);
  };
  const knobs = () => {
    ctx.beginPath();
    for (const [x, y] of [[-a, -a], [a, a], [a, -a], [-a, a]]) {
      // two knobs side by side, across the bone's direction
      const nx = x * y > 0 ? -0.7 : 0.7;
      const ny = 0.7;
      ctx.moveTo(x + nx * k + k, y + ny * k);
      ctx.arc(x + nx * k, y + ny * k, k, 0, Math.PI * 2);
      ctx.moveTo(x - nx * k + k, y - ny * k);
      ctx.arc(x - nx * k, y - ny * k, k, 0, Math.PI * 2);
    }
  };
  // Outline first (a little wider), then the bone color on top.
  path();
  ctx.lineWidth = w + 3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  knobs();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
  path();
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** A crosshair: a ring, four ticks pointing in, a dot in the middle. Where a kill was made from. */
function crosshair(ctx: CanvasRenderingContext2D, color: string, r: number) {
  const ring = r * 0.72;
  const draw = () => {
    ctx.beginPath();
    ctx.arc(0, 0, ring, 0, Math.PI * 2);
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      ctx.moveTo(dx * r * 1.15, dy * r * 1.15);
      ctx.lineTo(dx * r * 0.38, dy * r * 0.38);
    }
  };
  const w = Math.max(1.6, r * 0.26);
  draw();
  ctx.lineWidth = w + 2.5;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  draw();
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.3, r * 0.2), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

/** A robot head: antenna, then a rounded square face with two eyes. Where a bot died; with `sight`, a bot killed. */
function botHead(ctx: CanvasRenderingContext2D, color: string, r: number) {
  const h = r * 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.55);
  ctx.lineTo(0, -h * 0.95);
  ctx.lineWidth = Math.max(1.4, h * 0.16);
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -h * 0.98, h * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(-h * 0.8, -h * 0.55, h * 1.6, h * 1.3, h * 0.3);
  ctx.fill();
  ctx.lineWidth = Math.max(1.4, h * 0.16);
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(-r * 0.27, 0, r * 0.13, 0, Math.PI * 2);
  ctx.arc(r * 0.27, 0, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

/** A white crosshair (ring and four ticks) on a dark outline, drawn over the robot head: a player killed a bot. */
function sight(ctx: CanvasRenderingContext2D, r: number) {
  const ring = () => {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2);
    for (const [a, b] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      ctx.moveTo(a * r * 0.7, b * r * 0.7);
      ctx.lineTo(a * r * 1.2, b * r * 1.2);
    }
  };
  ring();
  ctx.lineWidth = Math.max(2, r * 0.24);
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ring();
  ctx.lineWidth = Math.max(1, r * 0.11);
  ctx.strokeStyle = '#fff';
  ctx.stroke();
}
