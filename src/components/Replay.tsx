import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadMatches, loadTerrain } from '../lib/data';
import { drawFocus, drawMatches, type LegendKey } from '../lib/draw';
import { pickEvent, pickPlayer, type Focus, type PointedEvent } from '../lib/pick';
import { playerStory } from '../lib/story';
import { MANY_MATCHES, MAP_LABEL, MATCH_COLORS, PATH_COLOR, formatDay, formatDuration } from '../lib/style';
import { endedOf } from '../lib/matchFilter';
import { matchEnd } from '../lib/timeline';
import type { MapConfig, Match, MatchEvent, MatchSummary, Terrain } from '../lib/types';
import { Choice } from './Choice';
import { LegendIcon } from './Legend';
import { ErrorBoundary } from './ErrorBoundary';
import { Loader } from './Loader';
import { MapCanvas, type MapPick } from './MapCanvas';
import { PlayerCard } from './PlayerCard';
import { PlaybackBar } from './PlaybackBar';
import { usePlayback } from './usePlayback';
import { useSourceId } from './useSourceId';

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

const ENDED_SHORT: Record<ReturnType<typeof endedOf>, string> = { storm: 'Storm', player: 'By player', bot: 'By bot', survived: 'Survived' };
/** The icon of how the run ended, as on the map. */
const ENDED_ICON: Record<ReturnType<typeof endedOf>, LegendKey | null> = { storm: 'storm', player: 'diedToPlayer', bot: 'diedToBot', survived: null };
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
                      <label className="pick" data-tip="Replay together with the other ticked matches">
                        <input type="checkbox" checked={on} onChange={() => onToggle(m.id)} aria-label={`Add match ${n + 1} of ${formatDay(m.day)}`} />
                        {multi && on && <span className="dot" style={{ background: MATCH_COLORS[i] }} />}
                      </label>
                      <button onClick={() => onOnly(m.id)} data-tip={`${formatDay(m.day)} · ${ENDED_LONG[end]} · ${kills} kills · ${m.events.loot ?? 0} loot${m.bots ? ` · ${m.bots} bots recorded` : ''}${m.fights ? ` · ${m.fights} fight lines` : ''}`}>
                        <span className="num">{grouped ? `#${n + 1}` : formatDay(m.day).replace(' Feb', '')}</span>
                        <span className="dur">{formatDuration(m.durationMs)}</span>
                        <span className={`end ${end === 'survived' ? 'ok' : 'dead'}`}>
                          {ENDED_ICON[end] && <LegendIcon k={ENDED_ICON[end]!} size={14} />}
                          {ENDED_SHORT[end]}
                        </span>
                        <span className="m-stats">
                          {m.bots > 0 && <span className="linked" data-tip="Bots recorded too: fights from both sides">⇄ </span>}
                          <span data-tip="bots and players killed">{kills}</span>
                          <LegendIcon k="killBot" size={13} />
                          <span data-tip="items looted">{m.events.loot ?? 0}</span>
                          <LegendIcon k="loot" size={13} />
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
  onView: (patch: { view3d?: boolean; exaggeration?: number; terrain?: boolean; mono?: boolean }) => void;
  /** Replay only this match (from the details card). */
  iconScale: number;
  pathWidth: number;
  pathAlpha: number;
  /** Shown over the empty map when no match is replayed. */
  emptyHint: string;
  /** Players picked (view state: undo / redo, links). */
  picked: Focus[];
  /** Matches unticked in the list (hidden from the map), or, when not empty, the only ones ticked. */
  offMap: string[];
  onlyMap: string[];
  /** Players or bots unticked under their match ("match.player"). */
  offPlayers: string[];
  /** Changes the ticks and the picked players in one step (one undo). */
  onSelect: (p: { offMap?: string[]; onlyMap?: string[]; picked?: Focus[]; offPlayers?: string[] }) => void;
  /** The match filters, shown at the top of the "On the map" panel. */
  filters?: React.ReactNode;
  /** Undo / redo buttons, shown after the zoom buttons. */
  history?: React.ReactNode;
  onPicked: (p: Focus[]) => void;
}

const Map3D = lazy(() => import('./Map3D'));
const noDraw = () => undefined;

/** The map's estimated terrain, loaded only when the 3D view needs it. */
function useTerrain(map: MapConfig['id'] | null): Terrain | null {
  const [terrain, setTerrain] = useState<Terrain | null>(null);
  const source = useSourceId();
  useEffect(() => {
    if (!map) return setTerrain(null);
    let live = true;
    loadTerrain(map).then((t) => live && setTerrain(t), () => live && setTerrain(null));
    return () => {
      live = false;
    };
  }, [map, source]);
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

/** 0 -> 1 when `on`, back to 0 when not, eased in and out over `ms`: fades never jump in one frame. */
function useEase(on: boolean, ms = 280): number {
  const [value, setValue] = useState(0);
  const now = useRef(0);
  useEffect(() => {
    const from = now.current;
    const to = on ? 1 : 0;
    if (from === to) return;
    const start = performance.now();
    const span = ms * Math.abs(to - from);
    let frame = 0;
    const tick = (time: number) => {
      const k = Math.min(1, (time - start) / span);
      const eased = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // ease in-out
      now.current = from + (to - from) * eased;
      setValue(now.current);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [on, ms]);
  return value;
}

/** Keeps the last non-null value while `fading` (so what was hovered stays bright while the rest fades back). */
function useLast<T>(value: T | null, fading: boolean): T | null {
  const last = useRef<T | null>(value);
  if (value !== null) last.current = value;
  else if (!fading) last.current = null;
  return value ?? last.current;
}

/** Every selected match on its map, all starting together at 0:00, with one playback. */
export function ReplayStage(props: StageProps) {
  const { summaries, uvUnits, mono, hidden, hover, onPointedKind, under, mapConfig, view3d, exaggeration, terrain, onView, iconScale, pathWidth, pathAlpha, emptyHint, picked, onPicked, offMap, onlyMap, onSelect, offPlayers } = props;
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

  // The player clicked (highlighted, with a details card), the event clicked (pinned), and the event under the
  // mouse anywhere: map, timeline or card. All three are linked: what is pointed at pulses everywhere it shows.
  // The players picked are part of the view (undo / redo, links): the last one's card is open.
  const picks = useMemo(() => picked.filter((f) => shown.some((m) => m.id === f.match)), [picked, shown]);
  const focus = picks.length ? picks[picks.length - 1] : null;
  // With something picked, only the picked matches show (map, 3D, timeline); the others are hidden, not dimmed.
  // Ticked in the "On the map" list = selected = shown on the map (all ticked by default).
  const isTicked = useCallback((id: string) => (onlyMap.length ? onlyMap.includes(id) : !offMap.includes(id)), [onlyMap, offMap]);
  const visible = useMemo(() => shown.filter((m) => isTicked(m.id)), [shown, isTicked]);
  const events = useMemo(() => (current ? visible : []).flatMap((m) => m.events), [current, visible]);
  const setFocus = useCallback((f: Focus | null) => onPicked(f ? [f] : []), [onPicked]);
  const [pinned, setPinned] = useState<PointedEvent | null>(null);
  const [pointed, setPointed] = useState<PointedEvent | null>(null);
  useEffect(() => {
    setPinned(null);
    setPointed(null);
  }, [key]);
  const active = pointed ?? pinned;
  useEffect(() => onPointedKind(active ? active.event[1] : null), [active, onPointedKind]);
  // The rest fades back, eased, while something is pointed at; what was pointed at stays bright while it fades in.
  const dim = useEase(!!hover || !!active); // a hovered group only shows its count: nothing fades
  const fading = dim > 0;
  const shownHover = useLast(hover, fading);
  const shownActive = useLast(active, fading);
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
    [setFocus],
  );
  const onPick = useCallback(
    ({ u, v, tolerance }: MapPick) => pickAt(pickEvent(visible, t, u, v, tolerance, hiddenSet), pickPlayer(visible, t, u, v, tolerance)),
    [visible, t, hiddenSet, pickAt],
  );
  // Under the mouse: an event first; else a path, which is highlighted (click it for the player's card).
  const [hoverPath, setHoverPath] = useState<Focus | null>(null);
  const zoomRef = useRef<((k: number) => void) | null>(null);
  /** The recorded human of a match (each match is one player's run). */
  const humanOf = (id: string): Focus | null => {
    const m = shown.find((x) => x.id === id);
    const i = m ? m.players.findIndex((p) => !p.bot) : -1;
    return m ? { match: id, player: Math.max(0, i) } : null;
  };
  /**
   * A match clicked in the "On the map" list: it alone is picked (its player's card opens), or unpicked if it was the
   * only one. Ctrl / Cmd adds or removes it; Shift picks every match from the last picked one to this one.
   */
  /**
   * One meaning for the list: ticked = selected = shown on the map. A click ticks this match alone and opens its
   * player's card (a second click ticks every match again); the tick box, or Ctrl / Cmd, adds or removes it; Shift
   * ticks every match from the one whose card is open to this one.
   */
  const ids = summaries.map((m) => m.id);
  const toggleTick = (id: string) => {
    const was = isTicked(id);
    // Kept as the shorter list: "only these" while few are ticked, else "all but these".
    const ticked = was ? ids.filter((x) => x !== id && isTicked(x)) : ids.filter((x) => x === id || isTicked(x));
    const unticked = ids.filter((x) => !ticked.includes(x));
    // Nothing ticked: a one-character marker ('-' is no match id) instead of listing every match.
    const lists = !ticked.length ? { onlyMap: ['-'], offMap: [] } : ticked.length < unticked.length ? { onlyMap: ticked, offMap: [] } : { onlyMap: [], offMap: unticked };
    // A match unticked while its card is open: the card closes with it.
    onSelect({ ...lists, ...(was && picks.some((p) => p.match === id) ? { picked: picks.filter((p) => p.match !== id) } : {}) });
  };
  const openMatch = (id: string, e: React.MouseEvent) => {
    const f = humanOf(id);
    if (!f) return;
    setPinned(null);
    if (e.ctrlKey || e.metaKey) return toggleTick(id);
    if (e.shiftKey && focus) {
      const a = ids.indexOf(focus.match);
      const b = ids.indexOf(id);
      const range = new Set(ids.slice(Math.min(a, b), Math.max(a, b) + 1));
      return onSelect({ onlyMap: ids.filter((x) => range.has(x)), offMap: [] });
    }
    const alone = ids.filter(isTicked).length === 1 && isTicked(id);
    // Already alone with its player's card: back to every match. A bot of it was picked: back to its player first.
    if (alone && picks.length === 1 && picks[0].match === id && picks[0].player === f.player) onSelect({ onlyMap: [], offMap: [], picked: [] });
    else onSelect({ onlyMap: [id], offMap: [], picked: [f] });
  };
  /** Everyone recorded in a match, players first then bots: index, id, and when they died (null: no death logged). */
  const playersOf = (id: string) => {
    const m = shown.find((x) => x.id === id);
    if (!m) return [];
    const DEATHS = new Set(['botDeath', 'diedToBot', 'diedToPlayer', 'storm']);
    return m.players
      .map((p, i) => {
        const death = m.events.find((e) => e[4] === i && DEATHS.has(e[1]));
        return { player: i, id: p.id, bot: p.bot, died: death ? death[0] : null };
      })
      .sort((a, b) => Number(a.bot) - Number(b.bot));
  };
  /** A bot clicked under its match: it alone is picked (its card opens); Ctrl / Cmd adds or removes it. */
  const openBot = (f: Focus, e: React.MouseEvent) => {
    setPinned(null);
    const has = picks.some((p) => p.match === f.match && p.player === f.player);
    if (e.ctrlKey || e.metaKey) onPicked(has ? picks.filter((p) => !(p.match === f.match && p.player === f.player)) : [...picks, f]);
    else onPicked(has && picks.length === 1 ? [] : [f]);
  };
  const onHoverMap = useCallback(
    (p: MapPick | null) => {
      const ev = p ? pickEvent(visible, t, p.u, p.v, p.tolerance, hiddenSet) : null;
      setPointed(ev);
      const path = p && !ev ? pickPlayer(visible, t, p.u, p.v, p.tolerance) : null;
      const hide = path && hiddenSet.has(shown.find((m) => m.id === path.match)?.players[path.player]?.bot ? 'botPath' : 'humanPath');
      setHoverPath((old) => (hide || !path ? null : old && old.match === path.match && old.player === path.player ? old : path));
    },
    [visible, t, hiddenSet],
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
      if (shown.length)
        drawMatches(ctx, visible, uvUnits, size, t, play.playing, {
          mono, hidden: hiddenSet, hover: shownHover, phase, activeEvent: shownActive?.event ?? null, iconScale,
          dim, pathWidth, pathAlpha, offPlayers, hoverPath: focus && hoverPath && focus.match === hoverPath.match && focus.player === hoverPath.player ? null : hoverPath,
        });
      // Every picked player bold over a dimmed map; the last one (its card is open) with the players it fought.
      picks.forEach((p, i) => {
        const m = shown.find((x) => x.id === p.match);
        const last = i === picks.length - 1;
        if (m) drawFocus(ctx, m, p.player, uvUnits, size, t, last ? active?.event ?? null : null, phase, last ? story?.opponents ?? [] : [], false);
      });
    },
    [visible, t, uvUnits, play.playing, mono, hiddenSet, shownHover, phase, under, focusMatch, focus, active, shownActive, story, iconScale, dim, pathWidth, pathAlpha, hoverPath, picks, offPlayers],
  );

  if (!summaries.length)
    return (
      <>
      <div className="stage-tools">{props.history}</div>
      <div className="stage-main">
        <MapCanvas map={mapConfig.id} draw={noDraw} dim={0} uvUnits={uvUnits} inset={312} />
        <div className="stage-left">
          <section className="replayed" aria-label="Matches on the map">
            {props.filters}
          </section>
        </div>
        <div className="stage-hint">{emptyHint}</div>
      </div>
      </>
    );

  const many = summaries.length > MANY_MATCHES;
  const seek = (time: number) => {
    play.pause();
    play.seek(time);
  };
  return (
    <>
      <div className="stage-tools">
        <Choice label="View" options={[['2d', '2D'], ['3d', '3D']]} value={view3d ? '3d' : '2d'} onChange={(v) => onView({ view3d: v === '3d' })} />
        {!view3d && (
          <span className="zoom-btns">
            <button onClick={() => zoomRef.current?.(1.5)} aria-label="Zoom in" data-tip="Zoom in (or scroll, or pinch)">+</button>
            <button onClick={() => zoomRef.current?.(1 / 1.5)} aria-label="Zoom out" data-tip="Zoom out">−</button>
          </span>
        )}
        {props.history}
        {view3d && (
          <Choice label="Ground" options={[['terrain', 'Terrain'], ['flat', 'Flat']]} value={terrain ? 'terrain' : 'flat'} onChange={(g) => onView({ terrain: g === 'terrain' })} />
        )}
        {view3d && (
          <label className="exaggeration" data-tip="Stretch heights so the relief shows">
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
          <ErrorBoundary label="The 3D view could not load.">
          <Suspense fallback={<Loader label="Loading the 3D view" />}>
            <Map3D
              map={mapConfig}
              matches={visible}
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
              pathWidth={pathWidth}
              pathAlpha={pathAlpha}
              offPlayers={offPlayers}
              onPickEvent={(e) => {
                const m = shown.find((x) => x.events.includes(e));
                if (m) pickAt({ match: m.id, event: e }, null);
              }}
            />
          </Suspense>
          </ErrorBoundary>
        ) : (
          <MapCanvas map={summaries[0].map} draw={draw} dim={0} uvUnits={uvUnits} onPick={onPick} onHover={onHoverMap} pointer={!!pointed || !!hoverPath} inset={312} zoomRef={zoomRef} />
        )}
        <div className="stage-left">
        {summaries.length > 0 && (
          <section className="replayed" aria-label="Matches on the map">
            {props.filters}
            <h3>
              On the map <span>{summaries.length}</span>
              {summaries.length > 1 && !many && (
                <span className="colors-switch" role="group" aria-label="Match colors">
                  <button className={!mono ? 'on' : ''} aria-pressed={!mono} onClick={() => onView({ mono: false })} data-tip="One color per match">
                    Colors
                  </button>
                  <button className={mono ? 'on' : ''} aria-pressed={mono} onClick={() => onView({ mono: true })} data-tip="One color for every match">
                    One color
                  </button>
                </span>
              )}
            </h3>
            <ul>
              {summaries.map((m, i) => {
                const end = endedOf(m);
                const color = many || mono ? PATH_COLOR.human : MATCH_COLORS[i];
                return (
                  <li key={m.id}>
                    <button
                      className={picks.some((p) => p.match === m.id) ? 'on' : ''}
                      onClick={(e) => openMatch(m.id, e)}
                      onMouseEnter={() => setHoverPath(humanOf(m.id))}
                      onMouseLeave={() => setHoverPath(null)}
                    >
                      <span
                        className={`tick-box pick-box ${isTicked(m.id) ? 'on' : ''}`}
                        role="checkbox"
                        aria-checked={isTicked(m.id)}
                        aria-label="Select this match (shown on the map)"
                        data-tip="Selected and shown on the map: untick to hide it, tick to add it"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTick(m.id);
                        }}
                      />
                      <span className="dot" style={{ background: color }} />
                      <span className="r-day">{formatDay(m.day)}</span>
                      <span className="r-dur">{formatDuration(m.durationMs)}</span>
                      <span className={`r-end ${end === 'survived' ? 'ok' : 'dead'}`}>
                        {ENDED_ICON[end] && <LegendIcon k={ENDED_ICON[end]!} size={13} />}
                        {ENDED_SHORT[end]}
                      </span>
                      {(m.humans > 1 || m.bots > 0) && (
                        <span className="r-bots" data-tip="Also recorded in this match: pick the match to see everyone">
                          {m.humans > 1 && <span className="r-plus-player">+{m.humans - 1} player</span>}
                          {m.bots > 0 && ` +${m.bots} bots`}
                        </span>
                      )}
                    </button>
                    {picks.some((p) => p.match === m.id) && (m.bots > 0 || m.humans > 1) && (
                      <ul className="r-bot-list" aria-label="Everyone recorded in this match">
                        {playersOf(m.id).map((b) => (
                          <li key={b.player}>
                            <button
                              className={picks.some((p) => p.match === m.id && p.player === b.player) ? 'on' : ''}
                              onClick={(e) => openBot({ match: m.id, player: b.player }, e)}
                              onMouseEnter={() => setHoverPath({ match: m.id, player: b.player })}
                              onMouseLeave={() => setHoverPath(null)}
                            >
                              <span
                                className={`tick-box pick-box ${!offPlayers.includes(`${m.id}.${b.player}`) ? 'on' : ''}`}
                                role="checkbox"
                                aria-checked={!offPlayers.includes(`${m.id}.${b.player}`)}
                                aria-label="Show or hide on the map"
                                data-tip="Shown on the map: untick to hide this path and its events"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const k = `${m.id}.${b.player}`;
                                  onSelect({ offPlayers: offPlayers.includes(k) ? offPlayers.filter((x) => x !== k) : [...offPlayers, k] });
                                }}
                              />
                              <LegendIcon k={b.bot ? 'botPath' : 'humanPath'} size={13} />
                              <span className="r-day">{b.bot ? `Bot ${b.id}` : `Player ${b.id.slice(0, 8)}`}</span>
                              <span className={`r-end ${b.died === null ? 'ok' : 'dead'}`}>{b.died === null ? 'Alive' : `Died ${formatDuration(b.died)}`}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        </div>
        {story && focus && (
          <div className="stage-right">
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
            onOnlyThisMatch={() => {
              // Picks this match's player (the other matches hide, the list stays) and plays it from 0:00.
              const f = humanOf(focus.match);
              if (f) onPicked([f]);
              setPinned(null);
              play.seek(0);
              if (!play.playing) play.toggle();
            }}
            note={(() => {
              const bots = focusMatch?.players.filter((x) => x.bot).length ?? 0;
              const others = (focusMatch?.players.filter((x) => !x.bot).length ?? 1) - 1;
              if (story.bot || (!bots && !others)) return undefined;
              const who = [others ? `${others} other player` : '', bots ? `${bots} bots` : ''].filter(Boolean).join(' and ');
              return `${who} recorded in this match too: pick one under the match in the list, or click a path on the map.`;
            })()}
            onFocusOther={(player) => {
              setPinned(null);
              setFocus({ match: focus.match, player });
            }}
          />
          </div>
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
