import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadHeat } from '../lib/data';
import { drawHeat } from '../lib/draw';
import { blur, colorAt, sumDays, toPixels } from '../lib/heat';
import { HEAT_LAYERS } from '../lib/style';
import type { HeatData, HeatLayer, MapId } from '../lib/types';
import { MapCanvas } from './MapCanvas';

/** Total count per layer for the chosen days (for the layer list). */
function totals(heat: HeatData | null, days: string[]): Partial<Record<HeatLayer, number>> {
  if (!heat) return {};
  const out: Partial<Record<HeatLayer, number>> = {};
  for (const layer of Object.keys(HEAT_LAYERS) as HeatLayer[]) {
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

export function LayerList({ heat, days, layer, onLayer }: { heat: HeatData | null; days: string[]; layer: HeatLayer; onLayer: (l: HeatLayer) => void }) {
  const counts = useMemo(() => totals(heat, days), [heat, days]);
  return (
    <div className="segmented">
      {(Object.keys(HEAT_LAYERS) as HeatLayer[]).map((id) => (
        <button key={id} className={id === layer ? 'on' : ''} onClick={() => onLayer(id)} title={HEAT_LAYERS[id].hint}>
          {HEAT_LAYERS[id].label}
          <span className="count">{counts[id]?.toLocaleString('en') ?? ''}</span>
        </button>
      ))}
    </div>
  );
}

const RAMP = `linear-gradient(90deg, ${[0.15, 0.4, 0.6, 0.8, 1].map((k) => `rgba(${colorAt(k).slice(0, 3).join(',')},1)`).join(', ')})`;

export function HeatStage({ map, heat, days, layer, matchCount }: { map: MapId; heat: HeatData | null; days: string[]; layer: HeatLayer; matchCount: number }) {
  const pixels = useMemo(() => {
    if (!heat || heat.layers[layer] === undefined) return null;
    const grid = heat.grid;
    // Sparse layers (storm deaths: 39 in total) get a wider blur so single events stay visible.
    const sum = sumDays(heat.layers[layer], days, grid);
    const total = sum.reduce((a, b) => a + b, 0);
    return toPixels(blur(sum, grid, total < 200 ? 3 : 2), grid);
  }, [heat, days, layer]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      if (pixels && heat) drawHeat(ctx, pixels, heat.grid, size);
    },
    [pixels, heat],
  );

  return (
    <>
      <MapCanvas map={map} draw={draw} dim={0.45} />
      <div className="heat-caption">
        <span>{HEAT_LAYERS[layer].hint}</span>
        <span className="muted">
          {matchCount} match{matchCount === 1 ? '' : 'es'} · <span className="ramp-label">fewer</span>
          <span className="ramp" style={{ background: RAMP }} />
          <span className="ramp-label">more</span>
        </span>
      </div>
    </>
  );
}
