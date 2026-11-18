import { useEffect, useRef, useState } from 'react';
import { minimapUrl } from '../lib/data';
import { MAP_LABEL } from '../lib/style';
import type { MapId } from '../lib/types';
import { Loader } from './Loader';

/** A point on the map, in UV (0..uvUnits), and how far (in UV) counts as "on it" at the current zoom. */
export interface MapPick {
  u: number;
  v: number;
  tolerance: number;
  /** The map's size on screen (CSS px) at the current zoom, to match what is drawn (icon groups). */
  size: number;
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

/** Minimap pictures, loaded and decoded once per visit: switching back to a map is instant. */
const pictures = new Map<string, Promise<HTMLImageElement>>();
export function minimap(map: string): Promise<HTMLImageElement> {
  let p = pictures.get(map);
  if (!p) {
    p = new Promise<HTMLImageElement>((ok, fail) => {
      const img = new Image();
      img.onload = () => img.decode().then(() => ok(img), () => ok(img));
      img.onerror = () => {
        pictures.delete(map);
        fail(new Error(`The ${map} map could not load.`));
      };
      img.src = minimapUrl(map);
    });
    pictures.set(map, p);
  }
  return p;
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
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
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
    setFailed(false);
    if (view.w) setCam(fit(view.w, view.h));
    let live = true;
    minimap(map).then(
      (img) => live && setImage(img),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [map, retry]); // fit and view are read once, on purpose: a new map starts fitted

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
    return { u: (px / cam.s) * uvUnits, v: (1 - py / cam.s) * uvUnits, tolerance: (PICK_PX / cam.s) * uvUnits, size: cam.s };
  };

  // Fingers and mouse: one pointer drags the map, two pinch (zoom around their middle, and move with it).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; mx: number; my: number; cam: Cam } | null>(null);
  const local = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const startPinch = () => {
    const [a, b] = [...pointers.current.values()];
    if (!a || !b || !cam) return;
    pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, cam };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!cam) return;
    pointers.current.set(e.pointerId, local(e));
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // a pointer the browser no longer tracks: the gesture still works without capture
    }
    if (pointers.current.size === 2) {
      drag.current = null;
      startPinch();
    } else if (pointers.current.size === 1) drag.current = { x: e.clientX, y: e.clientY, cam, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, local(e));
    const p = pinch.current;
    if (p && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const k = Math.hypot(a.x - b.x, a.y - b.y) / p.d;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const s = clamp({ ...p.cam, s: p.cam.s * k }).s;
      const f = s / p.cam.s;
      setCam(clamp({ s, x: mx - (p.mx - p.cam.x) * f, y: my - (p.my - p.cam.y) * f }));
      return;
    }
    const d = drag.current;
    if (!d) return e.pointerType === 'mouse' ? onHover?.(toPick(e)) : undefined;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > (e.pointerType === 'mouse' ? 4 : 8)) d.moved = true;
    if (d.moved) setCam(clamp({ ...d.cam, x: d.cam.x + dx, y: d.cam.y + dy }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      // One finger left after a pinch: it goes on dragging from here, it never counts as a tap.
      pinch.current = null;
      const [rest] = [...pointers.current.values()];
      drag.current = rest && cam ? { x: e.clientX, y: e.clientY, cam, moved: true } : null;
      return;
    }
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved || !onPick) return;
    const p = toPick(e);
    if (p) onPick(p);
  };
  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    pinch.current = null;
    drag.current = null;
  };
  /** The + and - buttons: zoom around the middle of the canvas. */
  const zoomBy = (k: number) =>
    setCam((c) => {
      if (!c) return c;
      const s = clamp({ ...c, s: c.s * k }).s;
      const f = s / c.s;
      return clamp({ s, x: view.w / 2 - (view.w / 2 - c.x) * f, y: view.h / 2 - (view.h / 2 - c.y) * f });
    });

  const zoomed = cam && Math.abs(cam.s - base) > 1;
  return (
    <div className="map-box" ref={box}>
      <canvas
        ref={canvas}
        style={{ width: view.w, height: view.h, cursor: drag.current?.moved ? 'grabbing' : pointer ? 'pointer' : 'grab', touchAction: 'none' }}
        aria-label="Map: scroll or pinch to zoom, drag to pan, click a player or an event for details"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => onHover?.(null)}
        onDoubleClick={() => setCam(fit(view.w, view.h))}
      />
      {!image && !failed && <div className="map-loading"><Loader label={`Loading ${MAP_LABEL[map] ?? 'the map'}`} /></div>}
      {failed && (
        <div className="map-loading">
          <div className="loader failed">
            <p>This map could not load. Check the connection.</p>
            <button className="ds-use" onClick={() => setRetry((n) => n + 1)}>Try again</button>
          </div>
        </div>
      )}
      <div className="map-zoom">
        <button onClick={() => zoomBy(1.5)} aria-label="Zoom in" title="Zoom in (or scroll, or pinch)">+</button>
        <button onClick={() => zoomBy(1 / 1.5)} aria-label="Zoom out" title="Zoom out">−</button>
      </div>
      {zoomed && cam && (
        <button className="map-reset" onClick={() => setCam(fit(view.w, view.h))}>
          {(cam.s / base).toFixed(1)}x · Reset view
        </button>
      )}
    </div>
  );
}
