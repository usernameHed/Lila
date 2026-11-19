// The kinds drawn on the replay: their icons (as on the map), names and colors.
import { useEffect, useRef } from 'react';
import { drawFightLine, drawMarker, type LegendKey } from '../lib/draw';
import { EVENT_STYLE, FIRE_COLOR, PATH_COLOR } from '../lib/style';
import type { EventType } from '../lib/types';

/** Every row of the legend, in order: the two path kinds, every event type, the killer-to-victim lines. */
export const LEGEND_KEYS: LegendKey[] = ['humanPath', 'botPath', ...(Object.keys(EVENT_STYLE) as EventType[]), 'fights'];

/** The icon of a legend kind, drawn exactly as on the map (also used in the player card). */
export function LegendIcon({ k, size = 18 }: { k: LegendKey; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = size * dpr;
    el.height = size * dpr;
    ctx.scale((dpr * size) / 18, (dpr * size) / 18);
    if (k === 'humanPath' || k === 'botPath') {
      ctx.strokeStyle = k === 'humanPath' ? PATH_COLOR.human : PATH_COLOR.bot;
      ctx.lineWidth = k === 'humanPath' ? 3 : 2;
      ctx.setLineDash(k === 'botPath' ? [4, 3] : []);
      ctx.beginPath();
      ctx.moveTo(2, 12);
      ctx.bezierCurveTo(6, 2, 11, 16, 16, 6);
      ctx.stroke();
      return;
    }
    if (k === 'fights') {
      ctx.scale(0.6, 0.6);
      drawFightLine(ctx, { x: 4, y: 26 }, { x: 26, y: 4 }, false);
      return;
    }
    const s = EVENT_STYLE[k];
    drawMarker(ctx, s.shape, s.color, 9, 9, Math.min(6, s.size));
  }, [k, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden />;
}

export const legendLabel = (k: LegendKey) =>
  k === 'humanPath' ? 'Player path' : k === 'botPath' ? 'Bot path' : k === 'fights' ? 'Line of fire' : EVENT_STYLE[k].label;
/** A legend kind's color (paths, events, killer-to-victim lines). */
export const legendColor = (k: LegendKey) => (k === 'humanPath' ? PATH_COLOR.human : k === 'botPath' ? PATH_COLOR.bot : k === 'fights' ? FIRE_COLOR : EVENT_STYLE[k].color);
