import { formatDuration } from '../lib/style';
import type { Story } from '../lib/story';

interface Props {
  story: Story;
  title: string; // e.g. "Lockdown · 10 Feb"
  onSeek: (t: number) => void;
  onClose: () => void;
  onOnlyThisMatch?: () => void;
}

/** Everything about one player in one match: identity, numbers, every event (click to jump there), fights. */
export function PlayerCard({ story: s, title, onSeek, onClose, onOnlyThisMatch }: Props) {
  return (
    <aside className="player-card" aria-label="Player details">
      <header>
        <div>
          <strong>{s.bot ? `Bot ${s.id}` : 'Player'}</strong>
          <span className="muted"> · {title}</span>
          {!s.bot && <div className="muted mono">{s.id}</div>}
        </div>
        <button className="close" onClick={onClose} aria-label="Close details">×</button>
      </header>
      <dl className="facts">
        <div><dt>Ended</dt><dd>{s.end.charAt(0).toUpperCase() + s.end.slice(1)}</dd></div>
        <div><dt>In the match</dt><dd>{formatDuration(s.firstMs)} → {formatDuration(s.lastMs)}</dd></div>
        <div><dt>Walked</dt><dd>{Math.round(s.meters).toLocaleString('en')} m</dd></div>
        <div><dt>Height</dt><dd>{Math.round(s.heightMin)}-{Math.round(s.heightMax)} m</dd></div>
      </dl>
      {s.fights.length > 0 && (
        <>
          <h4>Line of fire</h4>
          <ul className="story">
            {s.fights.map((f, i) => (
              <li key={i}>
                <button onClick={() => onSeek(f.t)}>
                  <span className="time">{formatDuration(f.t)}</span>
                  {f.role === 'killer' ? 'Killed' : 'Killed by'} {f.otherBot ? 'a bot' : 'a player'} {Math.round(f.meters)} m away
                  {f.inferred && <span className="muted"> (inferred)</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h4>Events ({s.events.length})</h4>
      <ul className="story">
        {s.events.map((e, i) => (
          <li key={i}>
            <button onClick={() => onSeek(e.t)}>
              <span className="time">{formatDuration(e.t)}</span>
              {e.label}
            </button>
          </li>
        ))}
        {!s.events.length && <li className="muted">No events recorded</li>}
      </ul>
      {onOnlyThisMatch && (
        <button className="go-btn" onClick={onOnlyThisMatch}>
          Replay only this match
        </button>
      )}
      <p className="muted small">Click an event to jump there. Dashed: where this player goes next.</p>
    </aside>
  );
}
