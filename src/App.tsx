import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHeat, useHeatDraw } from './components/Heat';
import { LEGEND_KEYS } from './components/Legend';
import { Overview } from './components/Overview';
import { ReplayStage } from './components/Replay';
import { OverviewSide, ReplaySide, RightPanel, type LayerHandlers } from './components/SidePanels';
import { UpdateButton } from './components/UpdateButton';
import { loadIndex } from './lib/data';
import { record, redo, start, undo, type History } from './lib/history';
import type { LegendKey } from './lib/draw';
import { MAP_LABEL, formatDay } from './lib/style';
import { applyFilter } from './lib/matchFilter';
import type { EventType, HeatLayer, Index, MapId, Who } from './lib/types';
import { legendToggle, parseView, resolveSelection, setMany, toggleLayer, toggleMatch, viewHash, type Mode, type View } from './lib/view';

const TAB_LABEL: Record<Mode, string> = { overview: 'Overview', replay: 'Match replay' };

export function App() {
  const [index, setIndex] = useState<Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Every setting lives in one view object, with an undo / redo history.
  const [hist, setHist] = useState<History<View>>(() => start(parseView(window.location.hash)));
  const view = hist.present;
  const update = useCallback(
    (patch: Partial<View>) => setHist((h) => record(h, { ...h.present, ...patch }, Object.keys(patch).sort().join(','), Date.now())),
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

  useEffect(() => {
    loadIndex().then(setIndex, (e: Error) => setError(e.message));
  }, []);

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

  const matches = useMemo(
    () =>
      applyFilter(
        (index?.matches ?? []).filter((m) => m.map === view.map && (view.day === 'all' || m.day === view.day)),
        { players: view.players, others: view.others, ended: view.ended, length: view.length, sort: view.sort },
      ),
    [index, view.map, view.day, view.players, view.others, view.ended, view.length, view.sort],
  );
  const days = useMemo(() => (view.day === 'all' ? (index?.days ?? []) : [view.day]), [index, view.day]);

  const selected = useMemo(() => resolveSelection(view.matches, matches), [view.matches, matches]);
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
  // Replay off: nothing of it is drawn (the heatmap alone); the legend keeps its own choices for when it is back.
  const drawnHidden = useMemo(() => (view.replayOn ? hidden : [...LEGEND_KEYS]), [view.replayOn, hidden]);

  const heat = useHeat(view.map);
  const underDraw = useHeatDraw(view.heatUnder ? heat : null, days, { layers: view.layers, kills: view.kills, deaths: view.deaths, mono: view.heatMono }, index?.uvUnits ?? 10_000);
  const layerHandlers: LayerHandlers = {
    onToggle: (l: HeatLayer) => update({ layers: toggleLayer(view.layers, l) }),
    onWho: (kind: 'kills' | 'deaths', who: Who) => update({ [kind]: who }),
  };

  if (error) return <div className="fatal">Could not load the data: {error}</div>;

  const replay = view.mode === 'replay';
  return (
    <div className={`app ${replay ? 'with-right' : ''}`}>
      <aside className="side">
        <header className="brand">
          <div>
            <h1>LILA BLACK</h1>
            <p className="sub">Player journeys · Feb 10-14, 2026</p>
          </div>
          <div className="history-btns">
            <button onClick={() => setHist(undo)} disabled={!hist.past.length} title="Undo (Cmd/Ctrl+Z)" aria-label="Undo">
              ↶
            </button>
            <button onClick={() => setHist(redo)} disabled={!hist.future.length} title="Redo (Shift+Cmd/Ctrl+Z)" aria-label="Redo">
              ↷
            </button>
          </div>
          <UpdateButton />
        </header>

        <div className="tabs" role="tablist">
          {(['overview', 'replay'] as Mode[]).map((m) => (
            <button key={m} role="tab" aria-selected={view.mode === m} className={view.mode === m ? 'on' : ''} onClick={() => update({ mode: m })}>
              {TAB_LABEL[m]}
            </button>
          ))}
        </div>

        {replay && (
          <>
            <section>
              <h2>Map</h2>
              <div className="segmented">
                {(Object.keys(MAP_LABEL) as MapId[]).map((id) => (
                  <button key={id} className={id === view.map ? 'on' : ''} onClick={() => update({ map: id })}>
                    {MAP_LABEL[id]}
                    <span className="count">{index?.matches.filter((m) => m.map === id).length ?? ''}</span>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h2>Day</h2>
              <select value={view.day} onChange={(e) => update({ day: e.target.value })}>
                <option value="all">All 5 days</option>
                {index?.days.map((d) => (
                  <option key={d} value={d}>
                    {formatDay(d)}
                    {d === '2026-02-14' ? ' (partial day)' : ''}
                  </option>
                ))}
              </select>
            </section>
            <ReplaySide
              view={view}
              update={update}
              matches={matches}
              selected={selected}
              onOnlyMatch={(id) => update({ matches: [id] })}
              onToggleMatch={(id) => update({ matches: toggleMatch(selectedIds, id) })}
              onSetMany={(ids, on) => update({ matches: setMany(selectedIds, ids, on) })}
            />
          </>
        )}
        {view.mode === 'overview' && <OverviewSide />}
      </aside>

      <main className={`stage ${replay ? '' : 'stage-page'}`}>
        {!replay ? (
          <Overview index={index} />
        ) : !index ? (
          <div className="empty">Loading…</div>
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
            onOnlyMatch={(id) => update({ matches: [id] })}
            iconScale={view.iconScale}
            groupPx={view.groupPx}
          />
        )}
      </main>

      {replay && (
        <RightPanel
          view={view}
          update={update}
          heat={heat}
          days={days}
          layers={layerHandlers}
          counts={counts}
          hidden={hidden}
          pointedKind={pointedKind}
          onLegendToggle={(k) => update({ hidden: legendToggle(hidden, k) })}
          onLegendAll={(show) => update({ hidden: show ? [] : [...LEGEND_KEYS] })}
          onHover={setHover}
        />
      )}
    </div>
  );
}
