import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadMatches } from '../lib/data';
import { drawMatches } from '../lib/draw';
import { MANY_MATCHES, MATCH_COLORS, formatDay, formatDuration } from '../lib/style';
import { matchEnd } from '../lib/timeline';
import type { Match, MatchSummary } from '../lib/types';
import { MapCanvas } from './MapCanvas';
import { PlaybackBar } from './PlaybackBar';
import { usePlayback } from './usePlayback';

/** How the human's match ended, in a designer's words. No death event = they made it out (or the log ends). */
export function outcome(m: MatchSummary): string {
  const e = m.events;
  if (e.storm) return 'Died to the storm';
  if (e.diedToPlayer) return 'Killed by a player';
  if (e.diedToBot) return 'Killed by a bot';
  return 'Survived';
}

interface ListProps {
  matches: MatchSummary[];
  selected: MatchSummary[];
  mono: boolean;
  onOnly: (id: string) => void;
  onToggle: (id: string) => void;
}

/** Click a row to replay that match alone; tick boxes to replay several together. */
export function MatchList({ matches, selected, mono, onOnly, onToggle }: ListProps) {
  const order = new Map(selected.map((s, i) => [s.id, i]));
  const multi = !mono && selected.length > 1 && selected.length <= MANY_MATCHES;
  return (
    <ul className="matches">
      {matches.map((m) => {
        const kills = (m.events.killBot ?? 0) + (m.events.killPlayer ?? 0);
        const end = outcome(m);
        const i = order.get(m.id);
        const on = i !== undefined;
        return (
          <li key={m.id} className={on ? 'on' : ''}>
            <label className="pick" title="Replay together with the other ticked matches">
              <input type="checkbox" checked={on} onChange={() => onToggle(m.id)} aria-label={`Add match of ${formatDay(m.day)} to the replay`} />
              {multi && on && <span className="dot" style={{ background: MATCH_COLORS[i] }} />}
            </label>
            <button onClick={() => onOnly(m.id)}>
              <span className="when">
                {formatDay(m.day)} <span className="muted">· {formatDuration(m.durationMs)}</span>
              </span>
              <span className={`end ${end === 'Survived' ? 'ok' : 'dead'}`}>{end}</span>
              <span className="who">
                {kills} kill{kills === 1 ? '' : 's'} · {m.events.loot ?? 0} loot
              </span>
              <span className="who">
                {m.bots ? `${m.bots} bots tracked` : ''}
                {m.fights ? ` · ${m.fights} fight line${m.fights === 1 ? '' : 's'}` : ''}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Every selected match on its map, all starting together at 0:00, with one playback. */
export function ReplayStage({ summaries, uvUnits, mono }: { summaries: MatchSummary[]; uvUnits: number; mono: boolean }) {
  const [loaded, setLoaded] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = summaries.map((s) => s.id).join(',');

  useEffect(() => {
    if (!summaries.length) return setLoaded([]);
    let live = true;
    setLoading(true);
    setError(null);
    loadMatches(summaries).then(
      (ms) => live && (setLoaded(ms), setLoading(false)),
      (e: Error) => live && (setError(e.message), setLoading(false)),
    );
    return () => {
      live = false;
    };
  }, [key]); // `key` stands for `summaries`, whose array identity changes on every render

  // Keep showing the previous selection until the new one has arrived, never a half-loaded mix.
  const current = loaded.map((m) => m.id).join(',') === key ? loaded : null;
  const shown = current ?? loaded;
  const duration = useMemo(
    () => (current ? matchEnd(current.flatMap((m) => m.players.map((p) => p.path)), current.flatMap((m) => m.events.map((e) => e[0]))) : 0),
    [current],
  );
  const play = usePlayback(duration, current ? key : null);
  const events = useMemo(() => (current ?? []).flatMap((m) => m.events), [current]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      if (shown.length) drawMatches(ctx, shown, uvUnits, size, current ? play.t : Infinity, play.playing, mono);
    },
    [shown, current, uvUnits, play.t, play.playing, mono],
  );

  if (!summaries.length) return <div className="empty">No match for these filters.</div>;

  const many = summaries.length > MANY_MATCHES;
  return (
    <>
      {summaries.length > 1 && (
        <div className="stage-note">
          <strong>{summaries.length} matches</strong> replayed together, each from its own start (0:00).
          {many && <span className="muted"> Above {MANY_MATCHES} matches: one color for all players, loot hidden.</span>}
          {loading && <span className="muted"> Loading…</span>}
        </div>
      )}
      <MapCanvas map={summaries[0].map} draw={draw} />
      {error && <div className="empty">Could not load: {error}</div>}
      <PlaybackBar
        t={play.t}
        duration={duration}
        playing={play.playing}
        speed={play.speed}
        events={events}
        onToggle={play.toggle}
        onPause={play.pause}
        onSeek={play.seek}
        onSpeed={play.setSpeed}
      />
    </>
  );
}
