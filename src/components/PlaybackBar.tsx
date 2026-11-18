import { useEffect, useRef } from 'react';
import { EVENT_STYLE, formatDuration } from '../lib/style';
import type { MatchEvent } from '../lib/types';
import { SPEEDS } from './usePlayback';

/** Every storm death in the data happens after minute 10.9: the deadly-storm period, shown on the timeline. */
const STORM_FROM_MS = 10.9 * 60_000;

interface Props {
  t: number;
  duration: number;
  playing: boolean;
  speed: number;
  events: MatchEvent[];
  /** The event pointed at anywhere: its tick is highlighted and pulses. */
  active: MatchEvent | null;
  /** A group of icons hovered on the map: its members' ticks are highlighted. */
  activeGroup?: readonly MatchEvent[] | null;
  /** Legend row hovered: all its ticks are highlighted. */
  hoverKind?: string | null;
  /** Kinds hidden in the legend: no ticks for them. */
  hidden?: ReadonlySet<string>;
  onPoint: (e: MatchEvent | null) => void;
  onToggle: () => void;
  onPause: () => void;
  onSeek: (t: number) => void;
  onSpeed: (s: number) => void;
}

/** Where Space keeps its usual meaning: typing and dropdowns. Everywhere else it plays and pauses. */
export function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.closest('textarea, select')) return true;
  return el instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button', 'submit'].includes(el.type);
}

/** Play / pause, a scrubber with a tick for every fight and death, and the playback speed. Space plays. */
export function PlaybackBar({ t, duration, playing, speed, events, active, activeGroup = null, hoverKind = null, hidden, onPoint, onToggle, onPause, onSeek, onSpeed }: Props) {
  const inGroup = activeGroup ? new Set(activeGroup) : null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || isTyping(e.target)) return;
      e.preventDefault();
      if (e.repeat) return; // a held key toggles once
      // A focused button or checkbox would also act on Space (on key up): take the focus off it first.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      onToggle();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onToggle]);

  // One tick per fight or death (not loot, unless loot is hovered); past a few hundred they would blur into a bar,
  // so then only the hovered kind's ticks are drawn. The pointed-at event always gets its tick, pulsing.
  const shown = events.filter((e) => !hidden?.has(e[1]));
  const fights = shown.filter((e) => e[1] !== 'loot');
  const lit = hoverKind ? shown.filter((e) => e[1] === hoverKind) : [];
  // Up to 300: one element per tick (hover, click). Beyond: all of them drawn on a canvas strip, and only the
  // hovered kind (if not too many) as live ticks on top.
  const many = fights.length > 300;
  const ticks = [...(many ? [] : fights.filter((e) => e[1] !== hoverKind)), ...(lit.length <= 400 ? lit : [])];

  return (
    <div className="playback">
      <button className="play" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'} title="Play / pause (Space)">
        {playing ? (
          <svg viewBox="0 0 16 16" width="16" height="16"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 2.5v11l9.5-5.5z" fill="currentColor" /></svg>
        )}
      </button>
      <span className="clock">
        {formatDuration(t)} <span className="muted">/ {formatDuration(duration)}</span>
      </span>
      <div className="scrub">
        {duration > STORM_FROM_MS && (
          <div
            className="storm-band"
            style={{ left: `${(STORM_FROM_MS / duration) * 100}%` }}
            title="Storm deaths happen only from minute 10.9 on (seen in the data). Where the storm is, is not logged: it is needed in the telemetry next time."
          >
            storm
          </div>
        )}
        {many && duration > 0 && <TickStrip events={fights} duration={duration} hoverKind={hoverKind} />}
        <div className="ticks">
          {duration > 0 &&
            ticks.map((e, i) => (
              <span
                key={i}
                className={e === active ? 'active' : e[1] === hoverKind || inGroup?.has(e) ? 'lit' : hoverKind || inGroup ? 'dim' : ''}
                style={{ left: `${(e[0] / duration) * 100}%`, background: EVENT_STYLE[e[1]].color }}
                onMouseEnter={() => onPoint(e)}
                onMouseLeave={() => onPoint(null)}
                onClick={() => onSeek(e[0])}
                title={`${formatDuration(e[0])} · ${EVENT_STYLE[e[1]].label}`}
              />
            ))}
          {active && duration > 0 && !ticks.includes(active) && (
            <span className="active" style={{ left: `${(active[0] / duration) * 100}%`, background: EVENT_STYLE[active[1]].color }} />
          )}
        </div>
        <input
          type="range"
          min={0}
          max={duration}
          step={250}
          value={t}
          onChange={(e) => onSeek(Number(e.target.value))}
          onPointerDown={onPause} // grabbing the timeline stops the replay where you drop it
          aria-label="Match time"
        />
      </div>
      <div className="speeds" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button key={s} className={s === speed ? 'on' : ''} onClick={() => onSpeed(s)}>
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}

/** Thousands of ticks at once: thin see-through lines on a canvas (denser = more fights at that moment). */
function TickStrip({ events, duration, hoverKind }: { events: MatchEvent[]; duration: number; hoverKind: string | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const draw = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      el.width = w * dpr;
      el.height = h * dpr;
      const ctx = el.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      for (const e of events) {
        const lit = e[1] === hoverKind;
        ctx.globalAlpha = hoverKind ? (lit ? 0.9 : 0.08) : 0.25;
        ctx.fillStyle = EVENT_STYLE[e[1]].color;
        ctx.fillRect(Math.round((e[0] / duration) * w), lit ? 0 : h * 0.35, 1, lit ? h : h * 0.65);
      }
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    return () => ro.disconnect();
  }, [events, duration, hoverKind]);
  return <canvas ref={ref} className="tick-strip" aria-hidden />;
}
