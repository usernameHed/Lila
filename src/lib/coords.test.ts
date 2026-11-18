import { describe, expect, it } from 'vitest';
import { uvToPixel, worldToUv } from './coords';
import type { MapConfig } from './types';

const ambrose: MapConfig = { id: 'AmbroseValley', scale: 900, originX: -370, originZ: -473, hMin: 100, hMax: 150 };

describe('coordinate mapping', () => {
  it('matches the worked example of the dataset README (x=-301.45, z=-355.55 -> pixel 78, 890 on 1024 px)', () => {
    const uv = worldToUv(ambrose, -301.45, -355.55);
    const px = uvToPixel(uv.x * 10_000, uv.y * 10_000, 10_000, 1024);
    expect(Math.round(px.x)).toBe(78);
    expect(Math.round(px.y)).toBe(890);
  });

  it('puts the origin at the bottom-left corner and origin + scale at the top-right', () => {
    expect(uvToPixel(0, 0, 10_000, 2048)).toEqual({ x: 0, y: 2048 });
    expect(uvToPixel(10_000, 10_000, 10_000, 2048)).toEqual({ x: 2048, y: 0 });
  });
});
