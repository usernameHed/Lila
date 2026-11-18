// The panels around the map: left (which matches, legend), right (heatmap), and the Overview's table of contents.
// App owns the state; these only show it.
import type { LegendKey } from '../lib/draw';
import type { HeatData, HeatLayer, MatchSummary, Who } from '../lib/types';
import { ALL, ALL_LAYERS, type View } from '../lib/view';
import { Choice } from './Choice';
import { LayerList } from './Heat';
import { Legend } from './Legend';
import { OVERVIEW_SECTIONS } from './Overview';
import { MatchList } from './Replay';

type Update = (patch: Partial<View>) => void;

export interface LayerHandlers {
  onToggle: (l: HeatLayer) => void;
  onWho: (kind: 'kills' | 'deaths', who: Who) => void;
}

interface ReplayProps {
  view: View;
  update: Update;
  matches: MatchSummary[];
  selected: MatchSummary[];
  onOnlyMatch: (id: string) => void;
  onToggleMatch: (id: string) => void;
  onSetMany: (ids: string[], on: boolean) => void;
  counts: Partial<Record<LegendKey, number>>;
  hidden: LegendKey[];
  pointedKind: LegendKey | null;
  onLegendToggle: (k: LegendKey) => void;
  onLegendAll: (show: boolean) => void;
  onHover: (k: LegendKey | null) => void;
}

export function ReplaySide(p: ReplayProps) {
  const { view, update, matches, selected } = p;
  return (
    <>
      <section>
        <h2>Matches</h2>
        <div className="filters">
          <label>
            Ended
            <select value={view.ended} onChange={(e) => update({ ended: e.target.value as View['ended'] })}>
              <option value="any">Any way</option>
              <option value="survived">Survived</option>
              <option value="bot">Killed by a bot</option>
              <option value="storm">Died to the storm</option>
              <option value="player">Killed by a player</option>
            </select>
          </label>
          <label>
            Length
            <select value={view.length} onChange={(e) => update({ length: e.target.value as View['length'] })}>
              <option value="any">Any</option>
              <option value="short">Under 5 min</option>
              <option value="mid">5 to 10 min</option>
              <option value="long">Over 10 min</option>
            </select>
          </label>
          <label title="Matches where bots (or a second player) were recorded too: fights can be seen from both sides">
            Others recorded
            <select value={view.others} onChange={(e) => update({ others: e.target.value as View['others'] })}>
              <option value="any">Any</option>
              <option value="recorded">Recorded</option>
            </select>
          </label>
          <label>
            Players
            <select value={view.players} onChange={(e) => update({ players: e.target.value as View['players'] })}>
              <option value="all">All</option>
              <option value="once">Played only once</option>
            </select>
          </label>
          <label className="wide">
            Order
            <select value={view.sort} onChange={(e) => update({ sort: e.target.value as View['sort'] })}>
              <option value="day">By day</option>
              <option value="longest">Longest first</option>
              <option value="shortest">Shortest first</option>
              <option value="kills">Most kills first</option>
              <option value="loot">Most loot first</option>
            </select>
          </label>
        </div>
      </section>
      <section className="grow">
        <h2 className="with-actions">
          <span className="count">
            {matches.length} match{matches.length === 1 ? '' : 'es'} · {selected.length} shown
          </span>
          <span className="actions">
            <button onClick={() => update({ matches: ALL })} disabled={selected.length === matches.length}>
              Select all
            </button>
            <button onClick={() => update({ matches: selected.slice(0, 1).map((m) => m.id) })} disabled={selected.length < 2}>
              Clear
            </button>
          </span>
        </h2>
        {matches.length ? (
          <MatchList
            matches={matches}
            selected={selected}
            mono={view.mono}
            grouped={view.sort === 'day'}
            onOnly={p.onOnlyMatch}
            onToggle={p.onToggleMatch}
            onSetMany={p.onSetMany}
          />
        ) : (
          <p className="muted small">No match for these filters.</p>
        )}
      </section>
      {selected.length > 1 && (
        <section>
          <h2>Match colors</h2>
          <Choice label="Match colors" options={[['each', 'One per match'], ['mono', 'One color']]} value={view.mono ? 'mono' : 'each'} onChange={(c) => update({ mono: c === 'mono' })} />
        </section>
      )}
      <section>
        <h2>
          Legend <span className="muted hint">hover to spot it on the map</span>
        </h2>
        <Legend counts={p.counts} hidden={p.hidden} active={p.pointedKind} onToggle={p.onLegendToggle} onAll={p.onLegendAll} onHover={p.onHover} />
      </section>
    </>
  );
}

/** The heatmap, on the right of the map: on or off, which kinds, colors. */
export function HeatPanel({ view, update, heat, days, layers }: { view: View; update: Update; heat: HeatData | null; days: string[]; layers: LayerHandlers }) {
  return (
    <aside className="heat-panel">
      <h2>Heatmap</h2>
      <Choice label="Heatmap" options={[['off', 'Off'], ['on', 'On']]} value={view.heatUnder ? 'on' : 'off'} onChange={(v) => update({ heatUnder: v === 'on' })} />
      {view.heatUnder && (
        <>
          <div className="all-none">
            <button onClick={() => update({ layers: [...ALL_LAYERS] })} disabled={view.layers.length === ALL_LAYERS.length}>
              All
            </button>
            <button onClick={() => update({ layers: [] })} disabled={!view.layers.length}>
              None
            </button>
          </div>
          <LayerList heat={heat} days={days} layers={view.layers} kills={view.kills} deaths={view.deaths} mono={view.heatMono} {...layers} />
          <h2>Colors</h2>
          <Choice label="Heatmap colors" options={[['each', 'One per kind'], ['mono', 'One color']]} value={view.heatMono ? 'mono' : 'each'} onChange={(c) => update({ heatMono: c === 'mono' })} />
          <p className="muted small">Brighter = more. Hide the paths in the legend for the heatmap alone.</p>
        </>
      )}
    </aside>
  );
}

/** Overview: the page's sections, as links. */
export function OverviewSide() {
  return (
    <section>
      <h2>On this page</h2>
      <nav className="toc">
        {OVERVIEW_SECTIONS.map(([id, label]) => (
          <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            {label}
          </button>
        ))}
      </nav>
    </section>
  );
}
