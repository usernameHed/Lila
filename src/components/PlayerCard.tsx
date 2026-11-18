import { formatDuration } from '../lib/style';
import type { Story, StoryEvent } from '../lib/story';
import type { MatchEvent } from '../lib/types';

interface Props {
  story: Story;
  title: string; // e.g. "Lockdown · 10 Feb"
  /** The event pointed at (here, on the map or the timeline): its row is highlighted and pulses. */
  active: MatchEvent | null;
  onPoint: (e: MatchEvent | null) => void;
  onSeek: (e: StoryEvent) => void;
  onClose: () => void;
  onOnlyThisMatch?: () => void;
  /** Open the other side of a fight. */
  onFocusOther: (player: number) => void;
}

/** Everything about one player in one match: identity, numbers, every event (click to jump there), fights. */
export function PlayerCard({ story: s, title, active, onPoint, onSeek, onClose, onOnlyThisMatch, onFocusOther }: Props) {
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
      {s.pvpMissing && (
        <p className="pvp-note">
          <b>Player vs player:</b> the other player is not in the data. Their file is missing: only this side was logged, with
          the kill and the death at the same second and spot (a trade, or a self-kill). No line of fire can be drawn.
        </p>
      )}
      {s.fights.length > 0 && (
        <>
          <h4>Line of fire · highlighted on the map</h4>
          <ul className="story">
            {s.fights.map((f, i) => (
              <li key={i}>
                <button onClick={() => {
                  const e = s.events.find((x) => x.t === f.t && (x.type === 'killBot' || x.type === 'killPlayer' || x.type.startsWith('diedTo') || x.type === 'botKill' || x.type === 'botDeath'));
                  if (e) onSeek(e);
                }}>
                  <span className="time">{formatDuration(f.t)}</span>
                  {f.role === 'killer' ? 'Killed' : 'Killed by'} {f.otherBot ? 'a bot' : 'a player'} {Math.round(f.meters)} m away
                  {f.inferred && <span className="muted"> (inferred)</span>}
                </button>
                <button className="other" onClick={() => onFocusOther(f.other)} title="Open the other side of this fight">
                  {f.otherBot ? 'Bot' : 'Player'} →
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h4>Events ({s.events.length})</h4>
      <ul className="story">
        {s.events.map((e, i) => (
          <li key={i} className={e.ref === active ? 'active' : ''} ref={e.ref === active ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}>
            <button onClick={() => onSeek(e)} onMouseEnter={() => onPoint(e.ref)} onMouseLeave={() => onPoint(null)}>
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
