// The map icons: a round skull for a death, the same skull over crossed bones for a kill, a diamond with a hole
// for a storm death, a small diamond for loot. Filled in the kind's color on a dark outline, so they read on any
// part of the minimap.
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
      bones(ctx, color, r);
      skull(ctx, color, r * 0.72);
      break;
    case 'skull':
      skull(ctx, color, r);
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
