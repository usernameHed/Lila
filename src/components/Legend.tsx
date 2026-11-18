import { useEffect, useRef } from 'react';
import { EVENT_STYLE, PATH_COLOR } from '../lib/style';
import type { EventType } from '../lib/types';
import { drawMarker } from './MapCanvas';

function MarkerIcon({ type }: { type: EventType }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = 18 * dpr;
    el.height = 18 * dpr;
    ctx.scale(dpr, dpr);
    const s = EVENT_STYLE[type];
    drawMarker(ctx, s.shape, s.color, 9, 9, type === 'Loot' ? 4.5 : 6);
  }, [type]);
  return <canvas ref={ref} style={{ width: 18, height: 18 }} aria-hidden />;
}

export function Legend({ counts }: { counts: Partial<Record<EventType, number>> }) {
  return (
    <ul className="legend">
      <li>
        <span className="swatch line" style={{ background: PATH_COLOR.human }} /> Human path
      </li>
      <li>
        <span className="swatch line dashed" style={{ color: PATH_COLOR.bot }} /> Bot path
      </li>
      {(Object.keys(EVENT_STYLE) as EventType[]).map((type) => (
        <li key={type}>
          <MarkerIcon type={type} /> {EVENT_STYLE[type].label}
          <span className="count">{counts[type] ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}
