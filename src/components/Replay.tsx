import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { loadMatches, loadTerrain } from '../lib/data';
import { drawFocus, drawMatches, type LegendKey } from '../lib/draw';
import { pickEvent, pickPlayer, type Focus, type PointedEvent } from '../lib/pick';
import { playerStory } from '../lib/story';
import { MANY_MATCHES, MAP_LABEL, MATCH_COLORS, formatDay, formatDuration } from '../lib/style';
import { endedOf } from '../lib/matchFilter';
import { matchEnd } from '../lib/timeline';
import type { MapConfig, Match, MatchEvent, MatchSummary, Terrain } from '../lib/types';
import { Choice } from './Choice';
import { MapCanvas, type MapPick } from './MapCanvas';
import { PlayerCard } from './PlayerCard';
import { PlaybackBar } from './PlaybackBar';
import { usePlayback } from './usePlayback';

interface ListProps {
  matches: MatchSummary[];
  selected: MatchSummary[];
  mono: boolean;
  onOnly: (id: string) => void;
  onToggle: (id: string) => void;
  /** Tick or untick several at once (a whole day). */
  onSetMany: (ids: string[], on: boolean) => void;
  /** Grouped by day (the default order); otherwise one flat list in the chosen order. */
  grouped: boolean;
}

const ENDED_SHORT: Record<ReturnType<typeof endedOf>, string> = { storm: 'Storm', player: 'Player', bot: 'Bot', survived: 'Survived' };
const ENDED_LONG: Record<ReturnType<typeof endedOf>, string> = {
  storm: 'Died to the storm',
  player: 'Killed by a player',
  bot: 'Killed by a bot',
  survived: 'Survived (no death logged)',
};

/**
 * Matches grouped by day. A day folds and unfolds, and its box ticks or unticks all of its matches. One line per
 * match: duration, how it ended, kills and loot. Click a line to replay that match alone; tick boxes for several.
 */
export function MatchList({ matches, selected, mono, onOnly, onToggle, onSetMany, grouped }: ListProps) {
  const order = new Map(selected.map((s, i) => [s.id, i]));
  const multi = !mono && selected.length > 1 && selected.length <= MANY_MATCHES;
  const days = useMemo(() => {
    if (!grouped) return [['', matches] as [string, MatchSummary[]]];
    const by = new Map<string, MatchSummary[]>();
    for (const m of matches) by.set(m.day, [...(by.get(m.day) ?? []), m]);
    return [...by.entries()];
  }, [matches, grouped]);
  // Open: days holding a selected match (or the only day).
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    setOpen(new Set(days.length === 1 ? [days[0][0]] : selected.length < 20 ? selected.map((m) => m.day) : []));
  }, [days.length, matches]); // re-open on a new filter, not on every tick
  return (
    <div className="day-groups">
      {days.map(([day, list]) => {
        const picked = list.filter((m) => order.has(m.id)).length;
        const isOpen = !grouped || open.has(day);
        return (
          <section key={day || 'all'} className="day-group">
            {grouped && <header>
              <input
                type="checkbox"
                checked={picked === list.length}
                ref={(el) => {
                  if (el) el.indeterminate = picked > 0 && picked < list.length;
                }}
                onChange={() => onSetMany(list.map((m) => m.id), picked < list.length)}
                aria-label={`Select every match of ${formatDay(day)}`}
              />
              <button className="day-toggle" onClick={() => setOpen((o) => new Set(o.has(day) ? [...o].filter((d) => d !== day) : [...o, day]))} aria-expanded={isOpen}>
                <span className="caret">{isOpen ? '▾' : '▸'}</span>
                {formatDay(day)}
                {day === '2026-02-14' && <span className="muted"> (partial)</span>}
                <span className="count">{picked ? `${picked} / ${list.length}` : list.length}</span>
              </button>
            </header>}
            {isOpen && (
              <ul className="matches">
                {list.map((m, n) => {
                  const kills = (m.events.killBot ?? 0) + (m.events.killPlayer ?? 0);
                  const end = endedOf(m);
                  const i = order.get(m.id);
                  const on = i !== undefined;
                  return (
                    <li key={m.id} className={on ? 'on' : ''}>
                      <label className="pick" title="Replay together with the other ticked matches">
                        <input type="checkbox" checked={on} onChange={() => onToggle(m.id)} aria-label={`Add match ${n + 1} of ${formatDay(m.day)}`} />
                        {multi && on && <span className="dot" style={{ background: MATCH_COLORS[i] }} />}
                      </label>
                      <button onClick={() => onOnly(m.id)} title={`${formatDay(m.day)} · ${ENDED_LONG[end]} · ${kills} kills · ${m.events.loot ?? 0} loot${m.bots ? ` · ${m.bots} bots recorded` : ''}${m.fights ? ` · ${m.fights} fight lines` : ''}`}>
                        <span className="num">{grouped ? `#${n + 1}` : formatDay(m.day).replace(' Feb', '')}</span>
                        <span className="dur">{formatDuration(m.durationMs)}</span>
                        <span className={`end ${end === 'survived' ? 'ok' : 'dead'}`}>
                          {ENDED_SHORT[end]}
                        </span>
                        <span className="m-stats">
                          {m.bots > 0 && <span className="linked" title="Bots recorded too: fights from both sides">⇄ </span>}
                          {kills}
                          <small className="k" title="kills"> ✕</small> {m.events.loot ?? 0}
                          <small className="l" title="loot"> ◆</small>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

interface StageProps {
  summaries: MatchSummary[];
  uvUnits: number;
  mono: boolean;
  hidden: LegendKey[];
  /** Legend row under the mouse. */
  hover: LegendKey | null;
  /** Tells the legend which kind is pointed at on the map, timeline or card (its row pulses). */
  onPointedKind: (k: LegendKey | null) => void;
  /** Draws the heatmap under the replay, or nothing. */
  under: ((ctx: CanvasRenderingContext2D, size: number) => void) | null;
  mapConfig: MapConfig;
  view3d: boolean;
  exaggeration: number;
  terrain: boolean;
  onView: (patch: { view3d?: boolean; exaggeration?: number; terrain?: boolean }) => void;
  /** Replay only this match (from the details card). */
  onOnlyMatch: (id: string) => void;
  iconScale: number;
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

/** An animation clock (ms) that ticks every frame only while something pulses. */
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

/** Every selected match on its map, all starting together at 0:00, with one playback. */
export function ReplayStage(props: StageProps) {
  const { summaries, uvUnits, mono, hidden, hover, onPointedKind, under, mapConfig, view3d, exaggeration, terrain, onView, onOnlyMatch, iconScale } = props;
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
  const t = current ? play.t : Infinity;
  const hiddenSet = useMemo(() => new Set<LegendKey>(hidden), [hidden]);
  const events = useMemo(() => (current ?? []).flatMap((m) => m.events), [current]);

  // The player clicked (highlighted, with a details card), the event clicked (pinned), and the event under the
  // mouse anywhere: map, timeline or card. All three are linked: what is pointed at pulses everywhere it shows.
  const [focus, setFocus] = useState<Focus | null>(null);
  const [pinned, setPinned] = useState<PointedEvent | null>(null);
  const [pointed, setPointed] = useState<PointedEvent | null>(null);
  useEffect(() => {
    setFocus(null);
    setPinned(null);
    setPointed(null);
  }, [key]);
  const active = pointed ?? pinned;
  useEffect(() => onPointedKind(active ? active.event[1] : null), [active, onPointedKind]);
  const phase = usePulse(!!hover || !!active);

  const focusMatch = focus ? shown.find((m) => m.id === focus.match) : undefined;
  const story = useMemo(
    () => (focusMatch && focus ? playerStory(focusMatch, focus.player, uvUnits, mapConfig.scale) : null),
    [focusMatch, focus, uvUnits, mapConfig.scale],
  );

  /** A click on an event: pin it and open its player's card; elsewhere on a path: that player; else clear. */
  const pickAt = useCallback(
    (ev: PointedEvent | null, player: Focus | null) => {
      if (ev) {
        setPinned(ev);
        setFocus({ match: ev.match, player: ev.event[4] });
      } else {
        setPinned(null);
        setFocus(player);
      }
    },
    [],
  );
  const onPick = useCallback(
    ({ u, v, tolerance }: MapPick) => pickAt(pickEvent(shown, t, u, v, tolerance, hiddenSet), pickPlayer(shown, t, u, v, tolerance)),
    [shown, t, hiddenSet, pickAt],
  );
  const onHoverMap = useCallback(
    (p: MapPick | null) => setPointed(p ? pickEvent(shown, t, p.u, p.v, p.tolerance, hiddenSet) : null),
    [shown, t, hiddenSet],
  );
  const pointAt = useCallback((e: MatchEvent | null) => {
    if (!e) return setPointed(null);
    const m = shown.find((x) => x.events.includes(e));
    setPointed(m ? { match: m.id, event: e } : null);
  }, [shown]);

  const terrainData = useTerrain(view3d && terrain ? mapConfig.id : null);
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      under?.(ctx, size);
      if (shown.length) drawMatches(ctx, shown, uvUnits, size, t, play.playing, { mono, hidden: hiddenSet, hover, phase, activeEvent: active?.event ?? null, iconScale });
      if (focusMatch && focus) drawFocus(ctx, focusMatch, focus.player, uvUnits, size, t, active?.event ?? null, phase, story?.opponents ?? []);
    },
    [shown, t, uvUnits, play.playing, mono, hiddenSet, hover, phase, under, focusMatch, focus, active, story, iconScale],
  );

  if (!summaries.length) return <div className="empty">No match for these filters.</div>;

  const many = summaries.length > MANY_MATCHES;
  const seek = (time: number) => {
    play.pause();
    play.seek(time);
  };
  return (
    <>
      <div className="stage-tools">
        <Choice label="View" options={[['2d', '2D'], ['3d', '3D']]} value={view3d ? '3d' : '2d'} onChange={(v) => onView({ view3d: v === '3d' })} />
        {view3d && (
          <Choice label="Ground" options={[['terrain', 'Terrain'], ['flat', 'Flat']]} value={terrain ? 'terrain' : 'flat'} onChange={(g) => onView({ terrain: g === 'terrain' })} />
        )}
        {view3d && (
          <label className="exaggeration" title="Stretch heights so the relief shows">
            Height x{exaggeration}
            <input type="range" min={1} max={8} step={1} value={exaggeration} onChange={(e) => onView({ exaggeration: Number(e.target.value) })} />
          </label>
        )}
        {summaries.length > 1 && (
          <span className="stage-note">
            <strong>{summaries.length} matches</strong> together, each from its own 0:00.
            {many && <span className="muted"> One color for all above {MANY_MATCHES}.</span>}
            {loading && <span className="muted"> Loading…</span>}
          </span>
        )}
      </div>
      <div className="stage-main">
        {view3d ? (
          <Suspense fallback={<div className="empty">Loading 3D…</div>}>
            <Map3D
              map={mapConfig}
              matches={shown}
              uvUnits={uvUnits}
              t={t}
              hidden={hiddenSet}
              mono={mono}
              exaggeration={exaggeration}
              terrain={terrain ? terrainData : null}
              overlay={under}
              focus={focus}
              focusOpponents={story?.opponents ?? []}
              onFocus={(f) => pickAt(null, f)}
              hoverKind={hover}
              activeEvent={active?.event ?? null}
              onPointEvent={pointAt}
              iconScale={iconScale}
              onPickEvent={(e) => {
                const m = shown.find((x) => x.events.includes(e));
                if (m) pickAt({ match: m.id, event: e }, null);
              }}
            />
          </Suspense>
        ) : (
          <MapCanvas map={summaries[0].map} draw={draw} dim={0} uvUnits={uvUnits} onPick={onPick} onHover={onHoverMap} pointer={!!pointed} />
        )}
        {story && focus && (
          <PlayerCard
            story={story}
            title={`${MAP_LABEL[mapConfig.id]} · ${formatDay(focusMatch!.day)}`}
            active={active?.event ?? null}
            onPoint={pointAt}
            onSeek={(e) => {
              seek(e.t);
              setPinned({ match: focus.match, event: e.ref });
            }}
            onClose={() => {
              setFocus(null);
              setPinned(null);
            }}
            onOnlyThisMatch={summaries.length > 1 ? () => onOnlyMatch(focus.match) : undefined}
            onFocusOther={(player) => {
              setPinned(null);
              setFocus({ match: focus.match, player });
            }}
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
        active={active?.event ?? null}
        hoverKind={hover}
        hidden={hiddenSet}
        onPoint={pointAt}
        onToggle={play.toggle}
        onPause={play.pause}
        onSeek={play.seek}
        onSpeed={play.setSpeed}
      />
    </>
  );
}
