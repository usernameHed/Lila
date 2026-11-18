import { useEffect, useMemo, useState } from 'react';
import { HeatStage, LayerList, useHeat } from './components/Heat';
import { Legend } from './components/Legend';
import { MatchList, ReplayStage } from './components/Replay';
import { loadIndex } from './lib/data';
import { MAP_LABEL, formatDay } from './lib/style';
import type { Index, MapId } from './lib/types';
import { parseView, viewHash, type Mode, type View } from './lib/view';

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
    () => (index?.matches ?? []).filter((m) => m.map === view.map && (view.day === 'all' || m.day === view.day)),
    [index, view.map, view.day],
  );
  const days = useMemo(() => (view.day === 'all' ? (index?.days ?? []) : [view.day]), [index, view.day]);

  // Keep a match selected: the first of the list when the filters drop the current one.
  useEffect(() => {
    if (!index) return;
    if (!matches.length) update({ match: null });
    else if (!matches.some((m) => m.id === view.match)) update({ match: matches[0].id });
  }, [index, matches, view.match]);

  const heat = useHeat(view.map);
  const selected = matches.find((m) => m.id === view.match);

  if (error) return <div className="fatal">Could not load the data: {error}</div>;

  return (
    <div className="app">
      <aside className="side">
        <header>
          <h1>LILA BLACK</h1>
          <p className="sub">Player journeys · Feb 10-14, 2026</p>
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
            <section className="grow">
              <h2>
                Match <span className="count">{matches.length}</span>
              </h2>
              <MatchList matches={matches} selected={view.match} onSelect={(id) => update({ match: id })} />
            </section>
            <section>
              <h2>Legend</h2>
              <Legend counts={selected?.events ?? {}} />
            </section>
          </>
        ) : (
          <section className="grow">
            <h2>Show</h2>
            <LayerList heat={heat} days={days} layer={view.layer} onLayer={(layer) => update({ layer })} />
          </section>
        )}
      </aside>

      <main className="stage">
        {!index ? (
          <div className="empty">Loading…</div>
        ) : view.mode === 'replay' ? (
          <ReplayStage summary={selected} uvUnits={index.uvUnits} />
        ) : (
          <HeatStage map={view.map} heat={heat} days={days} layer={view.layer} matchCount={matches.length} />
        )}
      </main>
    </div>
  );
}
