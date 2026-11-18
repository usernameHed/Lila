// The map icons, drawn like Breath of the Wild's map stamps: a light glyph (a skull, a bot skull, crossed bones,
// a lightning bolt) on a dark round badge ringed in the kind's color, readable on any part of the minimap.
// Loot stays a small gem without a badge: there are thousands of them.
import type { MarkerShape } from './style';

const BADGE = 'rgba(14, 16, 20, 0.9)';
const INK = '#0e1014';

/** Draws one icon centered on (x, y); `r` is its size (the badge is a little larger). */
export function drawMarker(ctx: CanvasRenderingContext2D, shape: MarkerShape, color: string, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (shape === 'diamond') {
    gem(ctx, color, r);
    ctx.restore();
    return;
  }
  const R = r * 1.3;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fillStyle = BADGE;
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, R * 0.16);
  ctx.strokeStyle = color;
  ctx.stroke();
  const s = R * 0.62; // glyph unit
  switch (shape) {
    case 'skullBones':
      bones(ctx, color, s);
      skull(ctx, color, s * 0.82);
      break;
    case 'botSkullBones':
      bones(ctx, color, s);
      botSkull(ctx, color, s * 0.82);
      break;
    case 'skull':
      skull(ctx, color, s);
      break;
    case 'botSkull':
      botSkull(ctx, color, s);
      break;
    case 'storm':
      bolt(ctx, color, s);
      break;
  }
  ctx.restore();
}

/** A human skull: round cranium, jaw, two eye holes, a nose. */
function skull(ctx: CanvasRenderingContext2D, color: string, s: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -0.12 * s, 0.66 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-0.38 * s, 0.2 * s, 0.76 * s, 0.5 * s, 0.14 * s);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(-0.26 * s, -0.08 * s, 0.17 * s, 0.2 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(0.26 * s, -0.08 * s, 0.17 * s, 0.2 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0.14 * s);
  ctx.lineTo(-0.08 * s, 0.3 * s);
  ctx.lineTo(0.08 * s, 0.3 * s);
  ctx.closePath();
  ctx.fill();
  if (s > 5) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(0.6, 0.07 * s);
    ctx.beginPath();
    for (const dx of [-0.13, 0.13]) {
      ctx.moveTo(dx * s, 0.46 * s);
      ctx.lineTo(dx * s, 0.68 * s);
    }
    ctx.stroke();
  }
}

/** A bot's skull: square head, antenna, square eyes, a grille for a mouth. */
function botSkull(ctx: CanvasRenderingContext2D, color: string, s: number) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 0.12 * s);
  ctx.beginPath();
  ctx.moveTo(0, -0.5 * s);
  ctx.lineTo(0, -0.78 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -0.82 * s, 0.12 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-0.66 * s, -0.52 * s, 1.32 * s, 1.18 * s, 0.24 * s);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(-0.44 * s, -0.24 * s, 0.3 * s, 0.26 * s);
  ctx.fillRect(0.14 * s, -0.24 * s, 0.3 * s, 0.26 * s);
  ctx.fillRect(-0.36 * s, 0.24 * s, 0.72 * s, 0.22 * s);
  if (s > 5) {
    ctx.fillStyle = color;
    for (const dx of [-0.13, 0.11]) ctx.fillRect(dx * s, 0.24 * s, 0.05 * s, 0.22 * s);
  }
}

/** Two crossed bones behind the skull, knobbed at both ends. */
function bones(ctx: CanvasRenderingContext2D, color: string, s: number) {
  const a = 0.86 * s;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.2, 0.2 * s);
  ctx.beginPath();
  ctx.moveTo(-a, -a);
  ctx.lineTo(a, a);
  ctx.moveTo(a, -a);
  ctx.lineTo(-a, a);
  ctx.stroke();
  const k = Math.max(0.9, 0.13 * s);
  ctx.beginPath();
  for (const [x, y] of [[-a, -a], [a, a], [a, -a], [-a, a]]) {
    // two knobs per end, across the bone
    const nx = (x > 0 ? 1 : -1) * (y > 0 ? 1 : -1) * 0.7;
    ctx.moveTo(x + k * 0.7 + k, y - nx * k);
    ctx.arc(x + k * 0.7, y - nx * k, k, 0, Math.PI * 2);
    ctx.moveTo(x - k * 0.7 + k, y + nx * k);
    ctx.arc(x - k * 0.7, y + nx * k, k, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** A lightning bolt: the storm. */
function bolt(ctx: CanvasRenderingContext2D, color: string, s: number) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0.18 * s, -0.95 * s);
  ctx.lineTo(-0.5 * s, 0.12 * s);
  ctx.lineTo(-0.04 * s, 0.12 * s);
  ctx.lineTo(-0.22 * s, 0.95 * s);
  ctx.lineTo(0.52 * s, -0.18 * s);
  ctx.lineTo(0.06 * s, -0.18 * s);
  ctx.closePath();
  ctx.fill();
}

/** Loot: a small faceted gem on a dark outline. */
function gem(ctx: CanvasRenderingContext2D, color: string, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.85, -r * 0.2);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.85, -r * 0.2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.85, -r * 0.2);
  ctx.lineTo(r * 0.85, -r * 0.2);
  ctx.moveTo(0, -r);
  ctx.lineTo(0, r);
  ctx.lineWidth = Math.max(0.6, r * 0.12);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.stroke();
}
