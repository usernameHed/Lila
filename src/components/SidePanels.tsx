// The left panel's mode-specific parts: Match replay, Heatmaps, Overview. App owns the state; these only show it.
import type { LegendKey } from '../lib/draw';
import type { HeatData, HeatLayer, MatchSummary, Who } from '../lib/types';
import { ALL, type View } from '../lib/view';
import { Choice } from './Choice';
import { LayerList } from './Heat';
import { Legend } from './Legend';
import { OVERVIEW_SECTIONS } from './Overview';
import { MatchList } from './Replay';

type Update = (patch: Partial<View>) => void;

export interface LayerHandlers {
  onToggle: (l: HeatLayer) => void;
  onOnly: (l: HeatLayer) => void;
  onWho: (kind: 'kills' | 'deaths', who: Who) => void;
}

interface ReplayProps {
  view: View;
  update: Update;
  matches: MatchSummary[];
  selected: MatchSummary[];
  onOnlyMatch: (id: string) => void;
  onToggleMatch: (id: string) => void;
  counts: Partial<Record<LegendKey, number>>;
  hidden: LegendKey[];
  onLegendToggle: (k: LegendKey) => void;
  onLegendOnly: (k: LegendKey) => void;
  onHover: (k: LegendKey | null) => void;
  heat: HeatData | null;
  days: string[];
  layers: LayerHandlers;
}

export function ReplaySide(p: ReplayProps) {
  const { view, update, matches, selected } = p;
  return (
    <>
      <section>
        <h2>Players</h2>
        <Choice label="Which players" options={[['all', 'All'], ['once', 'Played only once']]} value={view.players} onChange={(players) => update({ players })} />
      </section>
      <section className="grow">
        <h2 className="with-actions">
          Match <span className="count">{selected.length > 1 ? `${selected.length} of ${matches.length}` : matches.length}</span>
          <span className="actions">
            <button onClick={() => update({ matches: ALL })} disabled={selected.length === matches.length}>
              Select all
            </button>
            <button onClick={() => update({ matches: selected.slice(0, 1).map((m) => m.id) })} disabled={selected.length < 2}>
              Clear
            </button>
          </span>
        </h2>
        <MatchList matches={matches} selected={selected} mono={view.mono} onOnly={p.onOnlyMatch} onToggle={p.onToggleMatch} />
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
        <Legend counts={p.counts} hidden={p.hidden} onToggle={p.onLegendToggle} onOnly={p.onLegendOnly} onHover={p.onHover} />
      </section>
      <section>
        <h2>Heatmap under the replay</h2>
        <Choice label="Heatmap under the replay" options={[['off', 'Off'], ['on', 'On']]} value={view.heatUnder ? 'on' : 'off'} onChange={(v) => update({ heatUnder: v === 'on' })} />
        {view.heatUnder && (
          <div className="under-layers">
            <LayerList heat={p.heat} days={p.days} layers={view.layers} kills={view.kills} deaths={view.deaths} mono={false} {...p.layers} />
          </div>
        )}
      </section>
    </>
  );
}

export function HeatSide({ view, update, heat, days, layers }: { view: View; update: Update; heat: HeatData | null; days: string[]; layers: LayerHandlers }) {
  return (
    <section className="grow">
      <h2>
        Show <span className="muted hint">tick boxes to stack kinds</span>
      </h2>
      <LayerList heat={heat} days={days} layers={view.layers} kills={view.kills} deaths={view.deaths} mono={view.mono} {...layers} />
      <div className="heat-options">
        <h2>Colors</h2>
        <Choice label="Heatmap colors" options={[['each', 'One per kind'], ['mono', 'One color']]} value={view.mono ? 'mono' : 'each'} onChange={(c) => update({ mono: c === 'mono' })} />
      </div>
    </section>
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
