import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadHeat } from '../lib/data';
import { uvToPixel } from '../lib/coords';
import { drawFightLine, drawHeat, heatCanvas } from '../lib/draw';
import { blur, normalize, render, strongest, sumDays } from '../lib/heat';
import { HEAT_LAYERS, MONO_RGB, WHO_LABEL, rgbCss } from '../lib/style';
import type { HeatData, HeatLayer, MapId, Who } from '../lib/types';
import { Choice } from './Choice';
import { MapCanvas } from './MapCanvas';

const KINDS = Object.keys(HEAT_LAYERS) as HeatLayer[]; // drawing order
const WHOS: Who[] = ['bots', 'players', 'both'];

/** Pipeline layers behind a kind: kills and deaths split by the other side (bots, players). */
export function sourcesOf(kind: HeatLayer, who: Who): string[] {
  if (kind !== 'kills' && kind !== 'deaths') return [kind];
  const [bots, players] = [`${kind}Bot`, `${kind}Player`];
  return who === 'bots' ? [bots] : who === 'players' ? [players] : [bots, players];
}

function sum(heat: HeatData, sources: string[], days: string[]): Float32Array {
  const out = new Float32Array(heat.grid * heat.grid);
  for (const s of sources) {
    const part = sumDays(heat.layers[s] ?? {}, days, heat.grid);
    for (let i = 0; i < out.length; i++) out[i] += part[i];
  }
  return out;
}

/** The killer-to-victim lines of the chosen days (too few for a heat grid: drawn as lines). */
const fightsOf = (heat: HeatData, days: string[]) => heat.fights.filter((f) => days.includes(f[0]));

/** Event count behind a kind for the chosen days (the line of fire counts fights, not cells). */
function count(heat: HeatData | null, kind: HeatLayer, who: Who, days: string[]): number | null {
  if (!heat) return null;
  if (kind === 'fire') return fightsOf(heat, days).length;
  let n = 0;
  for (const s of sourcesOf(kind, who)) for (const d of days) {
    const cells = heat.layers[s]?.[d] ?? [];
    for (let i = 1; i < cells.length; i += 2) n += cells[i];
  }
  return n;
}

export function useHeat(map: MapId) {
  const [heat, setHeat] = useState<HeatData | null>(null);
  useEffect(() => {
    let live = true;
    setHeat(null);
    loadHeat(map).then((h) => live && setHeat(h));
    return () => {
      live = false;
    };
  }, [map]);
  return heat;
}

export interface HeatOptions {
  layers: HeatLayer[];
  kills: Who;
  deaths: Who;
  mono: boolean;
}

/**
 * Draws the chosen heatmap kinds over the map: one prepared picture per kind (or one for all in one-color mode),
 * then the line of fire as arrows. Pictures are built once per change, so redrawing every frame is cheap
 * (the replay can play on top).
 */
export function useHeatDraw(heat: HeatData | null, days: string[], o: HeatOptions, uvUnits: number) {
  const pictures = useMemo(() => {
    if (!heat) return [];
    const kinds = KINDS.filter((l) => l !== 'fire' && o.layers.includes(l));
    const grids = kinds.map((l) => {
      const values = sum(heat, sourcesOf(l, l === 'kills' ? o.kills : o.deaths), days);
      const total = values.reduce((a, b) => a + b, 0);
      // Sparse kinds (storm deaths: 39 in all) get a wider blur, so single events stay visible.
      return normalize(blur(values, heat.grid, total < 200 ? 3 : 2));
    });
    const out = o.mono ? (grids.length ? [render(strongest(grids), heat.grid, MONO_RGB)] : []) : grids.map((k, i) => render(k, heat.grid, HEAT_LAYERS[kinds[i]].rgb));
    return out.map((p) => heatCanvas(p.pixels, p.size));
  }, [heat, days, o.layers, o.kills, o.deaths, o.mono]);

  const fights = useMemo(() => (heat && o.layers.includes('fire') ? fightsOf(heat, days) : []), [heat, days, o.layers]);

  return useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      for (const p of pictures) drawHeat(ctx, p, size);
      for (const [, ku, kv, vu, vv, bot, , , inferred] of fights) drawFightLine(ctx, uvToPixel(ku, kv, uvUnits, size), uvToPixel(vu, vv, uvUnits, size), bot, inferred ? 0.55 : 1);
    },
    [pictures, fights, uvUnits],
  );
}

interface ListProps extends HeatOptions {
  heat: HeatData | null;
  days: string[];
  onToggle: (l: HeatLayer) => void;
  onOnly: (l: HeatLayer) => void;
  onWho: (kind: 'kills' | 'deaths', who: Who) => void;
}

/** Every kind in its color: click a row to show it alone, its box to add or remove it; kills and deaths also
 * pick bots, players or both. */
export function LayerList({ heat, days, onToggle, onOnly, onWho, ...o }: ListProps) {
  return (
    <div className="segmented layers">
      {KINDS.map((id) => {
        const on = o.layers.includes(id);
        const { label, hint, rgb, split } = HEAT_LAYERS[id];
        const color = o.mono ? MONO_RGB : rgb;
        const who = id === 'kills' ? o.kills : o.deaths;
        return (
          <div key={id} className={`layer ${on ? 'on' : ''}`}>
            <div className="layer-row">
              <button
                className="swatch-box"
                onClick={() => onToggle(id)}
                aria-pressed={on}
                aria-label={`${on ? 'Hide' : 'Add'} ${label}`}
                title={on ? 'Hide this kind' : 'Add this kind to the map'}
                style={on ? { background: rgbCss(color), borderColor: rgbCss(color) } : { borderColor: rgbCss(color, 0.7) }}
              />
              <button className="layer-name" onClick={() => onOnly(id)} title={`Show only ${hint}`}>
                {label}
                <span className="count">{count(heat, id, split ? who : 'both', days)?.toLocaleString('en') ?? ''}</span>
              </button>
            </div>
            {split && on && (
              <Choice label={`${label}: against`} options={WHOS.map((w) => [w, WHO_LABEL[w]])} value={who} onChange={(w) => onWho(id as 'kills' | 'deaths', w)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const ramp = (rgb: [number, number, number]) => `linear-gradient(90deg, ${rgbCss(rgb, 0.25)}, ${rgbCss(rgb, 1)})`;

export function HeatStage({ map, heat, days, matchCount, uvUnits, ...o }: HeatOptions & { map: MapId; heat: HeatData | null; days: string[]; matchCount: number; uvUnits: number }) {
  const draw = useHeatDraw(heat, days, o, uvUnits);
  const fights = heat && o.layers.includes('fire') ? fightsOf(heat, days).length : 0;
  const who = (l: HeatLayer) => (l === 'kills' ? o.kills : l === 'deaths' ? o.deaths : 'both');
  return (
    <>
      <MapCanvas map={map} draw={draw} dim={0.5} />
      <div className="heat-caption">
        <span className="kinds">
          {o.layers.map((l) => (
            <span key={l} className="kind">
              <span className="ramp" style={{ background: ramp(o.mono ? MONO_RGB : HEAT_LAYERS[l].rgb) }} />
              {HEAT_LAYERS[l].label}
              {who(l) !== 'both' && ` (${WHO_LABEL[who(l)].toLowerCase()})`}: <span className="muted">{HEAT_LAYERS[l].hint}</span>
            </span>
          ))}
        </span>
        <span className="muted">
          {matchCount} match{matchCount === 1 ? '' : 'es'}
          {o.layers.includes('fire') && ` · ${fights} fight line${fights === 1 ? '' : 's'}`} · brighter = more
        </span>
      </div>
    </>
  );
}
