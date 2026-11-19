import { useState } from 'react';
import { LAYER_ROWS, allHeat, heatOn, toggleHeat, type LayerRow } from '../lib/layers';
import { applyFilter } from '../lib/matchFilter';
import { EXPLAIN, formatDay, heatRgb, rgbCss } from '../lib/style';
// The panels around the map: left (which matches), right (the layers: icons and heatmaps), and the Overview's
// table of contents.
// App owns the state; these only show it.
import type { LegendKey } from '../lib/draw';
import type { HeatData, MatchSummary } from '../lib/types';
import { ALL, NONE, legendToggle, type View } from '../lib/view';
import { LEGEND_KEYS, LegendIcon, legendColor, legendLabel } from './Legend';
import { OVERVIEW_SECTIONS } from './Overview';
import { MatchList } from './Replay';

type Update = (patch: Partial<View>) => void;

interface ReplayProps {
  view: View;
  update: Update;
  matches: MatchSummary[];
  /** Every day of the data, for the Day chips. */
  days: string[];
  selected: MatchSummary[];
  onOnlyMatch: (id: string) => void;
  onToggleMatch: (id: string) => void;
  onSetMany: (ids: string[], on: boolean) => void;
}

type Option<T> = [T, React.ReactNode, string?]; // value, chip content, tooltip
const ENDED: Option<View['ended']>[] = [
  ['survived', 'Survived', 'No death logged'],
  ['bot', <><LegendIcon k="diedToBot" size={12} /> Bot</>, 'Killed by a bot'],
  ['player', <><LegendIcon k="diedToPlayer" size={12} /> Player</>, 'Killed by a player'],
  ['storm', <><LegendIcon k="storm" size={12} /> Storm</>, 'Died to the storm'],
];
const GAME: Option<View['game']>[] = [
  ['player', <><LegendIcon k="humanPath" size={12} /> No bots</>, 'Matches where only the player was recorded, no bot'],
  ['bots', <><LegendIcon k="botPath" size={12} /> Bots</>, 'Matches where the bots were recorded too, beside the player: their paths, kills and deaths are on the map'],
  ['multi', <><LegendIcon k="humanPath" size={12} /> 2 players</>, 'Matches where two players were recorded'],
];
const LENGTH: Option<View['length']>[] = [['short', '<5 min'], ['mid', '5-10 min'], ['long', '>10 min']];

/**
 * One filter on one line: a label, then chips. Click a chip to keep only those matches, click it again to show
 * every match. `count` says how many matches each chip would leave (shown, or in the tooltip when space is short).
 */
function FilterRow<T extends string>({ label, value, options, count, countInTip, onChange }: { label: string; value: T; options: Option<T>[]; count?: (v: T) => number; countInTip?: boolean; onChange: (v: T | 'any') => void }) {
  return (
    <div className="filter-row" role="group" aria-label={label}>
      <span className="filter-label">{label}</span>
      <span className="chips one-line">
        <button aria-pressed={value === 'any'} className={`chip ${value === 'any' ? 'on' : ''}`} data-tip="Every match" onClick={() => onChange('any')}>
          All
        </button>
        {options.map(([v, text, tip]) => {
          const n = count?.(v);
          const title = [tip, countInTip && n !== undefined ? `${n} matches` : null, v === value ? 'Click again to show every match' : null].filter(Boolean).join(' · ');
          return (
            <button key={v} aria-pressed={v === value} data-tip={title} className={`chip ${v === value ? 'on' : ''}`} onClick={() => onChange(v === value ? 'any' : v)}>
              {text}
              {n !== undefined && !countInTip && <i>{n}</i>}
            </button>
          );
        })}
      </span>
    </div>
  );
}

export function ReplaySide(p: ReplayProps) {
  const { view, update, matches, selected } = p;
  /** Custom: matches picked one by one in the list. Otherwise every (filtered) match of the chosen day plays. */
  const custom = view.matches !== ALL;
  return (
    <>
      <section className={custom ? 'grow' : ''}>
        <h2 className="with-actions">
          <span>Matches</span>
          <span className="count day-count">
            {custom ? `${selected.length} of ${matches.length} shown` : `${selected.length} match${selected.length === 1 ? '' : 'es'} together`}
          </span>
        </h2>
        <div className="filter-row" role="group" aria-label="Day">
          <span className="filter-label" data-tip="Day of the match (all in February 2026)">Feb</span>
          <span className="chips one-line">
            <button aria-pressed={view.day === 'all'} className={`chip ${view.day === 'all' ? 'on' : ''}`} data-tip="Every day" onClick={() => update({ day: 'all' })}>
              All
            </button>
            {p.days.map((d) => (
              <button
                key={d}
                aria-pressed={view.day === d}
                className={`chip ${view.day === d ? 'on' : ''}`}
                data-tip={`${formatDay(d)} only${d === '2026-02-14' ? ' (partial day: the export stops mid-day)' : ''}${view.day === d ? ' · Click again for every day' : ''}`}
                onClick={() => update({ day: view.day === d ? 'all' : d })}
              >
                {Number(d.slice(8))}
              </button>
            ))}
          </span>
        </div>
        <div className="filter-row" role="group" aria-label="How many matches">
          <span className="filter-label">Show</span>
          <span className="chips one-line">
            <button aria-pressed={!custom && !view.recent} className={`chip ${!custom && !view.recent ? 'on' : ''}`} data-tip="Every match of the day(s), replayed together" onClick={() => update({ matches: ALL, recent: 0 })}>
              All
            </button>
            {([10, 100] as const).map((n) => (
              <button
                key={n}
                aria-pressed={!custom && view.recent === n}
                className={`chip ${!custom && view.recent === n ? 'on' : ''}`}
                data-tip={`${view.random ? `${n} matches drawn at random` : `The last ${n} matches`} of the day(s), replayed together${!custom && view.recent === n ? ' · Click again for every match' : ''}`}
                onClick={() => update({ matches: ALL, recent: !custom && view.recent === n ? 0 : n })}
              >
                {n}
              </button>
            ))}
            <button
              aria-pressed={custom}
              className={`chip ${custom ? 'on' : ''}`}
              data-tip={custom ? 'Click again for every match' : 'Pick the matches yourself, from the list'}
              onClick={() => update(custom ? { matches: ALL } : { recent: 0, matches: selected.slice(0, 1).map((m) => m.id) })}
            >
              Custom
            </button>
            <label className="random-box" data-tip="10 or 100: drawn at random (ticked) or the last ones (unticked)">
              <input type="checkbox" checked={view.random} onChange={(e) => update({ random: e.target.checked })} />
              Random
            </label>
            {view.random && !custom && view.recent > 0 && (
              <button className="redraw" onClick={() => update({ seed: view.seed + 1 })} data-tip="Draw other matches">
                ↻
              </button>
            )}
          </span>
        </div>
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
    </>
  );
}

/**
 * The player-run filters (game, outcome, length), shown at the top of the "On the map" panel over the map. Each
 * chip says how many matches it would leave; "Clear all filters" also resets the day and the 10 / 100 choice.
 */
export function MatchFilters({ view, update, pool }: { view: View; update: Update; pool: MatchSummary[] }) {
  const custom = view.matches !== ALL;
  const base = { ended: view.ended, length: view.length, game: view.game, sort: view.sort };
  /** How many matches there would be with this one filter changed (the others kept). */
  const countWith = (patch: Partial<typeof base>) => applyFilter(pool, { ...base, ...patch }).length;
  const dayPicked = view.day !== 'all' || (!custom && view.recent > 0);
  const filtered = view.ended !== 'any' || view.length !== 'any' || view.game !== 'any' || dayPicked;
  /** Back to every match: any game, outcome and length, all days (matches picked in Custom are kept). */
  const clearAll = () => update({ ended: 'any', length: 'any', game: 'any', ...(dayPicked ? { day: 'all', recent: 0 } : {}) });
  return (
      <section className="map-filters">
        <h2 className="with-actions">
          <span data-tip="Each match is one player's run: pick runs by how they went">Filters · player runs</span>
          <span className="actions">
            <button onClick={clearAll} disabled={!filtered} data-tip="Any game, any outcome, any length, all days">
              Clear all filters
            </button>
          </span>
        </h2>
        <FilterRow label="Game" value={view.game} options={GAME} count={(v) => countWith({ game: v })} countInTip onChange={(v) => update({ game: v })} />
        <FilterRow label="Ended" value={view.ended} options={ENDED} count={(v) => countWith({ ended: v })} countInTip onChange={(v) => update({ ended: v })} />
        <FilterRow label="Length" value={view.length} options={LENGTH} onChange={(v) => update({ length: v })} />
      </section>
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

type Tip = (key: string | null, el?: HTMLElement) => void;

/** An element row: tick box (shown or not), its icon as on the map, its name, how many. */
function ElementLine({ k, p, showTip }: { k: LegendKey; p: RightProps; showTip: Tip }) {
  const { view, update } = p;
  const on = view.replayOn && !view.hidden.includes(k);
  const count = k === 'humanPath' || k === 'botPath' ? null : p.counts[k] ?? 0;
  const toggle = () => update({ replayOn: true, hidden: view.replayOn ? legendToggle(view.hidden, k) : LEGEND_KEYS.filter((x) => x !== k) });
  return (
    <li
      className={`layer-line ${on ? '' : 'off'} ${count === 0 ? 'none' : ''} ${p.pointedKind === k ? 'pulse' : ''}`}
      onMouseEnter={(e) => {
        if (on) p.onHover(k);
        showTip(k, e.currentTarget);
      }}
      onMouseLeave={() => {
        p.onHover(null);
        showTip(null);
      }}
    >
      <button className="layer-label" onClick={toggle} aria-pressed={on}>
        <span className={`tick-box ${on ? 'on' : ''}`} style={on ? { background: legendColor(k), borderColor: legendColor(k) } : { borderColor: legendColor(k) }} aria-hidden />
        <span className="legend-icon">
          <LegendIcon k={k} />
        </span>
        <span className="legend-label">{legendLabel(k)}</span>
        {count !== null && <span className="count">{count}</span>}
      </button>
    </li>
  );
}

/** A heatmap row: tick box in the heatmap's color (the color of its icons), its name. */
function HeatLine({ row, p, showTip }: { row: LayerRow; p: RightProps; showTip: Tip }) {
  const { view, update } = p;
  if (!row.heat) return null;
  const on = heatOn(view, row);
  const rgb = heatRgb(row.heat.layer, row.heat.who);
  return (
    <li
      className={`layer-line ${on ? '' : 'off'}`}
      onMouseEnter={(e) => showTip(row.heatTip ?? null, e.currentTarget)}
      onMouseLeave={() => showTip(null)}
    >
      <button className="layer-label" onClick={() => update(toggleHeat(view, row))} aria-pressed={on}>
        <span className={`tick-box ${on ? 'on' : ''}`} style={on ? { background: rgbCss(rgb), borderColor: rgbCss(rgb) } : { borderColor: rgbCss(rgb, 0.8) }} aria-hidden />
        <span className="heat-dot" style={{ background: rgbCss(rgb) }} />
        <span className="legend-label">{row.heatLabel}</span>
      </button>
    </li>
  );
}

/**
 * On the right of the map: one list for everything drawn. Each kind can show as icons (or lines) on the replay, as
 * a heatmap of the whole selection, or both: the same data seen two ways, switched in one place.
 */
export function RightPanel(p: RightProps) {
  const { view, update } = p;
  // Explanation shown next to the hovered row, to the right of the panel (over the map).
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null);
  const showTip = (key: string | null, el?: HTMLElement) => setTip(key && el && EXPLAIN[key] ? { text: EXPLAIN[key], rect: el.getBoundingClientRect() } : null);
  const anyIcons = view.replayOn && view.hidden.length < LEGEND_KEYS.length;
  const anyHeat = view.heatUnder && view.layers.length > 0;
  return (
    <aside className="right-panel">
      <section className="panel-card">
        <header className="with-actions">
          <h2>Elements</h2>
          <span className="actions">
            <button onClick={() => update(anyIcons ? { hidden: [...LEGEND_KEYS] } : { replayOn: true, hidden: [] })}>{anyIcons ? 'None' : 'All'}</button>
          </span>
        </header>
        <ul className="legend layer-list">
          {LEGEND_KEYS.map((k) => (
            <ElementLine key={k} k={k} p={p} showTip={showTip} />
          ))}
        </ul>
        <div className="layer-settings">
          <label className="icon-size" data-tip="Size of the icons on the map">
            Icon size
            <input type="range" min={0.6} max={4} step={0.1} value={view.iconScale} onChange={(e) => update({ iconScale: Number(e.target.value) })} />
            <span>{Math.round(view.iconScale * 100)}%</span>
          </label>
          <label className="icon-size" data-tip="Thickness of the paths on the map">
            Path width
            <input type="range" min={0.5} max={4} step={0.1} value={view.pathWidth} onChange={(e) => update({ pathWidth: Number(e.target.value) })} />
            <span>x{view.pathWidth.toFixed(1)}</span>
          </label>
          <label className="icon-size" data-tip="How solid the paths are (lower: see-through, higher: solid)">
            Path opacity
            <input type="range" min={0.3} max={7.5} step={0.1} value={view.pathAlpha} onChange={(e) => update({ pathAlpha: Number(e.target.value) })} />
            <span>x{view.pathAlpha.toFixed(1)}</span>
          </label>
        </div>
      </section>
      <section className="panel-card">
        <header className="with-actions">
          <h2>Heatmap</h2>
          <span className="actions">
            <button onClick={() => update(allHeat(!anyHeat))}>{anyHeat ? 'None' : 'All'}</button>
          </span>
        </header>
        <ul className="legend layer-list">
          {LAYER_ROWS.filter((r) => r.heat).map((r) => (
            <HeatLine key={r.id} row={r} p={p} showTip={showTip} />
          ))}
        </ul>
      </section>
      {tip && (
        <div className="row-tip" role="tooltip" style={{ left: tip.rect.right + 12, top: tip.rect.top + tip.rect.height / 2 }}>
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
