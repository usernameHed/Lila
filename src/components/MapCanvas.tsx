import { useEffect, useRef, useState } from 'react';
import { minimapUrl } from '../lib/data';
import type { MapId } from '../lib/types';

/** A point on the map, in UV (0..uvUnits), and how far (in UV) counts as "on it" at the current zoom. */
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
  /** The mouse moving over the map (null when it leaves). */
  onHover?: (pick: MapPick | null) => void;
  /** Show a pointer cursor (something clickable is under the mouse). */
  pointer?: boolean;
}

/** The minimaps have a dark border: open slightly zoomed in, so the map itself fills the height. */
const FIT = 1.15;
const MAX_ZOOM = 8;
const PICK_PX = 10;

interface Cam {
  s: number; // map size on screen, CSS px
  x: number; // map top-left on the canvas, CSS px
  y: number;
}

/**
 * The minimap with an overlay drawn by the caller, on a canvas that fills the whole stage (the space left and
 * right of the square map is used when zooming). Scroll zooms around the cursor (up to 8x), drag pans,
 * double-click resets. The overlay is drawn at the zoomed size, so markers and lines keep their size on screen.
 */
export function MapCanvas({ map, draw, dim = 0, uvUnits = 10_000, onPick, onHover, pointer }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cam, setCam] = useState<Cam | null>(null);
  const drag = useRef<{ x: number; y: number; cam: Cam; moved: boolean } | null>(null);

  const fit = (w: number, h: number): Cam => {
    const s = Math.min(h * FIT, w * FIT);
    return { s, x: (w - s) / 2, y: (h - s) / 2 };
  };
  const base = Math.min(view.w, view.h) * FIT;
  const clamp = (c: Cam): Cam => {
    const s = Math.min(base * MAX_ZOOM, Math.max(base * 0.8, c.s));
    // Keep the map's middle reachable: it can slide until its edge reaches the middle of the canvas.
    return { s, x: Math.min(view.w / 2, Math.max(view.w / 2 - s, c.x)), y: Math.min(view.h / 2, Math.max(view.h / 2 - s, c.y)) };
  };

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const w = Math.floor(width);
      const h = Math.floor(height);
      setView({ w, h });
      setCam(fit(w, h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setImage(null);
    if (view.w) setCam(fit(view.w, view.h));
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = minimapUrl(map);
    return () => {
      img.onload = null;
    };
  }, [map]); // fit and view are read once, on purpose: a new map starts fitted

  // Wheel zoom around the cursor (a native listener: React's wheel events cannot prevent the page scroll).
  useEffect(() => {
    const el = canvas.current;
    if (!el || !view.w) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      setCam((c) => {
        if (!c) return c;
        const next = clamp({ ...c, s: c.s * Math.exp(-e.deltaY * 0.0015) });
        const k = next.s / c.s;
        return clamp({ s: next.s, x: mx - (mx - c.x) * k, y: my - (my - c.y) * k });
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [view]); // clamp only depends on view

  useEffect(() => {
    const el = canvas.current;
    if (!el || !view.w || !cam) return;
    const dpr = window.devicePixelRatio || 1;
    if (el.width !== view.w * dpr || el.height !== view.h * dpr) {
      el.width = view.w * dpr;
      el.height = view.h * dpr;
    }
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    if (!image) return; // nothing drawn on an empty map: an overlay without its map would mislead
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.drawImage(image, 0, 0, cam.s, cam.s);
    if (dim) {
      ctx.fillStyle = `rgba(8, 9, 12, ${dim})`;
      ctx.fillRect(0, 0, cam.s, cam.s);
    }
    draw(ctx, cam.s);
    ctx.restore();
  }, [image, view, draw, dim, cam]);

  const toPick = (e: React.PointerEvent): MapPick | null => {
    if (!cam) return null;
    const r = (e.target as HTMLElement).getBoundingClientRect();
    const px = e.clientX - r.left - cam.x;
    const py = e.clientY - r.top - cam.y;
    return { u: (px / cam.s) * uvUnits, v: (1 - py / cam.s) * uvUnits, tolerance: (PICK_PX / cam.s) * uvUnits };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!cam) return;
    drag.current = { x: e.clientX, y: e.clientY, cam, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return onHover?.(toPick(e));
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setCam(clamp({ ...d.cam, x: d.cam.x + dx, y: d.cam.y + dy }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved || !onPick) return;
    const p = toPick(e);
    if (p) onPick(p);
  };

  const zoomed = cam && Math.abs(cam.s - base) > 1;
  return (
    <div className="map-box" ref={box}>
      <canvas
        ref={canvas}
        style={{ width: view.w, height: view.h, cursor: drag.current?.moved ? 'grabbing' : pointer ? 'pointer' : 'grab', touchAction: 'none' }}
        aria-label="Map: scroll to zoom, drag to pan, click a player or an event for details"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => onHover?.(null)}
        onDoubleClick={() => setCam(fit(view.w, view.h))}
      />
      {!image && <div className="map-loading">Loading map…</div>}
      {zoomed && cam && (
        <button className="map-reset" onClick={() => setCam(fit(view.w, view.h))}>
          {(cam.s / base).toFixed(1)}x · Reset view
        </button>
      )}
    </div>
  );
}
