import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadHeat } from '../lib/data';
import { uvToPixel } from '../lib/coords';
import { drawFightLine, drawHeat, heatCanvas } from '../lib/draw';
import { contourPath } from '../lib/contours';
import { bandEdges, blur, edgeColor, normalize, powerGrid, render, strongest, sumDays } from '../lib/heat';
import { HEAT_LAYERS, MONO_RGB, WHO_LABEL, rgbCss } from '../lib/style';
import type { HeatData, HeatLayer, MapId, Who } from '../lib/types';
import { Choice } from './Choice';

const KINDS = Object.keys(HEAT_LAYERS) as HeatLayer[]; // drawing order
const WHOS: Who[] = ['bots', 'players', 'both'];

/** Pipeline layers behind a kind: kills and deaths split by the other side (bots, players). */
export function sourcesOf(kind: HeatLayer, who: Who): string[] {
  if (kind === 'raised') return ['killsRaised'];
  if (kind === 'power') return ['killsBot', 'killsPlayer'];
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
  if (kind === 'power') return null; // a rate, not a count
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
      // Power: kills per time spent, already a 0-1 intensity.
      if (l === 'power') return powerGrid(sum(heat, sourcesOf('power', 'both'), days), sum(heat, ['traffic'], days), heat.grid);
      const values = sum(heat, sourcesOf(l, l === 'kills' ? o.kills : o.deaths), days);
      const total = values.reduce((a, b) => a + b, 0);
      // Sparse kinds (storm deaths: 39 in all) get a wider blur, so single events stay visible.
      return normalize(blur(values, heat.grid, total < 200 ? 3 : 2));
    });
    // Each picture: the band fills (an image) and the band edges (vector paths, stroked at screen resolution).
    const make = (k: Float32Array, rgb: [number, number, number]) => {
      const fill = render(k, heat.grid, rgb);
      return { canvas: heatCanvas(fill.pixels, fill.size), edges: bandEdges(k, heat.grid).map(contourPath), stroke: edgeColor(rgb) };
    };
    return o.mono ? (grids.length ? [make(strongest(grids), MONO_RGB)] : []) : grids.map((k, i) => make(k, HEAT_LAYERS[kinds[i]].rgb));
  }, [heat, days, o.layers, o.kills, o.deaths, o.mono]);

  const fights = useMemo(() => (heat && o.layers.includes('fire') ? fightsOf(heat, days) : []), [heat, days, o.layers]);

  return useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      for (const p of pictures) {
        drawHeat(ctx, p.canvas, size);
        ctx.save();
        ctx.scale(size, size);
        ctx.lineWidth = 1.4 / size; // 1.4 screen pixels whatever the zoom
        ctx.lineJoin = 'round';
        ctx.strokeStyle = p.stroke;
        for (const edge of p.edges) ctx.stroke(edge);
        ctx.restore();
      }
      for (const [, ku, kv, vu, vv, bot, , , inferred] of fights) drawFightLine(ctx, uvToPixel(ku, kv, uvUnits, size), uvToPixel(vu, vv, uvUnits, size), bot, inferred ? 0.55 : 1);
    },
    [pictures, fights, uvUnits],
  );
}

interface ListProps extends HeatOptions {
  heat: HeatData | null;
  days: string[];
  onToggle: (l: HeatLayer) => void;
  onWho: (kind: 'kills' | 'deaths', who: Who) => void;
}

/** Every kind in its color: click a row (or its box) to show or hide it; kills and deaths also pick bots, players
 * or both. */
export function LayerList({ heat, days, onToggle, onWho, ...o }: ListProps) {
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
              <button className="layer-name" onClick={() => onToggle(id)} aria-pressed={on} title={hint}>
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
