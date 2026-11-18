// The map icons: a crosshair where someone killed, a skull over crossed bones where a player died, a dead
// monster where a bot died, a diamond with a hole for a storm death, a small diamond for loot. Filled in the kind's color on a dark outline, so they read on any
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
      bones(ctx, color, r * 0.92);
      skull(ctx, color, r * 0.95);
      break;
    case 'skull':
      skull(ctx, color, r);
      break;
    case 'crosshair':
      crosshair(ctx, color, r);
      break;
    case 'monster':
      monster(ctx, color, r);
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

/** A dead monster: a round head with two horns, X eyes and a jagged mouth. Where a bot died. */
function monster(ctx: CanvasRenderingContext2D, color: string, r: number) {
  ctx.beginPath();
  // horns
  ctx.moveTo(-r * 0.75, -r * 0.35);
  ctx.lineTo(-r * 0.95, -r * 1.1);
  ctx.lineTo(-r * 0.3, -r * 0.8);
  ctx.moveTo(r * 0.75, -r * 0.35);
  ctx.lineTo(r * 0.95, -r * 1.1);
  ctx.lineTo(r * 0.3, -r * 0.8);
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, r * 0.05, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // X eyes
  ctx.strokeStyle = '#111';
  ctx.lineWidth = Math.max(1, r * 0.17);
  ctx.beginPath();
  for (const ex of [-r * 0.36, r * 0.36]) {
    const ey = -r * 0.12;
    const e = r * 0.2;
    ctx.moveTo(ex - e, ey - e);
    ctx.lineTo(ex + e, ey + e);
    ctx.moveTo(ex + e, ey - e);
    ctx.lineTo(ex - e, ey + e);
  }
  ctx.stroke();
  // jagged mouth
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, r * 0.42);
  ctx.lineTo(-r * 0.21, r * 0.3);
  ctx.lineTo(0, r * 0.42);
  ctx.lineTo(r * 0.21, r * 0.3);
  ctx.lineTo(r * 0.42, r * 0.42);
  ctx.lineWidth = Math.max(1, r * 0.13);
  ctx.stroke();
}
