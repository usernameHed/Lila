import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadHeat } from '../lib/data';
import { drawHeat } from '../lib/draw';
import { blur, normalize, render, strongest, sumDays, type Look } from '../lib/heat';
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

/** Event count behind a kind for the chosen days (the line of fire counts fights, not cells). */
function count(heat: HeatData | null, kind: HeatLayer, who: Who, days: string[], fights: number): number | null {
  if (!heat) return null;
  if (kind === 'fire') return fights;
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
  look: Look;
}

interface ListProps extends HeatOptions {
  heat: HeatData | null;
  days: string[];
  fights: number;
  onToggle: (l: HeatLayer) => void;
  onOnly: (l: HeatLayer) => void;
  onWho: (kind: 'kills' | 'deaths', who: Who) => void;
}

/** Every kind in its color: click a row to show it alone, its box to add or remove it; kills and deaths also
 * pick bots, players or both. */
export function LayerList({ heat, days, fights, onToggle, onOnly, onWho, ...o }: ListProps) {
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
                <span className="count">{count(heat, id, split ? who : 'both', days, fights)?.toLocaleString('en') ?? ''}</span>
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

export function HeatStage({ map, heat, days, matchCount, fights, ...o }: HeatOptions & { map: MapId; heat: HeatData | null; days: string[]; matchCount: number; fights: number }) {
  const pictures = useMemo(() => {
    if (!heat) return [];
    const kinds = KINDS.filter((l) => o.layers.includes(l));
    const grids = kinds.map((l) => {
      const values = sum(heat, sourcesOf(l, l === 'kills' ? o.kills : o.deaths), days);
      const total = values.reduce((a, b) => a + b, 0);
      // Sparse kinds (storm deaths: 39 in all) get a wider blur, so single events stay visible.
      return normalize(blur(values, heat.grid, total < 200 ? 3 : 2));
    });
    if (o.mono) return grids.length ? [render(strongest(grids), heat.grid, MONO_RGB, o.look)] : [];
    // One picture per kind, each in its color, stacked in drawing order (traffic at the bottom).
    return grids.map((k, i) => render(k, heat.grid, HEAT_LAYERS[kinds[i]].rgb, o.look));
  }, [heat, days, o.layers, o.kills, o.deaths, o.mono, o.look]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      for (const p of pictures) drawHeat(ctx, p.pixels, p.size, size, o.look === 'smooth');
    },
    [pictures, o.look],
  );

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
          {o.layers.includes('fire') && ` · ${fights} fights with both ends recorded`} · brighter = more
        </span>
      </div>
    </>
  );
}
