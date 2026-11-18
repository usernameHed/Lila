import { useEffect, useState } from 'react';
import { heatOf, legendOf } from '../lib/links';
import { EXPLAIN } from '../lib/style';
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
    </>
  );
}

interface RightProps {
  view: View;
  update: Update;
  heat: HeatData | null;
  days: string[];
  layers: LayerHandlers;
  counts: Partial<Record<LegendKey, number>>;
  hidden: LegendKey[];
  pointedKind: LegendKey | null;
  onLegendToggle: (k: LegendKey) => void;
  onLegendAll: (show: boolean) => void;
  onHover: (k: LegendKey | null) => void;
}

const ON_OFF: [string, string][] = [['on', 'On'], ['off', 'Off']];

/** Explanation key of a heatmap kind (loot and storm share their legend twin's name otherwise). */
const heatTip = (h: HeatLayer) => (h === 'loot' ? 'heatLoot' : h === 'storm' ? 'heatStorm' : h);

/** On the right of the map: what the replay draws (legend), and the heatmap under it. Each can be turned off. */
export function RightPanel(p: RightProps) {
  const { view, update } = p;
  // Explanation shown next to the hovered row, to the left of the panel (over the map).
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null);
  const showTip = (key: string | null, el?: HTMLElement) => setTip(key && el && EXPLAIN[key] ? { text: EXPLAIN[key], rect: el.getBoundingClientRect() } : null);
  // The row whose twin in the other card should pulse: the hovered one, or the one just ticked (for 2 s).
  const [hot, setHot] = useState<{ legend?: LegendKey; heat?: HeatLayer } | null>(null);
  const [flash, setFlash] = useState<{ legend?: LegendKey; heat?: HeatLayer } | null>(null);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 2000);
    return () => clearTimeout(id);
  }, [flash]);
  const linkedHeat = [hot?.legend, flash?.legend].map((k) => (k ? heatOf(k) : null)).filter((h): h is HeatLayer => !!h);
  const linkedLegend = [hot?.heat, flash?.heat].flatMap((h) => (h ? legendOf(h) : []));

  return (
    <aside className="right-panel">
      <section className="panel-card">
        <header>
          <h2>Legend</h2>
          <Choice big label="Replay on the map" options={ON_OFF} value={view.replayOn ? 'on' : 'off'} onChange={(v) => update({ replayOn: v === 'on' })} />
        </header>
        {/* Off: the content stays, dimmed and inert, so the panel keeps its size (nothing jumps). */}
        <div className={`panel-body ${view.replayOn ? '' : 'off'}`} aria-hidden={!view.replayOn} inert={!view.replayOn || undefined}>
          <p className="panel-hint">{view.replayOn ? 'Hover a row to spot it and read what it is · click to show or hide' : 'Off: paths and events hidden, the heatmap alone'}</p>
          <Legend
            counts={p.counts}
            hidden={p.hidden}
            active={p.pointedKind}
            linked={linkedLegend}
            onToggle={(k) => {
              p.onLegendToggle(k);
              setFlash({ legend: k });
            }}
            onAll={p.onLegendAll}
            onHover={(k) => {
              p.onHover(k);
              setHot(k ? { legend: k } : null);
            }}
            onTip={(k, el) => showTip(k, el)}
          />
          <label className="icon-size" title="Size of the icons on the map (kills, deaths, loot...)">
            Icon size
            <input type="range" min={0.6} max={2} step={0.1} value={view.iconScale} onChange={(e) => update({ iconScale: Number(e.target.value) })} />
            <span>{Math.round(view.iconScale * 100)}%</span>
          </label>
          <label className="icon-size" title="Icons of the same kind closer than this are drawn as one bigger icon with its count. Zoom in to split them. 0 = never group.">
            Grouping
            <input type="range" min={0} max={60} step={2} value={view.groupPx} onChange={(e) => update({ groupPx: Number(e.target.value) })} />
            <span>{view.groupPx ? `${view.groupPx} px` : 'off'}</span>
          </label>
        </div>
      </section>
      <section className="panel-card">
        <header>
          <h2>Heatmap</h2>
          <Choice big label="Heatmap" options={ON_OFF} value={view.heatUnder ? 'on' : 'off'} onChange={(v) => update({ heatUnder: v === 'on' })} />
        </header>
        <div className={`panel-body ${view.heatUnder ? '' : 'off'}`} aria-hidden={!view.heatUnder} inert={!view.heatUnder || undefined}>
          <div className="all-none">
            <button onClick={() => update({ layers: [...ALL_LAYERS] })} disabled={view.layers.length === ALL_LAYERS.length}>
              All
            </button>
            <button onClick={() => update({ layers: [] })} disabled={!view.layers.length}>
              None
            </button>
            <Choice label="Heatmap colors" options={[['each', 'Per kind'], ['mono', 'Merge']]} value={view.heatMono ? 'mono' : 'each'} onChange={(c) => update({ heatMono: c === 'mono' })} />
          </div>
          <LayerList
            heat={p.heat}
            days={p.days}
            layers={view.layers}
            kills={view.kills}
            deaths={view.deaths}
            mono={view.heatMono}
            linked={linkedHeat}
            onTip={(h, el) => {
              showTip(h ? heatTip(h) : null, el);
              setHot(h ? { heat: h } : null);
            }}
            onToggle={(h) => {
              p.layers.onToggle(h);
              setFlash({ heat: h });
            }}
            onWho={p.layers.onWho}
          />
        </div>
      </section>
      {tip && (
        <div className="row-tip" role="tooltip" style={{ right: window.innerWidth - tip.rect.left + 12, top: tip.rect.top + tip.rect.height / 2 }}>
          {tip.text}
        </div>
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
