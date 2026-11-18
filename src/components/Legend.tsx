import { useEffect, useRef } from 'react';
import { drawFightLine, drawMarker, type LegendKey } from '../lib/draw';
import { EVENT_STYLE, FIRE_COLOR, PATH_COLOR, rgbCss } from '../lib/style';
import type { EventType } from '../lib/types';

export const LEGEND_KEYS: LegendKey[] = [...(Object.keys(EVENT_STYLE) as EventType[]), 'fights'];

function Icon({ k }: { k: LegendKey }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = 18 * dpr;
    el.height = 18 * dpr;
    ctx.scale(dpr, dpr);
    if (k === 'fights') {
      ctx.scale(0.6, 0.6);
      drawFightLine(ctx, { x: 4, y: 26 }, { x: 26, y: 4 }, false);
      return;
    }
    const s = EVENT_STYLE[k];
    drawMarker(ctx, s.shape, s.color, 9, 9, Math.min(6, s.size));
  }, [k]);
  return <canvas ref={ref} style={{ width: 18, height: 18 }} aria-hidden />;
}

const label = (k: LegendKey) => (k === 'fights' ? 'Killer to victim (line of fire)' : EVENT_STYLE[k].label);
const color = (k: LegendKey) => (k === 'fights' ? FIRE_COLOR : EVENT_STYLE[k].color);

interface Props {
  counts: Partial<Record<LegendKey, number>>;
  hidden: LegendKey[];
  onToggle: (k: LegendKey) => void;
  onOnly: (k: LegendKey) => void;
  onHover: (k: LegendKey | null) => void;
}

/**
 * Path styles, then every marker kind with its count in the selection. Hover a row: its markers pulse on the map.
 * Click a row: show only that kind (click it again to show all). Click its box: show or hide it.
 */
export function Legend({ counts, hidden, onToggle, onOnly, onHover }: Props) {
  return (
    <ul className="legend">
      <li className="static">
        <span className="swatch line" style={{ background: PATH_COLOR.human }} /> Player path
      </li>
      <li className="static">
        <span className="swatch line dashed" style={{ color: PATH_COLOR.bot }} /> Bot path
      </li>
      {LEGEND_KEYS.map((k) => {
        const on = !hidden.includes(k);
        return (
          <li key={k} className={`${on ? '' : 'off'} ${counts[k] ? '' : 'none'}`} onMouseEnter={() => on && onHover(k)} onMouseLeave={() => onHover(null)}>
            <button
              className="legend-box"
              onClick={() => onToggle(k)}
              aria-pressed={on}
              aria-label={`${on ? 'Hide' : 'Show'} ${label(k)}`}
              title={on ? 'Hide on the map' : 'Show on the map'}
              style={{ borderColor: color(k), background: on ? rgbCss([255, 255, 255], 0.06) : 'transparent' }}
            >
              {on && <Icon k={k} />}
            </button>
            <button className="legend-name" onClick={() => onOnly(k)} title="Show only this (click again for all)">
              {label(k)}
              <span className="count">{counts[k] ?? 0}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
