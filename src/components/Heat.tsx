import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadHeat } from '../lib/data';
import { drawHeat } from '../lib/draw';
import { blur, sumDays, toPixels } from '../lib/heat';
import { HEAT_LAYERS, rgbCss } from '../lib/style';
import type { HeatData, HeatLayer, MapId } from '../lib/types';
import { MapCanvas } from './MapCanvas';

const KINDS = Object.keys(HEAT_LAYERS) as HeatLayer[]; // drawing order

/** Total count per kind for the chosen days (for the list on the left). */
function totals(heat: HeatData | null, days: string[]): Partial<Record<HeatLayer, number>> {
  if (!heat) return {};
  const out: Partial<Record<HeatLayer, number>> = {};
  for (const layer of KINDS) {
    let n = 0;
    for (const d of days) {
      const cells = heat.layers[layer][d] ?? [];
      for (let i = 1; i < cells.length; i += 2) n += cells[i];
    }
    out[layer] = n;
  }
  return out;
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

const ramp = (rgb: [number, number, number]) => `linear-gradient(90deg, ${rgbCss(rgb, 0.25)}, ${rgbCss(rgb, 1)})`;

/** Every heatmap kind as a toggle in its own color: tick several to see them together. */
export function LayerList({ heat, days, layers, onToggle }: { heat: HeatData | null; days: string[]; layers: HeatLayer[]; onToggle: (l: HeatLayer) => void }) {
  const counts = useMemo(() => totals(heat, days), [heat, days]);
  return (
    <div className="segmented layers">
      {KINDS.map((id) => {
        const on = layers.includes(id);
        const { label, hint, rgb } = HEAT_LAYERS[id];
        return (
          <button key={id} className={on ? 'on' : ''} onClick={() => onToggle(id)} aria-pressed={on} title={`Show ${hint}`}>
            <span className="swatch-box" style={on ? { background: rgbCss(rgb), borderColor: rgbCss(rgb) } : { borderColor: rgbCss(rgb, 0.7) }} />
            {label}
            <span className="count">{counts[id]?.toLocaleString('en') ?? ''}</span>
          </button>
        );
      })}
    </div>
  );
}

export function HeatStage({ map, heat, days, layers, matchCount }: { map: MapId; heat: HeatData | null; days: string[]; layers: HeatLayer[]; matchCount: number }) {
  // One picture per kind shown, each in its color, stacked in drawing order (traffic at the bottom).
  const pictures = useMemo(() => {
    if (!heat) return [];
    return KINDS.filter((l) => layers.includes(l) && heat.layers[l]).map((l) => {
      const sum = sumDays(heat.layers[l], days, heat.grid);
      const total = sum.reduce((a, b) => a + b, 0);
      // Sparse kinds (storm deaths: 39 in all) get a wider blur, so single events stay visible.
      return toPixels(blur(sum, heat.grid, total < 200 ? 3 : 2), heat.grid, HEAT_LAYERS[l].rgb);
    });
  }, [heat, days, layers]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      if (heat) for (const px of pictures) drawHeat(ctx, px, heat.grid, size);
    },
    [pictures, heat],
  );

  return (
    <>
      <MapCanvas map={map} draw={draw} dim={0.5} />
      <div className="heat-caption">
        <span className="kinds">
          {layers.map((l) => (
            <span key={l} className="kind">
              <span className="ramp" style={{ background: ramp(HEAT_LAYERS[l].rgb) }} />
              {HEAT_LAYERS[l].label}: <span className="muted">{HEAT_LAYERS[l].hint}</span>
            </span>
          ))}
        </span>
        <span className="muted">
          {matchCount} match{matchCount === 1 ? '' : 'es'} · brighter = more
        </span>
      </div>
    </>
  );
}
