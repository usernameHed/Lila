import { useEffect, useMemo, useState } from 'react';
import { Legend } from './components/Legend';
import { MapCanvas } from './components/MapCanvas';
import { loadIndex, loadMatch } from './lib/data';
import { MAP_LABEL, formatDay, formatDuration } from './lib/style';
import type { Index, MapId, Match } from './lib/types';

const ALL_DAYS = 'all';

export function App() {
  const [index, setIndex] = useState<Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [map, setMap] = useState<MapId>('AmbroseValley');
  const [day, setDay] = useState<string>(ALL_DAYS);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    loadIndex().then(setIndex, (e: Error) => setError(e.message));
  }, []);

  const matches = useMemo(
    () => (index?.matches ?? []).filter((m) => m.map === map && (day === ALL_DAYS || m.day === day)),
    [index, map, day],
  );

  // Keep a match selected: the first of the list when the filters drop the current one.
  useEffect(() => {
    if (!matches.length) setMatchId(null);
    else if (!matches.some((m) => m.id === matchId)) setMatchId(matches[0].id);
  }, [matches, matchId]);

  useEffect(() => {
    if (!matchId) return setMatch(null);
    let live = true;
    loadMatch(matchId).then((m) => live && setMatch(m), (e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [matchId]);

  const selected = matches.find((m) => m.id === matchId);

  if (error) return <div className="fatal">Could not load the data: {error}</div>;

  return (
    <div className="app">
      <aside className="side">
        <header>
          <h1>LILA BLACK</h1>
          <p className="sub">Player journeys</p>
        </header>

        <section>
          <h2>Map</h2>
          <div className="segmented" role="tablist">
            {(Object.keys(MAP_LABEL) as MapId[]).map((id) => (
              <button key={id} role="tab" aria-selected={id === map} className={id === map ? 'on' : ''} onClick={() => setMap(id)}>
                {MAP_LABEL[id]}
                <span className="count">{index?.matches.filter((m) => m.map === id).length ?? ''}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>Day</h2>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            <option value={ALL_DAYS}>All 5 days</option>
            {index?.days.map((d) => (
              <option key={d} value={d}>
                {formatDay(d)}
              </option>
            ))}
          </select>
        </section>

        <section className="grow">
          <h2>
            Match <span className="count">{matches.length}</span>
          </h2>
          <ul className="matches">
            {matches.map((m) => (
              <li key={m.id}>
                <button className={m.id === matchId ? 'on' : ''} onClick={() => setMatchId(m.id)}>
                  <span className="when">{formatDay(m.day)}</span>
                  <span className="dur">{formatDuration(m.durationMs)}</span>
                  <span className="who">
                    {m.humans} human{m.humans === 1 ? '' : 's'}
                    {m.bots ? `, ${m.bots} bots` : ''}
                  </span>
                  <span className="kills">{(m.events.BotKill ?? 0) + (m.events.Kill ?? 0)} kills</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Legend</h2>
          <Legend counts={selected?.events ?? {}} />
        </section>
      </aside>

      <main className="stage">
        <MapCanvas map={map} match={match} uvUnits={index?.uvUnits ?? 10_000} />
      </main>
    </div>
  );
}
