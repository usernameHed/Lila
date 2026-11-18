import { useEffect, useRef, useState } from 'react';
import { uvToPixel } from '../lib/coords';
import { minimapUrl } from '../lib/data';
import { EVENT_STYLE, PATH_COLOR, type MarkerShape } from '../lib/style';
import type { Match, MapId } from '../lib/types';

interface Props {
  map: MapId;
  match: Match | null;
  uvUnits: number;
}

/** The minimap with one match drawn on top: every player's path, then every event as a marker. */
export function MapCanvas({ map, match, uvUnits }: Props) {
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
    el.width = size * dpr;
    el.height = size * dpr;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    if (image) ctx.drawImage(image, 0, 0, size, size);
    if (match && match.map === map) drawMatch(ctx, match, uvUnits, size);
  }, [image, match, map, size, uvUnits]);

  return (
    <div className="map-box" ref={box}>
      <canvas ref={canvas} style={{ width: size, height: size }} aria-label="Minimap with player paths" />
      {!image && <div className="map-loading">Loading map…</div>}
    </div>
  );
}

function drawMatch(ctx: CanvasRenderingContext2D, match: Match, uvUnits: number, size: number) {
  const px = (u: number, v: number) => uvToPixel(u, v, uvUnits, size);

  // Bots first, so human paths stay on top.
  const players = [...match.players].sort((a, b) => Number(b.bot) - Number(a.bot));
  for (const p of players) {
    if (p.path.length < 6) continue;
    ctx.beginPath();
    ctx.lineWidth = p.bot ? 1.25 : 2;
    ctx.strokeStyle = p.bot ? PATH_COLOR.bot : PATH_COLOR.human;
    ctx.setLineDash(p.bot ? [4, 3] : []);
    ctx.globalAlpha = p.bot ? 0.75 : 0.95;
    for (let i = 0; i < p.path.length; i += 3) {
      const { x, y } = px(p.path[i + 1], p.path[i + 2]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Loot under the deaths and kills, which matter more.
  const order = (t: string) => (t === 'Loot' ? 0 : 1);
  const events = [...match.events].sort((a, b) => order(a[1]) - order(b[1]));
  for (const [, type, u, v] of events) {
    const { x, y } = px(u, v);
    const style = EVENT_STYLE[type];
    drawMarker(ctx, style.shape, style.color, x, y, type === 'Loot' ? 3.5 : 6);
  }
}

export function drawMarker(ctx: CanvasRenderingContext2D, shape: MarkerShape, color: string, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (shape) {
    case 'cross':
      ctx.lineCap = 'round';
      ctx.lineWidth = 4.5;
      ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r);
      ctx.stroke();
      ctx.lineWidth = 2.25;
      ctx.strokeStyle = color;
      ctx.stroke();
      break;
    case 'skull':
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = '#111';
      ctx.arc(-r / 2.6, -r / 6, r / 3.6, 0, Math.PI * 2);
      ctx.arc(r / 2.6, -r / 6, r / 3.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'storm':
      ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = '#111';
      ctx.arc(0, 0, r / 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'diamond':
      ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
  }
  ctx.restore();
}
