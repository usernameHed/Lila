import { useEffect, useMemo, useState } from 'react';
import { HeatStage, LayerList, useHeat, useHeatDraw } from './components/Heat';
import { LEGEND_KEYS, Legend } from './components/Legend';
import type { LegendKey } from './lib/draw';
import { Choice } from './components/Choice';
import { MatchList, ReplayStage } from './components/Replay';
import { UpdateButton } from './components/UpdateButton';
import { loadIndex } from './lib/data';
import { MAP_LABEL, formatDay } from './lib/style';
import type { EventType, HeatLayer, Index, MapId, Who } from './lib/types';
import { ALL, parseView, resolveSelection, toggleLayer, toggleMatch, viewHash, type Mode, type View } from './lib/view';

export function App() {
  const [index, setIndex] = useState<Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => parseView(window.location.hash));
  const update = (patch: Partial<View>) => setView((v) => ({ ...v, ...patch }));

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
    () =>
      (index?.matches ?? []).filter(
        (m) =>
          m.map === view.map &&
          (view.day === 'all' || m.day === view.day) &&
          (view.mode !== 'replay' || view.players === 'all' || m.onlyMatch),
      ),
    [index, view.map, view.day, view.mode, view.players],
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
  const hidden = view.hidden as LegendKey[];
  // Click a legend row: only that kind; click it again (already alone): everything back.
  const onlyLegend = (k: LegendKey) => {
    const alone = LEGEND_KEYS.every((x) => (x === k) !== hidden.includes(x));
    update({ hidden: alone ? [] : LEGEND_KEYS.filter((x) => x !== k) });
    setHover(null);
  };
  const toggleLegend = (k: LegendKey) => update({ hidden: hidden.includes(k) ? hidden.filter((x) => x !== k) : [...hidden, k] });

  const heat = useHeat(view.map);
  const heatOptions = { layers: view.layers, kills: view.kills, deaths: view.deaths };
  // Under a replay the heatmap keeps one color per kind: the replay's one-color switch is about matches.
  const underDraw = useHeatDraw(view.heatUnder ? heat : null, days, { ...heatOptions, mono: false }, index?.uvUnits ?? 10_000);
  const layerHandlers = {
    onToggle: (l: HeatLayer) => update({ layers: toggleLayer(view.layers, l) }),
    onOnly: (l: HeatLayer) => update({ layers: [l] }),
    onWho: (kind: 'kills' | 'deaths', who: Who) => update({ [kind]: who }),
  };

  if (error) return <div className="fatal">Could not load the data: {error}</div>;

  return (
    <div className="app">
      <aside className="side">
        <header className="brand">
          <div>
            <h1>LILA BLACK</h1>
            <p className="sub">Player journeys · Feb 10-14, 2026</p>
          </div>
          <UpdateButton />
        </header>

        <div className="tabs" role="tablist">
          {(['replay', 'heat'] as Mode[]).map((m) => (
            <button key={m} role="tab" aria-selected={view.mode === m} className={view.mode === m ? 'on' : ''} onClick={() => update({ mode: m })}>
              {m === 'replay' ? 'Match replay' : 'Heatmaps'}
            </button>
          ))}
        </div>

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

        {view.mode === 'replay' ? (
          <>
            <section>
              <h2>Players</h2>
              <Choice
                label="Which players"
                options={[['all', 'All'], ['once', 'Played only once']]}
                value={view.players}
                onChange={(players) => update({ players })}
              />
            </section>
            <section className="grow">
              <h2 className="with-actions">
                Match <span className="count">{selected.length > 1 ? `${selected.length} of ${matches.length}` : matches.length}</span>
                <span className="actions">
                  <button onClick={() => update({ matches: ALL })} disabled={selected.length === matches.length}>
                    Select all
                  </button>
                  <button onClick={() => update({ matches: selectedIds.slice(0, 1) })} disabled={selected.length < 2}>
                    Clear
                  </button>
                </span>
              </h2>
              <MatchList
                matches={matches}
                selected={selected}
                mono={view.mono}
                onOnly={(id) => update({ matches: [id] })}
                onToggle={(id) => update({ matches: toggleMatch(selectedIds, id) })}
              />
            </section>
            {selected.length > 1 && (
              <section>
                <h2>Colors</h2>
                <Choice label="Match colors" options={[['each', 'One per match'], ['mono', 'One color']]} value={view.mono ? 'mono' : 'each'} onChange={(c) => update({ mono: c === 'mono' })} />
              </section>
            )}
            <section>
              <h2>
                Legend <span className="muted hint">hover to spot, click for only one</span>
              </h2>
              <Legend counts={counts} hidden={hidden} onToggle={toggleLegend} onOnly={onlyLegend} onHover={setHover} />
            </section>
            <section>
              <h2>Heatmap under the replay</h2>
              <Choice label="Heatmap under the replay" options={[['off', 'Off'], ['on', 'On']]} value={view.heatUnder ? 'on' : 'off'} onChange={(v) => update({ heatUnder: v === 'on' })} />
              {view.heatUnder && (
                <div className="under-layers">
                  <LayerList heat={heat} days={days} {...heatOptions} mono={false} {...layerHandlers} />
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="grow">
            <h2>Show <span className="muted hint">tick boxes to stack kinds</span></h2>
            <LayerList heat={heat} days={days} {...heatOptions} mono={view.mono} {...layerHandlers} />
            <div className="heat-options">
              <h2>Colors</h2>
              <Choice label="Heatmap colors" options={[['each', 'One per kind'], ['mono', 'One color']]} value={view.mono ? 'mono' : 'each'} onChange={(c) => update({ mono: c === 'mono' })} />
            </div>
          </section>
        )}
      </aside>

      <main className="stage">
        {!index ? (
          <div className="empty">Loading…</div>
        ) : view.mode === 'replay' ? (
          <ReplayStage
            summaries={selected}
            uvUnits={index.uvUnits}
            mono={view.mono}
            hidden={hidden}
            hover={hover}
            under={view.heatUnder ? underDraw : null}
            mapConfig={index.maps.find((m) => m.id === view.map) ?? index.maps[0]}
            view3d={view.view3d}
            colorBy={view.colorBy}
            exaggeration={view.exaggeration}
            terrain={view.terrain}
            onView={update}
          />
        ) : (
          <HeatStage
            map={view.map}
            heat={heat}
            days={days}
            matchCount={matches.length}
            uvUnits={index.uvUnits}
            {...heatOptions}
            mono={view.mono}
          />
        )}
      </main>
    </div>
  );
}
