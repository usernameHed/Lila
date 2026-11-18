import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadMatch } from '../lib/data';
import { drawMatch } from '../lib/draw';
import { formatDay, formatDuration } from '../lib/style';
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

export function MatchList({ matches, selected, onSelect }: { matches: MatchSummary[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <ul className="matches">
      {matches.map((m) => {
        const kills = (m.events.killBot ?? 0) + (m.events.killPlayer ?? 0);
        const end = outcome(m);
        return (
          <li key={m.id}>
            <button className={m.id === selected ? 'on' : ''} onClick={() => onSelect(m.id)}>
              <span className="when">
                {formatDay(m.day)} <span className="muted">· {formatDuration(m.durationMs)}</span>
              </span>
              <span className={`end ${end === 'Survived' ? 'ok' : 'dead'}`}>{end}</span>
              <span className="who">
                {kills} kill{kills === 1 ? '' : 's'} · {m.events.loot ?? 0} loot
              </span>
              <span className="who">{m.bots ? `${m.bots} bots tracked` : ''}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The selected match on its map, with playback. */
export function ReplayStage({ summary, uvUnits }: { summary: MatchSummary | undefined; uvUnits: number }) {
  const [match, setMatch] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!summary) return setMatch(null);
    let live = true;
    setError(null);
    loadMatch(summary.id).then(
      (m) => live && setMatch(m),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [summary]);

  const current = match && match.id === summary?.id ? match : null;
  const duration = useMemo(
    () => (current ? matchEnd(current.players.map((p) => p.path), current.events.map((e) => e[0])) : 0),
    [current],
  );
  const play = usePlayback(duration, current?.id);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      if (current) drawMatch(ctx, current, uvUnits, size, play.t, play.playing);
    },
    [current, uvUnits, play.t, play.playing],
  );

  if (!summary) return <div className="empty">No match for these filters.</div>;

  return (
    <>
      <MapCanvas map={summary.map} draw={draw} />
      {error && <div className="empty">Could not load this match: {error}</div>}
      <PlaybackBar
        t={play.t}
        duration={duration}
        playing={play.playing}
        speed={play.speed}
        events={current?.events ?? []}
        onToggle={play.toggle}
        onSeek={play.seek}
        onSpeed={play.setSpeed}
      />
    </>
  );
}
