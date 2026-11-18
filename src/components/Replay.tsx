import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { loadMatches, loadTerrain } from '../lib/data';
import { drawFocus, drawMatches, type LegendKey } from '../lib/draw';
import { pickPlayer, type Focus } from '../lib/pick';
import { playerStory } from '../lib/story';
import { HEIGHT_RAMP, MANY_MATCHES, MAP_LABEL, MATCH_COLORS, formatDay, formatDuration } from '../lib/style';
import { matchEnd } from '../lib/timeline';
import type { MapConfig, Match, MatchSummary, Terrain } from '../lib/types';
import { Choice } from './Choice';
import { MapCanvas, type MapPick } from './MapCanvas';
import { PlayerCard } from './PlayerCard';
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
interface StageProps {
  summaries: MatchSummary[];
  uvUnits: number;
  mono: boolean;
  hidden: LegendKey[];
  hover: LegendKey | null;
  /** Draws a heatmap under the replay, or nothing. */
  under: ((ctx: CanvasRenderingContext2D, size: number) => void) | null;
  mapConfig: MapConfig;
  view3d: boolean;
  colorBy: 'player' | 'height';
  exaggeration: number;
  terrain: boolean;
  onView: (patch: { view3d?: boolean; colorBy?: 'player' | 'height'; exaggeration?: number; terrain?: boolean }) => void;
  /** Replay only this match (from the details card). */
  onOnlyMatch: (id: string) => void;
}

const Map3D = lazy(() => import('./Map3D'));

/** The map's estimated terrain, loaded only when the 3D view needs it. */
function useTerrain(map: MapConfig['id'] | null): Terrain | null {
  const [terrain, setTerrain] = useState<Terrain | null>(null);
  useEffect(() => {
    if (!map) return setTerrain(null);
    let live = true;
    loadTerrain(map).then((t) => live && setTerrain(t));
    return () => {
      live = false;
    };
  }, [map]);
  return terrain;
}

/** A clock for the legend hover pulse: ticks every frame only while something is hovered. */
function usePulse(active: boolean): number {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = (now: number) => {
      setPhase(now);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);
  return phase;
}

export function ReplayStage({ summaries, uvUnits, mono, hidden, hover, under, mapConfig, view3d, colorBy, exaggeration, terrain, onView, onOnlyMatch }: StageProps) {
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
  const phase = usePulse(!!hover);
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const events = useMemo(() => (current ?? []).flatMap((m) => m.events), [current]);
  // The player clicked on the map: highlighted, with a details card. Dropped when the selection changes.
  const [focus, setFocus] = useState<Focus | null>(null);
  useEffect(() => setFocus(null), [key]);
  const focusMatch = focus ? shown.find((m) => m.id === focus.match) : undefined;
  const story = useMemo(
    () => (focusMatch && focus ? playerStory(focusMatch, focus.player, uvUnits, mapConfig.scale) : null),
    [focusMatch, focus, uvUnits, mapConfig.scale],
  );
  const onPick = useCallback(
    ({ u, v, tolerance }: MapPick) => setFocus(pickPlayer(shown, current ? play.t : Infinity, u, v, tolerance)),
    [shown, current, play.t],
  );
  const terrainData = useTerrain(view3d && terrain ? mapConfig.id : null);
  const heightRange = useMemo(
    () => (colorBy === 'height' ? { min: mapConfig.hMin * 10, max: mapConfig.hMax * 10 } : null),
    [colorBy, mapConfig],
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      under?.(ctx, size);
      if (shown.length)
        drawMatches(ctx, shown, uvUnits, size, current ? play.t : Infinity, play.playing, { mono, hidden: hiddenSet, hover, phase, heightRange });
      if (focusMatch && focus) drawFocus(ctx, focusMatch, focus.player, uvUnits, size, current ? play.t : Infinity);
    },
    [shown, current, uvUnits, play.t, play.playing, mono, hiddenSet, hover, phase, under, heightRange, focusMatch, focus],
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
      <div className="stage-tools">
        <Choice label="View" options={[['2d', '2D'], ['3d', '3D']]} value={view3d ? '3d' : '2d'} onChange={(v) => onView({ view3d: v === '3d' })} />
        <Choice label="Color paths by" options={[['player', 'By player'], ['height', 'By height']]} value={colorBy} onChange={(c) => onView({ colorBy: c })} />
        {colorBy === 'height' && (
          <span className="height-scale" title="Height above sea level, from the data's y">
            {Math.round(mapConfig.hMin)} m <span className="ramp" style={{ background: HEIGHT_RAMP }} /> {Math.round(mapConfig.hMax)} m
          </span>
        )}
        {view3d && (
          <Choice
            label="Ground"
            options={[['terrain', 'Terrain'], ['flat', 'Flat']]}
            value={terrain ? 'terrain' : 'flat'}
            onChange={(g) => onView({ terrain: g === 'terrain' })}
          />
        )}
        {view3d && (
          <label className="exaggeration" title="Stretch heights so the relief shows">
            Height x{exaggeration}
            <input type="range" min={1} max={8} step={1} value={exaggeration} onChange={(e) => onView({ exaggeration: Number(e.target.value) })} />
          </label>
        )}
      </div>
      <div className="stage-main">
      {view3d ? (
        <Suspense fallback={<div className="empty">Loading 3D…</div>}>
          <Map3D
            map={mapConfig}
            matches={shown}
            uvUnits={uvUnits}
            t={current ? play.t : Infinity}
            hidden={hiddenSet}
            byHeight={colorBy === 'height'}
            mono={mono}
            exaggeration={exaggeration}
            terrain={terrain ? terrainData : null}
            overlay={under}
            focus={focus}
            onFocus={setFocus}
          />
        </Suspense>
      ) : (
        <MapCanvas map={summaries[0].map} draw={draw} dim={under ? 0.4 : 0} uvUnits={uvUnits} onPick={onPick} />
      )}
      {story && focus && (
        <PlayerCard
          story={story}
          title={`${MAP_LABEL[mapConfig.id]} · ${formatDay(focusMatch!.day)}`}
          onSeek={(t) => {
            play.pause();
            play.seek(t);
          }}
          onClose={() => setFocus(null)}
          onOnlyThisMatch={summaries.length > 1 ? () => onOnlyMatch(focus.match) : undefined}
        />
      )}
      </div>
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
