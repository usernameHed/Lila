import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHeat, useHeatDraw } from './components/Heat';
import { LEGEND_KEYS } from './components/Legend';
import { DataPage } from './components/DataPage';
import { Overview } from './components/Overview';
import { useSourceId } from './components/useSourceId';
import { ReplayStage } from './components/Replay';
import { MatchFilters, OverviewSide, ReplaySide, RightPanel } from './components/SidePanels';
import { UpdateButton } from './components/UpdateButton';
import { loadIndex } from './lib/data';
import { BUILTIN_ID, listUploads, restoreSource } from './lib/sources';
import { Icon } from './components/Icon';
import { Loader } from './components/Loader';
import { MapTile, MapTiles } from './components/MapBadge';
import { InstallOffer } from './components/InstallOffer';
import { Tips } from './components/Tips';
import { playNext } from './components/usePlayback';
import { minimap } from './components/MapCanvas';
import { record, redo, start, undo, type History } from './lib/history';
import type { LegendKey } from './lib/draw';
import { MAP_LABEL } from './lib/style';
import { applyFilter } from './lib/matchFilter';
import type { EventType, Index, MapId } from './lib/types';
import { parseView, resolveSelection, setMany, toggleMatch, viewHash, type Mode, type View } from './lib/view';

const TAB_LABEL: Record<Mode, string> = { overview: 'Overview', replay: 'Match replay', data: 'Data' };

export function App() {
  const [index, setIndex] = useState<Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Every setting lives in one view object, with an undo / redo history.
  const [hist, setHist] = useState<History<View>>(() => start(parseView(window.location.hash)));
  const view = hist.present;
  const update = useCallback(
    (patch: Partial<View>) =>
      setHist((h) => {
        const key = Object.keys(patch).sort().join(',');
        // Picking matches or players: every click is its own undo step (sliders and the like merge).
        return record(h, { ...h.present, ...patch }, /\b(picked|matches)\b/.test(key) ? null : key, Date.now());
      }),
    [],
  );
  const setView = useCallback((v: View) => setHist((h) => record(h, v, 'link', Date.now())), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input[type=text], textarea');
      if (!(e.metaKey || e.ctrlKey) || typing) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) setHist(undo);
      else if ((k === 'z' && e.shiftKey) || k === 'y') setHist(redo);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The data shown: built in, or a dataset dropped in the Data tab (restored from this browser on start).
  const source = useSourceId();
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    restoreSource().finally(() => setRestored(true));
  }, []);
  const firstSource = useRef(source);
  useEffect(() => {
    if (!restored) return;
    let live = true;
    setIndex(null);
    loadIndex().then(
      (i) => {
        if (!live) return;
        setIndex(i);
        // The other maps' pictures, quietly, once this one is up: switching map is then instant.
        setTimeout(() => i.maps.forEach((m) => void minimap(m.id).catch(() => undefined)), 1500);
      },
      (e: Error) => live && setError(e.message),
    );
    // Another dataset: the matches picked in the previous one mean nothing here.
    if (source !== firstSource.current) update({ matches: [], day: 'all' });
    firstSource.current = source;
    return () => {
      live = false;
    };
  }, [source, restored, update]);

  // Keep the URL in step with the view (shareable), and follow the back button / pasted links.
  useEffect(() => {
    const hash = viewHash(view);
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [view]);
  useEffect(() => {
    const onHash = () => {
      const next = parseView(window.location.hash);
      if (viewHash(next) !== viewHash(hist.present)) setView(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [hist.present, setView]);

  // The map and day's matches, then the filters on top.
  const pool = useMemo(() => (index?.matches ?? []).filter((m) => m.map === view.map && (view.day === 'all' || m.day === view.day)), [index, view.map, view.day]);
  const matches = useMemo(
    () => applyFilter(pool, { ended: view.ended, length: view.length, game: view.game, sort: 'day' }), // sorting is off for now
    [pool, view.ended, view.length, view.game],
  );
  const days = useMemo(() => (view.day === 'all' ? (index?.days ?? []) : [view.day]), [index, view.day]);

  const selected = useMemo(() => resolveSelection(view.matches, matches, view.recent, view.random, view.seed), [view.matches, matches, view.recent, view.random, view.seed]);
  const selectedIds = selected.map((m) => m.id);
  const counts = useMemo(() => {
    const out: Partial<Record<LegendKey, number>> = { fights: 0 };
    for (const m of selected) {
      for (const [k, n] of Object.entries(m.events)) out[k as EventType] = (out[k as EventType] ?? 0) + (n ?? 0);
      out.fights = (out.fights ?? 0) + m.fights;
    }
    return out;
  }, [selected]);
  const [hover, setHover] = useState<LegendKey | null>(null);
  const [pointedKind, setPointedKind] = useState<LegendKey | null>(null);
  const hidden = view.hidden as LegendKey[];
  const [uploadName, setUploadName] = useState<string | null>(null);
  useEffect(() => {
    if (source !== BUILTIN_ID) listUploads().then((all) => setUploadName(all.find((u) => u.id === source)?.name ?? null));
  }, [source]);
  // Replay off: nothing of it is drawn (the heatmap alone); the legend keeps its own choices for when it is back.
  const drawnHidden = useMemo(() => (view.replayOn ? hidden : [...LEGEND_KEYS]), [view.replayOn, hidden]);

  const heat = useHeat(view.map);
  const underDraw = useHeatDraw(view.heatUnder ? heat : null, days, { layers: view.layers, kills: view.kills, deaths: view.deaths }, index?.uvUnits ?? 10_000);

  if (error) return <div className="fatal">Could not load the data: {error}</div>;

  const replay = view.mode === 'replay';
  const sourceName = source === BUILTIN_ID ? "LILA's sample, Feb 10-14" : uploadName ?? 'Your dataset';
  return (
    <div className="app">
      <aside className="side">
        <UpdateButton />

        <div className="tabs" role="tablist">
          {(['overview', 'replay', 'data'] as Mode[]).map((m) => (
            <button key={m} role="tab" aria-selected={view.mode === m} className={view.mode === m ? 'on' : ''} onClick={() => update({ mode: m })}>
              {TAB_LABEL[m]}
            </button>
          ))}
        </div>

        {replay && (
          <>
            <button className="data-line" onClick={() => update({ mode: 'data' })} data-tip="Change the data">
              <span className="muted">Data</span> <b>{sourceName}</b> <span className="change">Change</span>
            </button>
            <section>
              <h2>Map</h2>
              <MapTiles>
                {(Object.keys(MAP_LABEL) as MapId[]).map((id) => (
                  <MapTile key={id} map={id} count={index?.matches.filter((m) => m.map === id).length} on={id === view.map} onPick={() => update({ map: id })} />
                ))}
              </MapTiles>
            </section>
            <ReplaySide
              view={view}
              update={update}
              matches={matches}
              days={index?.days ?? []}
              selected={selected}
              onOnlyMatch={(id) => {
                playNext.current = true; // picking one match replays it
                update({ matches: [id] });
              }}
              onToggleMatch={(id) => update({ matches: toggleMatch(selectedIds, id) })}
              onSetMany={(ids, on) => update({ matches: setMany(selectedIds, ids, on) })}
            />
          </>
        )}
        {replay && <RightPanel view={view} update={update} heat={heat} days={days} counts={counts} pointedKind={pointedKind} onHover={setHover} />}
        {view.mode === 'overview' && <OverviewSide />}
        {view.mode === 'data' && (
          <section>
            <h2>Showing now</h2>
            <p className="small">{sourceName}</p>
            <p className="muted small">Drop a dataset on the page, or pick one of the datasets kept in this browser.</p>
          </section>
        )}
      </aside>

      <main className={`stage ${replay ? '' : 'stage-page'}`}>
        {view.mode === 'overview' ? (
          <Overview index={index} />
        ) : view.mode === 'data' ? (
          <DataPage onShow={() => update({ mode: 'replay' })} />
        ) : !index ? (
          <Loader label="Loading the matches" />
        ) : (
          <ReplayStage
            summaries={selected}
            uvUnits={index.uvUnits}
            mono={view.mono}
            hidden={drawnHidden}
            hover={hover}
            onPointedKind={setPointedKind}
            under={view.heatUnder ? underDraw : null}
            mapConfig={index.maps.find((m) => m.id === view.map) ?? index.maps[0]}
            view3d={view.view3d}
            exaggeration={view.exaggeration}
            terrain={view.terrain}
            onView={update}
            iconScale={view.iconScale}
            pathWidth={view.pathWidth}
            pathAlpha={view.pathAlpha}
            picked={view.picked}
            history={
              <span className="history-btns">
                <button onClick={() => setHist(undo)} disabled={!hist.past.length} data-tip="Undo (Cmd/Ctrl+Z)" aria-label="Undo">
                  <Icon name="undo" size={16} />
                </button>
                <button onClick={() => setHist(redo)} disabled={!hist.future.length} data-tip="Redo (Shift+Cmd/Ctrl+Z)" aria-label="Redo">
                  <Icon name="redo" size={16} />
                </button>
              </span>
            }
            filters={<MatchFilters view={view} update={update} pool={pool} />}
            onPicked={(picked) => update({ picked })}
            emptyHint={matches.length ? 'Tick a match in the list to replay it.' : 'No match for these filters.'}
          />
        )}
      </main>

      <InstallOffer />
      <Tips />
    </div>
  );
}
