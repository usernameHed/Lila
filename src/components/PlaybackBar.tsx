import { useEffect } from 'react';
import { EVENT_STYLE, formatDuration } from '../lib/style';
import type { MatchEvent } from '../lib/types';
import { SPEEDS } from './usePlayback';

interface Props {
  t: number;
  duration: number;
  playing: boolean;
  speed: number;
  events: MatchEvent[];
  onToggle: () => void;
  onSeek: (t: number) => void;
  onSpeed: (s: number) => void;
}

/** Play / pause, a scrubber with a tick for every fight and death, and the playback speed. Space plays. */
export function PlaybackBar({ t, duration, playing, speed, events, onToggle, onSeek, onSpeed }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || (e.target as HTMLElement).closest('input, select, textarea')) return;
      e.preventDefault();
      onToggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onToggle]);

  const ticks = events.filter((e) => e[1] !== 'loot');

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
        <div className="ticks" aria-hidden>
          {duration > 0 &&
            ticks.map((e, i) => (
              <span key={i} style={{ left: `${(e[0] / duration) * 100}%`, background: EVENT_STYLE[e[1]].color }} />
            ))}
        </div>
        <input
          type="range"
          min={0}
          max={duration}
          step={250}
          value={t}
          onChange={(e) => onSeek(Number(e.target.value))}
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
