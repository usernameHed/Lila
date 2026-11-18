// The line-of-sight tool: click a spot on the 2D map, see what the ground lets it see in 360 degrees.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { uvToPixel } from '../lib/coords';
import { loadTerrain } from '../lib/data';
import { heatCanvas } from '../lib/draw';
import type { MapConfig, Terrain } from '../lib/types';
import { EYE_M, RANGE_M, viewshed, visibleShare } from '../lib/viewshed';
import { Choice } from './Choice';
import type { MapPick } from './MapCanvas';

const SEEN: [number, number, number, number] = [80, 220, 140, 110];
const HIDDEN: [number, number, number, number] = [230, 60, 60, 95];

export function useSightTool(map: MapConfig, uvUnits: number, active: boolean) {
  const [terrain, setTerrain] = useState<Terrain | null>(null);
  const [spot, setSpot] = useState<{ u: number; v: number } | null>(null);

  useEffect(() => {
    setSpot(null);
    if (!active) return;
    let live = true;
    loadTerrain(map.id).then((t) => live && setTerrain(t));
    return () => {
      live = false;
    };
  }, [map.id, active]);

  const shed = useMemo(() => (active && terrain && spot ? viewshed(terrain, map.scale, spot.u, spot.v, uvUnits) : null), [active, terrain, spot, map.scale, uvUnits]);
  const picture = useMemo(() => {
    if (!shed || !terrain) return null;
    const g = terrain.grid;
    const px = new Uint8ClampedArray(new ArrayBuffer(g * g * 4));
    shed.forEach((x, i) => x >= 0 && px.set(x ? SEEN : HIDDEN, i * 4));
    return heatCanvas(px, g);
  }, [shed, terrain]);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      if (!picture || !spot) return;
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(picture, 0, 0, size, size);
      const { x, y } = uvToPixel(spot.u, spot.v, uvUnits, size);
      ctx.beginPath();
      ctx.arc(x, y, (RANGE_M / map.scale) * size, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0b0c0f';
      ctx.stroke();
      ctx.restore();
    },
    [picture, spot, uvUnits, map.scale],
  );

  const onPick = useCallback((p: MapPick) => setSpot({ u: p.u, v: p.v }), []);
  return { draw, onPick, spot, share: shed ? visibleShare(shed) : null, ready: !!terrain };
}

/** The switch and the one-line explanation, above the map. */
export function SightControls({ on, onChange, share, spot }: { on: boolean; onChange: (on: boolean) => void; share: number | null; spot: boolean }) {
  return (
    <>
      <Choice label="Line of sight" options={[['off', 'Line of sight: off'], ['on', 'On']]} value={on ? 'on' : 'off'} onChange={(v) => onChange(v === 'on')} />
      {on && (
        <span className="muted sight-note">
          {spot && share !== null
            ? `${Math.round(share * 100)}% of the ground within ${RANGE_M} m is in view (green). `
            : 'Click a spot on the map. '}
          Terrain only, from {EYE_M} m eye height: walls and buildings are not in the data.
        </span>
      )}
    </>
  );
}
