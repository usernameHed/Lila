import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadHeat } from '../lib/data';
import { uvToPixel } from '../lib/coords';
import { drawFightLine, drawHeat, heatCanvas } from '../lib/draw';
import { contourPath } from '../lib/contours';
import { bandEdges, blur, edgeColor, normalize, powerGrid, render, strongest, sumDays } from '../lib/heat';
import { HEAT_LAYERS, MONO_RGB, heatRgb } from '../lib/style';
import type { HeatData, HeatLayer, MapId, Who } from '../lib/types';
import { useSourceId } from './useSourceId';

const KINDS = Object.keys(HEAT_LAYERS) as HeatLayer[]; // drawing order

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

export function useHeat(map: MapId) {
  const [heat, setHeat] = useState<HeatData | null>(null);
  const source = useSourceId();
  useEffect(() => {
    let live = true;
    setHeat(null);
    loadHeat(map).then((h) => live && setHeat(h));
    return () => {
      live = false;
    };
  }, [map, source]);
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
    // One picture per kind, and per side for kills and deaths (each side in its own icon color).
    type Part = { l: HeatLayer; who?: Exclude<Who, 'both'> };
    const kinds = KINDS.filter((l) => l !== 'fire' && o.layers.includes(l)).flatMap((l): Part[] => {
      const who = l === 'kills' ? o.kills : l === 'deaths' ? o.deaths : null;
      if (!who) return [{ l }];
      return who === 'both' ? [{ l, who: 'bots' }, { l, who: 'players' }] : [{ l, who }];
    });
    const grids = kinds.map(({ l, who }) => {
      // Power: kills per time spent, already a 0-1 intensity.
      if (l === 'power') return powerGrid(sum(heat, sourcesOf('power', 'both'), days), sum(heat, ['traffic'], days), heat.grid);
      const values = sum(heat, sourcesOf(l, who ?? 'both'), days);
      const total = values.reduce((a, b) => a + b, 0);
      // Sparse kinds (storm deaths: 39 in all) get a wider blur, so single events stay visible.
      return normalize(blur(values, heat.grid, total < 200 ? 3 : 2));
    });
    // Each picture: the band fills (an image) and the band edges (vector paths, stroked at screen resolution).
    const make = (k: Float32Array, rgb: [number, number, number]) => {
      const fill = render(k, heat.grid, rgb);
      return { canvas: heatCanvas(fill.pixels, fill.size), edges: bandEdges(k, heat.grid).map(contourPath), stroke: edgeColor(rgb) };
    };
    return o.mono ? (grids.length ? [make(strongest(grids), MONO_RGB)] : []) : grids.map((k, i) => make(k, heatRgb(kinds[i].l, kinds[i].who)));
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
