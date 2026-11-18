import { useEffect, useRef } from 'react';
import { drawFightLine, drawMarker, type LegendKey } from '../lib/draw';
import { EVENT_STYLE, FIRE_COLOR, PATH_COLOR } from '../lib/style';
import type { EventType } from '../lib/types';

/** Every row of the legend, in order: the two path kinds, every event type, the killer-to-victim lines. */
export const LEGEND_KEYS: LegendKey[] = ['humanPath', 'botPath', ...(Object.keys(EVENT_STYLE) as EventType[]), 'fights'];

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
  }, [k]);
  return <canvas ref={ref} style={{ width: 18, height: 18 }} aria-hidden />;
}

export const legendLabel = (k: LegendKey) =>
  k === 'humanPath' ? 'Player path' : k === 'botPath' ? 'Bot path' : k === 'fights' ? 'Killer to victim (line of fire)' : EVENT_STYLE[k].label;
const color = (k: LegendKey) => (k === 'humanPath' ? PATH_COLOR.human : k === 'botPath' ? PATH_COLOR.bot : k === 'fights' ? FIRE_COLOR : EVENT_STYLE[k].color);

interface Props {
  counts: Partial<Record<LegendKey, number>>;
  hidden: LegendKey[];
  /** The kind pointed at on the map, the timeline or the card: its row pulses. */
  active: LegendKey | null;
  onToggle: (k: LegendKey) => void;
  onAll: (show: boolean) => void;
  onHover: (k: LegendKey | null) => void;
  /** Rows to pulse because their partner in the heatmap card is hovered or was just ticked. */
  linked: LegendKey[];
  /** Show (or hide, with null) the explanation of a row next to it. */
  onTip: (k: LegendKey | null, el?: HTMLElement) => void;
}

/** Click a row to show or hide that kind; hover it to spot it on the map (future ones shown faded). */
export function Legend({ counts, hidden, active, onToggle, onAll, onHover, linked, onTip }: Props) {
  return (
    <>
      <div className="all-none">
        <button onClick={() => onAll(true)} disabled={!hidden.length}>
          All
        </button>
        <button onClick={() => onAll(false)} disabled={hidden.length === LEGEND_KEYS.length}>
          None
        </button>
      </div>
      <ul className="legend">
        {LEGEND_KEYS.map((k) => {
          const on = !hidden.includes(k);
          const isPath = k === 'humanPath' || k === 'botPath';
          return (
            <li
              key={k}
              className={`${on ? '' : 'off'} ${counts[k] || isPath ? '' : 'none'} ${active === k || linked.includes(k) ? 'pulse' : ''}`}
              onMouseEnter={(e) => {
                if (on) onHover(k);
                onTip(k, e.currentTarget);
              }}
              onMouseLeave={() => {
                onHover(null);
                onTip(null);
              }}
            >
              <button className="legend-row" onClick={() => onToggle(k)} aria-pressed={on}>
                <span className="legend-box" style={{ borderColor: color(k) }}>
                  {on && <Icon k={k} />}
                </span>
                <span className="legend-label">{legendLabel(k)}</span>
                {!isPath && <span className="count">{counts[k] ?? 0}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
