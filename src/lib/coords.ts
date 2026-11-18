import type { MapConfig } from './types';

export interface Point {
  x: number;
  y: number;
}

/** World (x, z) to map UV in [0, 1]. Mirrors pipeline/build.py `to_uv`; v grows with z (north). */
export function worldToUv(map: MapConfig, x: number, z: number): Point {
  return { x: (x - map.originX) / map.scale, y: (z - map.originZ) / map.scale };
}

/**
 * Stored UV (0..uvUnits) to a pixel on a square image of `size` px.
 * The image origin is top-left and v grows upward, so v is flipped.
 */
export function uvToPixel(u: number, v: number, uvUnits: number, size: number): Point {
  return { x: (u / uvUnits) * size, y: (1 - v / uvUnits) * size };
}
