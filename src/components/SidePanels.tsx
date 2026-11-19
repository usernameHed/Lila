import { useState } from 'react';
import { LAYER_ROWS, allHeat, heatOn, toggleHeat, type LayerRow } from '../lib/layers';
import { applyFilter } from '../lib/matchFilter';
import { EXPLAIN, HEAT_LAYERS, formatDay, heatRgb, rgbCss } from '../lib/style';
// The panels around the map: left (which matches), right (the layers: icons and heatmaps), and the Overview's
// table of contents.
// App owns the state; these only show it.
import type { LegendKey } from '../lib/draw';
import type { HeatData, MatchSummary } from '../lib/types';
import { ALL, NONE, legendToggle, type View } from '../lib/view';
import { Choice } from './Choice';
import { LEGEND_KEYS, LegendIcon, legendColor, legendLabel } from './Legend';
import { OVERVIEW_SECTIONS } from './Overview';
import { MatchList } from './Replay';

type Update = (patch: Partial<View>) => void;

interface ReplayProps {
  view: View;
  update: Update;
  matches: MatchSummary[];
  /** The map and day's matches before the filters: chips count from it. */
  pool: MatchSummary[];
  /** Every day of the data, for the Day chips. */
  days: string[];
  selected: MatchSummary[];
  onOnlyMatch: (id: string) => void;
  onToggleMatch: (id: string) => void;
  onSetMany: (ids: string[], on: boolean) => void;
}

type Option<T> = [T, React.ReactNode, string?]; // value, chip content, tooltip
const ENDED: Option<View['ended']>[] = [
  ['any', 'Any'],
  ['survived', 'Survived', 'No death logged'],
  ['bot', <><LegendIcon k="diedToBot" size={12} /> Bot</>, 'Killed by a bot'],
  ['player', <><LegendIcon k="diedToPlayer" size={12} /> Player</>, 'Killed by a player'],
  ['storm', <><LegendIcon k="storm" size={12} /> Storm</>, 'Died to the storm'],
];
const GAME: Option<View['game']>[] = [
  ['any', 'Any'],
  ['bots', <><LegendIcon k="botPath" size={12} /> Bots recorded</>, 'Matches where the bots were recorded too: their paths, kills and deaths are on the map'],
  ['pvp', <><LegendIcon k="killPlayer" size={12} /> Vs player</>, 'Matches where the player killed or was killed by another player'],
];
const LENGTH: Option<View['length']>[] = [['any', 'Any'], ['short', '<5 min'], ['mid', '5-10'], ['long', '>10']];

/** One filter as a row of chips: one click picks it, each chip says how many matches it would leave. */
function FilterRow<T extends string>({ label, value, options, count, onChange }: { label: string; value: T; options: Option<T>[]; count?: (v: T) => number; onChange: (v: T) => void }) {
  return (
    <div className="filter-row" role="radiogroup" aria-label={label}>
      <span className="filter-label">{label}</span>
      <span className="chips">
        {options.map(([v, text, tip]) => (
          <button key={v} role="radio" aria-checked={v === value} title={tip} className={`chip ${v === value ? 'on' : ''}`} onClick={() => onChange(v)}>
            {text}
            {count && v !== 'any' && <i>{count(v)}</i>}
          </button>
        ))}
      </span>
    </div>
  );
}

export function ReplaySide(p: ReplayProps) {
  const { view, update, matches, selected, pool } = p;
  /** Custom: matches picked one by one in the list. Otherwise every (filtered) match of the chosen day plays. */
  const custom = view.matches !== ALL;
  const base = { ended: view.ended, length: view.length, game: view.game, sort: view.sort };
  /** How many matches there would be with this one filter changed (the others kept). */
  const countWith = (patch: Partial<typeof base>) => applyFilter(pool, { ...base, ...patch }).length;
  const dayPicked = !custom && (view.day !== 'all' || view.recent > 0);
  const filtered = view.ended !== 'any' || view.length !== 'any' || view.game !== 'any' || dayPicked;
  /** Back to every match: any outcome, any length, all days (matches picked in Custom are kept). */
  const clearAll = () => update({ ended: 'any', length: 'any', game: 'any', ...(dayPicked ? { day: 'all', recent: 0 } : {}) });
  return (
    <>
      <section className={custom ? 'grow' : ''}>
        <h2 className="with-actions">
          <span>Day</span>
          <span className="count day-count">
            {custom ? `${selected.length} of ${matches.length} shown` : `${selected.length} match${selected.length === 1 ? '' : 'es'} together`}
          </span>
        </h2>
        <span className="chips" role="radiogroup" aria-label="Day">
          {['all', ...p.days].map((d) => (
            <button
              key={d}
              role="radio"
              aria-checked={!custom && !view.recent && view.day === d}
              className={`chip ${!custom && !view.recent && view.day === d ? 'on' : ''}`}
              title={d === 'all' ? 'Every match of every day, replayed together' : `Every match of ${formatDay(d)}, replayed together${d === '2026-02-14' ? ' (partial day: the export stops mid-day)' : ''}`}
              onClick={() => update({ day: d, matches: ALL, recent: 0 })}
            >
              {d === 'all' ? 'All days' : formatDay(d)}
            </button>
          ))}
          {([10, 100] as const).map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={!custom && view.recent === n}
              className={`chip ${!custom && view.recent === n ? 'on' : ''}`}
              title={`The last ${n} matches of the data, replayed together (by day: the time of day is not logged)`}
              onClick={() => update({ day: 'all', matches: ALL, recent: n })}
            >
              Last {n}
            </button>
          ))}
          <button
            role="radio"
            aria-checked={custom}
            className={`chip ${custom ? 'on' : ''}`}
            title="Pick the matches yourself, from the list"
            onClick={() => !custom && update({ day: 'all', recent: 0, matches: selected.slice(0, 1).map((m) => m.id) })}
          >
            Custom
          </button>
        </span>
        {custom && (
          <>
            <div className="custom-actions">
              <button onClick={() => update({ matches: matches.map((m) => m.id) })} disabled={selected.length === matches.length}>
                Select all
              </button>
              <button onClick={() => update({ matches: NONE })} disabled={!selected.length}>
                Clear
              </button>
            </div>
            {matches.length ? (
              <MatchList
                matches={matches}
                selected={selected}
                mono={view.mono}
                grouped
                onOnly={p.onOnlyMatch}
                onToggle={p.onToggleMatch}
                onSetMany={p.onSetMany}
              />
            ) : (
              <p className="muted small">No match for these filters.</p>
            )}
          </>
        )}
      </section>
      <section>
        <h2 className="with-actions">
          <span title="Each match is one player's run: pick runs by how they went">Filters · player runs</span>
          <span className="actions">
            <button onClick={clearAll} disabled={!filtered} title="Any game, any outcome, any length, all days">
              Clear all filters
            </button>
          </span>
        </h2>
        <FilterRow label="Game" value={view.game} options={GAME} count={(v) => countWith({ game: v })} onChange={(v) => update({ game: v })} />
        <FilterRow label="Ended" value={view.ended} options={ENDED} count={(v) => countWith({ ended: v })} onChange={(v) => update({ ended: v })} />
        <FilterRow label="Length" value={view.length} options={LENGTH} onChange={(v) => update({ length: v })} />
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
  counts: Partial<Record<LegendKey, number>>;
  pointedKind: LegendKey | null;
  onHover: (k: LegendKey | null) => void;
}

/** One row: what it is, how many, and two switches: icons on the replay, heatmap of the selection. */
function LayerLine({ row, p, showTip }: { row: LayerRow; p: RightProps; showTip: (key: string | null, el?: HTMLElement) => void }) {
  const { view, update } = p;
  const k = row.icons;
  const iconsOn = !!k && view.replayOn && !view.hidden.includes(k);
  const heatIsOn = heatOn(view, row);
  const rowRgb = row.heat ? heatRgb(row.heat.layer, row.heat.who) : null;
  const label = k ? legendLabel(k) : row.heat ? HEAT_LAYERS[row.heat.layer].label : row.id;
  const count = k ? (k === 'humanPath' || k === 'botPath' ? null : p.counts[k] ?? 0) : null;
  const toggleIcons = () => k && update({ replayOn: true, hidden: view.replayOn ? legendToggle(view.hidden, k) : LEGEND_KEYS.filter((x) => x !== k) });
  const toggleHeatRow = () => update(toggleHeat(view, row));
  return (
    <li
      className={`layer-line ${iconsOn || heatIsOn ? '' : 'off'} ${count === 0 ? 'none' : ''} ${k && p.pointedKind === k ? 'pulse' : ''}`}
      onMouseEnter={(e) => {
        if (k && iconsOn) p.onHover(k);
        showTip(row.id, e.currentTarget);
      }}
      onMouseLeave={() => {
        p.onHover(null);
        showTip(null);
      }}
    >
      <button className="layer-label" onClick={k ? toggleIcons : toggleHeatRow}>
        <span className="legend-icon">{k ? <LegendIcon k={k} /> : <span className="heat-dot" style={{ background: rowRgb ? rgbCss(rowRgb) : undefined }} />}</span>
        <span className="legend-label">{label}</span>
        {count !== null && <span className="count">{count}</span>}
      </button>
      <span className="layer-switches">
        {k ? (
          <button className={`tick-box ${iconsOn ? 'on' : ''}`} style={iconsOn ? { background: legendColor(k), borderColor: legendColor(k) } : { borderColor: legendColor(k) }} onClick={toggleIcons} aria-pressed={iconsOn} aria-label={`${label}: icons on the replay`} title="Icons on the replay" />
        ) : (
          <span className="tick-none" />
        )}
        {row.heat && rowRgb ? (
          <button className={`tick-box heat ${heatIsOn ? 'on' : ''}`} style={heatIsOn ? { background: rgbCss(rowRgb), borderColor: rgbCss(rowRgb) } : { borderColor: rgbCss(rowRgb, 0.8) }} onClick={toggleHeatRow} aria-pressed={heatIsOn} aria-label={`${label}: heatmap`} title={`Heatmap: ${HEAT_LAYERS[row.heat.layer].hint}`} />
        ) : (
          <span className="tick-none" title="No heatmap for this kind" />
        )}
      </span>
    </li>
  );
}

/**
 * On the right of the map: one list for everything drawn. Each kind can show as icons (or lines) on the replay, as
 * a heatmap of the whole selection, or both: the same data seen two ways, switched in one place.
 */
export function RightPanel(p: RightProps) {
  const { view, update } = p;
  // Explanation shown next to the hovered row, to the left of the panel (over the map).
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null);
  const showTip = (key: string | null, el?: HTMLElement) => setTip(key && el && EXPLAIN[key] ? { text: EXPLAIN[key], rect: el.getBoundingClientRect() } : null);
  const anyIcons = view.replayOn && view.hidden.length < LEGEND_KEYS.length;
  const anyHeat = view.heatUnder && view.layers.length > 0;
  return (
    <aside className="right-panel">
      <section className="panel-card">
        <header>
          <h2>Layers</h2>
        </header>
        <div className="layer-head">
          <span>Hover to read what it is</span>
          <button onClick={() => update(anyIcons ? { hidden: [...LEGEND_KEYS] } : { replayOn: true, hidden: [] })} title={anyIcons ? 'Hide every icon and path' : 'Show every icon and path'}>
            Icons
          </button>
          <button onClick={() => update(allHeat(!anyHeat))} title={anyHeat ? 'Hide every heatmap' : 'Show every heatmap'}>
            Heat
          </button>
        </div>
        <ul className="legend layer-list">
          {LAYER_ROWS.filter((r) => !r.analysis).map((r) => (
            <LayerLine key={r.id} row={r} p={p} showTip={showTip} />
          ))}
        </ul>
        <p className="layer-group">Analysis, heat only</p>
        <ul className="legend layer-list">
          {LAYER_ROWS.filter((r) => r.analysis).map((r) => (
            <LayerLine key={r.id} row={r} p={p} showTip={showTip} />
          ))}
        </ul>
        <div className="layer-settings">
          <label className="icon-size" title="Size of the icons on the map">
            Icon size
            <input type="range" min={0.6} max={4} step={0.1} value={view.iconScale} onChange={(e) => update({ iconScale: Number(e.target.value) })} />
            <span>{Math.round(view.iconScale * 100)}%</span>
          </label>
          <label className="icon-size" title="Thickness of the paths on the map">
            Path width
            <input type="range" min={0.5} max={4} step={0.1} value={view.pathWidth} onChange={(e) => update({ pathWidth: Number(e.target.value) })} />
            <span>x{view.pathWidth.toFixed(1)}</span>
          </label>
          <label className="icon-size" title="How solid the paths are (lower: see-through, higher: solid)">
            Path opacity
            <input type="range" min={0.3} max={7.5} step={0.1} value={view.pathAlpha} onChange={(e) => update({ pathAlpha: Number(e.target.value) })} />
            <span>x{view.pathAlpha.toFixed(1)}</span>
          </label>
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
          <button
            key={id}
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {label}
          </button>
        ))}
      </nav>
    </section>
  );
}
