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
        <Choice
          label="Which matches"
          options={[['all', 'All'], ['once', 'Played only once'], ['pvp', 'Fought a player']]}
          value={view.players}
          onChange={(players) => update({ players })}
        />
      </section>
      <section className="grow">
        <h2 className="with-actions">
          <span className="count">{selected.length > 1 ? `${selected.length} of ${matches.length} selected` : `${matches.length} matches`}</span>
          <span className="actions">
            <button onClick={() => update({ matches: ALL })} disabled={selected.length === matches.length}>
              Select all
            </button>
            <button onClick={() => update({ matches: selected.slice(0, 1).map((m) => m.id) })} disabled={selected.length < 2}>
              Clear
            </button>
          </span>
        </h2>
        <MatchList matches={matches} selected={selected} mono={view.mono} onOnly={p.onOnlyMatch} onToggle={p.onToggleMatch} onSetMany={p.onSetMany} />
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
