import { useEffect } from 'react';
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
export function PlaybackBar({ t, duration, playing, speed, events, active, onPoint, onToggle, onPause, onSeek, onSpeed }: Props) {
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

  // One tick per fight or death; past a few hundred they would only blur into a bar, so none are drawn.
  const fights = events.filter((e) => e[1] !== 'loot');
  const ticks = fights.length <= 300 ? fights : [];

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
        <div className="ticks">
          {duration > 0 &&
            ticks.map((e, i) => (
              <span
                key={i}
                className={e === active ? 'active' : ''}
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
