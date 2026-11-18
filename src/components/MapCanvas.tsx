import { useEffect, useRef, useState } from 'react';
import { minimapUrl } from '../lib/data';
import type { MapId } from '../lib/types';

interface Props {
  map: MapId;
  /** Draws the overlay (a match, a heatmap) on top of the minimap, in CSS pixels of a size x size square. */
  draw: (ctx: CanvasRenderingContext2D, size: number) => void;
  /** Darken the minimap so an overlay reads better (heatmaps). */
  dim?: number;
}

/** A square minimap that fills its box, with an overlay drawn by the caller. */
export function MapCanvas({ map, draw, dim = 0 }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

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
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = minimapUrl(map);
    return () => {
      img.onload = null;
    };
  }, [map]);

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
    ctx.drawImage(image, 0, 0, size, size);
    if (dim) {
      ctx.fillStyle = `rgba(8, 9, 12, ${dim})`;
      ctx.fillRect(0, 0, size, size);
    }
    draw(ctx, size);
  }, [image, size, draw, dim]);

  return (
    <div className="map-box" ref={box}>
      <canvas ref={canvas} style={{ width: size, height: size }} aria-label="Minimap" />
      {!image && <div className="map-loading">Loading map…</div>}
    </div>
  );
}
