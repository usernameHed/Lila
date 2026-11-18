import { useEffect, useMemo, useState } from 'react';
import { HeatStage, LayerList, useHeat } from './components/Heat';
import { Legend } from './components/Legend';
import { Choice } from './components/Choice';
import { MatchList, ReplayStage } from './components/Replay';
import { UpdateButton } from './components/UpdateButton';
import { loadIndex } from './lib/data';
import { MAP_LABEL, formatDay } from './lib/style';
import type { EventType, Index, MapId } from './lib/types';
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
    const out: Partial<Record<EventType, number>> = {};
    for (const m of selected) for (const [k, n] of Object.entries(m.events)) out[k as EventType] = (out[k as EventType] ?? 0) + (n ?? 0);
    return out;
  }, [selected]);

  const heat = useHeat(view.map);
  const fights = useMemo(() => matches.reduce((n, m) => n + m.fights, 0), [matches]);

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
              <h2>Legend</h2>
              <Legend counts={counts} />
            </section>
          </>
        ) : (
          <section className="grow">
            <h2>Show <span className="muted hint">tick boxes to stack kinds</span></h2>
            <LayerList
              heat={heat}
              days={days}
              fights={fights}
              layers={view.layers}
              kills={view.kills}
              deaths={view.deaths}
              mono={view.mono}
              look={view.look}
              onToggle={(l) => update({ layers: toggleLayer(view.layers, l) })}
              onOnly={(l) => update({ layers: [l] })}
              onWho={(kind, who) => update({ [kind]: who })}
            />
            <div className="heat-options">
              <h2>Look</h2>
              <Choice label="Heatmap look" options={[['smooth', 'Smooth'], ['bands', 'Toon']]} value={view.look} onChange={(look) => update({ look })} />
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
          <ReplayStage summaries={selected} uvUnits={index.uvUnits} mono={view.mono} />
        ) : (
          <HeatStage
            map={view.map}
            heat={heat}
            days={days}
            matchCount={matches.length}
            fights={fights}
            layers={view.layers}
            kills={view.kills}
            deaths={view.deaths}
            mono={view.mono}
            look={view.look}
          />
        )}
      </main>
    </div>
  );
}
