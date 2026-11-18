import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHeat, useHeatDraw } from './components/Heat';
import { LEGEND_KEYS } from './components/Legend';
import { Overview } from './components/Overview';
import { ReplayStage } from './components/Replay';
import { HeatPanel, OverviewSide, ReplaySide, type LayerHandlers } from './components/SidePanels';
import { UpdateButton } from './components/UpdateButton';
import { loadIndex } from './lib/data';
import type { LegendKey } from './lib/draw';
import { MAP_LABEL, formatDay } from './lib/style';
import type { EventType, HeatLayer, Index, MapId, MatchSummary, Who } from './lib/types';
import { legendToggle, parseView, resolveSelection, setMany, toggleLayer, toggleMatch, viewHash, type Mode, type View } from './lib/view';

/** The replay's "which matches" filter. */
const keepFor = (players: View['players'], m: MatchSummary) =>
  players === 'all' || (players === 'once' ? m.onlyMatch : !!(m.events.killPlayer || m.events.diedToPlayer));

const TAB_LABEL: Record<Mode, string> = { overview: 'Overview', replay: 'Match replay' };

export function App() {
  const [index, setIndex] = useState<Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => parseView(window.location.hash));
  const update = useCallback((patch: Partial<View>) => setView((v) => ({ ...v, ...patch })), []);

  useEffect(() => {
    loadIndex().then(setIndex, (e: Error) => setError(e.message));
  }, []);

  // Keep the URL in step with the view (shareable), and follow the back button / pasted links.
  useEffect(() => {
    const hash = viewHash(view);
    if (window.location.hash !== hash) history.replaceState(null, '', hash);
  }, [view]);
  useEffect(() => {
    const onHash = () => setView(parseView(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const matches = useMemo(
    () => (index?.matches ?? []).filter((m) => m.map === view.map && (view.day === 'all' || m.day === view.day) && keepFor(view.players, m)),
    [index, view.map, view.day, view.players],
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
              counts={counts}
              hidden={hidden}
              pointedKind={pointedKind}
              onLegendToggle={(k) => update({ hidden: legendToggle(hidden, k) })}
              onLegendAll={(show) => update({ hidden: show ? [] : [...LEGEND_KEYS] })}
              onHover={setHover}
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
            hidden={hidden}
            hover={hover}
            onPointedKind={setPointedKind}
            under={view.heatUnder ? underDraw : null}
            mapConfig={index.maps.find((m) => m.id === view.map) ?? index.maps[0]}
            view3d={view.view3d}
            exaggeration={view.exaggeration}
            terrain={view.terrain}
            onView={update}
            onOnlyMatch={(id) => update({ matches: [id] })}
          />
        )}
      </main>

      {replay && <HeatPanel view={view} update={update} heat={heat} days={days} layers={layerHandlers} />}
    </div>
  );
}
