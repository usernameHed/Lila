import { useEffect, useRef, useState } from 'react';
import { minimapUrl } from '../lib/data';
import type { MapId } from '../lib/types';

/** Where a click landed, in map UV (0..uvUnits), and how far (in UV) counts as "on it" at the current zoom. */
export interface MapPick {
  u: number;
  v: number;
  tolerance: number;
}

interface Props {
  map: MapId;
  /** Draws the overlay (a match, a heatmap) on top of the minimap, in CSS pixels of a size x size square. */
  draw: (ctx: CanvasRenderingContext2D, size: number) => void;
  /** Darken the minimap so an overlay reads better (heatmaps). */
  dim?: number;
  uvUnits?: number;
  /** A click (not a drag) on the map. */
  onPick?: (pick: MapPick) => void;
}

const MAX_ZOOM = 8;
const PICK_PX = 10;

/**
 * A square minimap that fills its box, with an overlay drawn by the caller. Scroll zooms around the cursor (1-8x),
 * drag pans, double-click resets. The overlay is drawn at the zoomed size, so positions follow the map while
 * markers and lines keep their size on screen.
 */
export function MapCanvas({ map, draw, dim = 0, uvUnits = 10_000, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cam, setCam] = useState({ zoom: 1, x: 0, y: 0 }); // x, y: offset of the zoomed map, in CSS pixels
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize(Math.floor(Math.min(width, height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setImage(null);
    setCam({ zoom: 1, x: 0, y: 0 });
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = minimapUrl(map);
    return () => {
      img.onload = null;
    };
  }, [map]);

  const clamp = (zoom: number, x: number, y: number) => {
    const max = size * zoom - size;
    return { zoom, x: Math.min(max, Math.max(0, x)), y: Math.min(max, Math.max(0, y)) };
  };

  // Wheel zoom around the cursor (a native listener: React's wheel events cannot prevent the page scroll).
  useEffect(() => {
    const el = canvas.current;
    if (!el || !size) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setCam((c) => {
        const zoom = Math.min(MAX_ZOOM, Math.max(1, c.zoom * Math.exp(-e.deltaY * 0.0015)));
        const k = zoom / c.zoom;
        return clamp(zoom, (mx + c.x) * k - mx, (my + c.y) * k - my);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [size]); // clamp only depends on size

  useEffect(() => {
    const el = canvas.current;
    if (!el || !size) return;
    const dpr = window.devicePixelRatio || 1;
    if (el.width !== size * dpr) {
      el.width = size * dpr;
      el.height = size * dpr;
    }
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    if (!image) return; // nothing drawn on an empty map: an overlay without its map would mislead
    const full = size * cam.zoom;
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    ctx.drawImage(image, 0, 0, full, full);
    if (dim) {
      ctx.fillStyle = `rgba(8, 9, 12, ${dim})`;
      ctx.fillRect(0, 0, full, full);
    }
    draw(ctx, full);
    ctx.restore();
  }, [image, size, draw, dim, cam]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved && cam.zoom > 1) setCam((c) => clamp(c.zoom, d.cx - dx, d.cy - dy));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved || !onPick || !size) return;
    const r = (e.target as HTMLElement).getBoundingClientRect();
    const full = size * cam.zoom;
    const px = e.clientX - r.left + cam.x;
    const py = e.clientY - r.top + cam.y;
    onPick({ u: (px / full) * uvUnits, v: (1 - py / full) * uvUnits, tolerance: (PICK_PX / full) * uvUnits });
  };

  return (
    <div className="map-box" ref={box}>
      <canvas
        ref={canvas}
        style={{ width: size, height: size, cursor: cam.zoom > 1 ? 'grab' : onPick ? 'pointer' : 'default', touchAction: 'none' }}
        aria-label="Minimap: scroll to zoom, drag to pan, click a player for details"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => setCam({ zoom: 1, x: 0, y: 0 })}
      />
      {!image && <div className="map-loading">Loading map…</div>}
      {cam.zoom > 1 && (
        <button className="map-reset" onClick={() => setCam({ zoom: 1, x: 0, y: 0 })}>
          {cam.zoom.toFixed(1)}x · Reset view
        </button>
      )}
    </div>
  );
}
