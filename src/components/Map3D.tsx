// The replay in 3D: the minimap as the ground, paths and events at their real height (the data's y), orbitable.
// Loaded only when the 3D view is opened (three.js stays out of the main bundle).
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { drawMarker, type LegendKey } from '../lib/draw';
import { minimapUrl } from '../lib/data';
import { EVENT_STYLE, FIRE_COLOR, MANY_MATCHES, MATCH_COLORS, PATH_COLOR } from '../lib/style';
import { heightAt, positionAt, samplesUntil } from '../lib/timeline';
import { segmentDistance, type Focus } from '../lib/pick';
import type { EventType, MapConfig, Match, MatchEvent, Terrain } from '../lib/types';

export interface Map3DProps {
  map: MapConfig;
  matches: Match[];
  uvUnits: number;
  t: number;
  hidden: ReadonlySet<LegendKey>;
  mono: boolean;
  /** Vertical exaggeration: 40 m of relief on a 900 m map is hard to see at 1x. */
  exaggeration: number;
  /** Ground shaped by the terrain estimated from paths (null: flat). */
  terrain: Terrain | null;
  /** Heatmap painted on the ground with the minimap (null: minimap only). */
  overlay: ((ctx: CanvasRenderingContext2D, size: number) => void) | null;
  /** The player in focus (highlighted), and a click on a path to choose one. */
  focus: Focus | null;
  onFocus: (f: Focus | null) => void;
  /** Legend row hovered: that kind pulses (its future events shown see-through). */
  hoverKind: LegendKey | null;
  /** One event pointed at (map, timeline, card): a pulsing dot. */
  activeEvent: MatchEvent | null;
  onPointEvent: (e: MatchEvent | null) => void;
  onPickEvent: (e: MatchEvent) => void;
}

/** Size of the ground texture: minimap + heatmap painted together. */
const TEXTURE_PX = 2048;

interface PathLine {
  match: string;
  bot: boolean;
  player: number;
  baseOpacity: number;
  baseWidth: number;
  line: Line2;
  shadow: THREE.Line;
  head: THREE.Mesh;
  path: number[];
  h: number[];
}

interface EventLayer {
  points: THREE.Points;
  times: number[]; // sorted, for drawRange by time
  refs?: MatchEvent[]; // the events, in the same order (for picking and highlighting)
  future?: THREE.Points; // the same events drawn see-through, for the hovered kind's events still to come
  size?: number;
}

/** A round dot texture for event points (plain points are squares). */
const DOT = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.arc(32, 32, 28, 0, Math.PI * 2);
  g.fillStyle = '#fff';
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#000';
  g.stroke();
  return new THREE.CanvasTexture(c);
})();

/**
 * A plane with one vertex per terrain cell center, lifted to the cell's height, its texture coordinates set from
 * the vertex position so the minimap stays exactly where the paths are. Built in the plane's own axes (rotated
 * flat afterwards like the flat ground): local x = east, local y = north, local z = up.
 */
function terrainGeometry(map: MapConfig, t: Terrain): THREE.PlaneGeometry {
  const S = map.scale;
  const g = t.grid;
  const size = (S * (g - 1)) / g; // first and last vertices sit on the outer cells' centers
  const geo = new THREE.PlaneGeometry(size, size, g - 1, g - 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const row = Math.floor(i / g); // PlaneGeometry rows go from top (north) to bottom
    const col = i % g;
    pos.setZ(i, t.h[row * g + col] / 10 - map.hMin);
    uv.setXY(i, (pos.getX(i) + S / 2) / S, (pos.getY(i) + S / 2) / S);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * The 2D marker of each event type (cross = kill, skull = death, diamond = loot, storm sign), drawn once into a
 * texture: 3D events are camera-facing sprites with the same look as the 2D map.
 */
const MARKER_TEXTURES = new Map<EventType, THREE.CanvasTexture>();
function markerTexture(type: EventType): THREE.CanvasTexture {
  let tex = MARKER_TEXTURES.get(type);
  if (!tex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const s = EVENT_STYLE[type];
    drawMarker(c.getContext('2d')!, s.shape, s.color, 32, 32, 21);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    MARKER_TEXTURES.set(type, tex);
  }
  return tex;
}

/** World meters: x east, z south (image down), y up = height above the map's lowest point. */
function place(map: MapConfig, uvUnits: number, u: number, v: number, hDm: number) {
  return new THREE.Vector3((u / uvUnits) * map.scale, hDm / 10 - map.hMin, (1 - v / uvUnits) * map.scale);
}

export default function Map3D(props: Map3DProps) {
  const { map, matches, uvUnits, t, hidden, mono, exaggeration, terrain, overlay, focus, onFocus, hoverKind, activeEvent, onPointEvent, onPickEvent } = props;
  const hoverRef = useRef(hoverKind);
  hoverRef.current = hoverKind;
  const activeRef = useRef(activeEvent);
  activeRef.current = activeEvent;
  const activeMarker = useRef<THREE.Points | null>(null);
  const eventCbs = useRef({ onPointEvent, onPickEvent, t });
  eventCbs.current = { onPointEvent, onPickEvent, t };
  const box = useRef<HTMLDivElement>(null);
  const three = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    world: THREE.Group; // everything that has a height: scaled in y by the exaggeration
    content: THREE.Group; // this selection's paths, events, fights
    ground: THREE.Mesh;
  } | null>(null);
  const lineMaterials = useRef<LineMaterial[]>([]);
  // Line2 widths are in pixels: the materials need the canvas size.
  const resizeLines = () => {
    const el = box.current;
    if (el) for (const m of lineMaterials.current) m.resolution.set(el.clientWidth, el.clientHeight);
  };
  const built = useRef<{ paths: PathLine[]; events: Map<EventType, EventLayer>; fights: EventLayer | null }>({ paths: [], events: new Map(), fights: null });

  // Renderer, camera, ground: once per map.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x0e0f12);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const S = map.scale;
    const camera = new THREE.PerspectiveCamera(45, 1, 1, S * 10);
    camera.position.set(S * 0.5, S * 0.62, S * 1.12);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(S / 2, 0, S / 2);
    controls.enableDamping = true;
    // Left: orbit. Middle or right: pan (move across the map). Wheel: zoom.
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    controls.screenSpacePanning = false; // pan along the ground, not the screen
    controls.maxPolarAngle = Math.PI * 0.49; // never under the ground
    controls.update();

    // Lit material, so slopes of the estimated terrain shade; the texture is painted by the overlay effect below.
    // Polygon offset: the ground is drawn slightly behind in depth, so paths lying on it always show, without
    // moving it (a height offset would be multiplied by the exaggeration: 2 m became 16 m at x8).
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(S, S),
      new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8 }),
    );
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(-S * 0.6, S * 0.9, -S * 0.3); // low-ish from the north-west: relief reads like a shaded map
    scene.add(sun);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(S / 2, 0, S / 2);

    const world = new THREE.Group();
    world.add(ground); // inside the world: the terrain follows the height exaggeration like the paths
    const content = new THREE.Group();
    world.add(content);
    scene.add(world);
    three.current = { renderer, scene, camera, controls, world, content, ground };

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      resizeLines();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    let frame = 0;
    const loop = (now = 0) => {
      // Hover pulse: the hovered kind's dots grow and shrink, the others step back; the pointed-at event pulses.
      const k = 0.5 - 0.5 * Math.cos((now / 900) * Math.PI * 2);
      const hk = hoverRef.current;
      const ae = activeRef.current;
      for (const [type, layer] of built.current.events) {
        const m = layer.points.material as THREE.PointsMaterial;
        m.size = (layer.size ?? 10) * (hk === type ? 1.3 + 0.35 * k : 1);
        m.opacity = hk || ae ? (hk === type ? 1 : 0.25) : 1;
        if (layer.future) (layer.future.material as THREE.PointsMaterial).size = m.size;
      }
      const mk = activeMarker.current;
      if (mk?.visible) {
        (mk.material as THREE.PointsMaterial).size = 30 + 22 * k;
        (mk.material as THREE.PointsMaterial).opacity = 1 - 0.4 * k;
      }
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
      three.current = null;
    };
  }, [map]);

  // A click (not a drag) on a path: that player comes into focus; on nothing: focus cleared.
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  useEffect(() => {
    const ctx = three.current;
    if (!ctx) return;
    const el = ctx.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    const screen = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ctx.world.updateMatrixWorld();
      const toScreen = (x: number, y: number, z: number) => {
        const v = new THREE.Vector3(x, y, z).applyMatrix4(ctx.world.matrixWorld).project(ctx.camera);
        return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height, behind: v.z > 1 };
      };
      return { mx: e.clientX - r.left, my: e.clientY - r.top, toScreen };
    };
    /** The event dot under the mouse (already happened, kind shown), within 10 px. */
    const eventAt = (e: PointerEvent): MatchEvent | null => {
      const { mx, my, toScreen } = screen(e);
      let best: { d: number; ref: MatchEvent } | null = null;
      for (const layer of built.current.events.values()) {
        if (!layer.points.visible || !layer.refs) continue;
        const pos = layer.points.geometry.attributes.position as THREE.BufferAttribute;
        const n = layer.points.geometry.drawRange.count === Infinity ? pos.count : Math.min(pos.count, layer.points.geometry.drawRange.count);
        for (let i = 0; i < n; i++) {
          const a = toScreen(pos.getX(i), pos.getY(i), pos.getZ(i));
          if (a.behind) continue;
          const d = Math.hypot(a.x - mx, a.y - my);
          if (d <= 10 && (!best || d < best.d)) best = { d, ref: layer.refs[i] };
        }
      }
      return best?.ref ?? null;
    };
    let moveFrame = 0;
    const onMove = (e: PointerEvent) => {
      if (down || moveFrame) return; // not while dragging; at most once a frame
      moveFrame = requestAnimationFrame(() => {
        moveFrame = 0;
        eventCbs.current.onPointEvent(eventAt(e));
      });
    };
    const onLeave = () => eventCbs.current.onPointEvent(null);
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      const click = down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) <= 4;
      down = null;
      if (!click) return;
      const ev = eventAt(e);
      if (ev) return eventCbs.current.onPickEvent(ev);
      // Screen-space pick: project each path's drawn points, nearest segment within 12 px (same rule as 2D).
      const { mx, my, toScreen } = screen(e);
      let best: { d: number; p: PathLine } | null = null;
      for (const path of built.current.paths) {
        const geo = path.line.geometry as LineGeometry;
        const start = geo.attributes.instanceStart as THREE.InterleavedBufferAttribute;
        const end = geo.attributes.instanceEnd as THREE.InterleavedBufferAttribute;
        const n = Math.min(start.count, geo.instanceCount); // only the part drawn so far
        for (let k = 0; k < n; k++) {
          const a = toScreen(start.getX(k), start.getY(k), start.getZ(k));
          const b = toScreen(end.getX(k), end.getY(k), end.getZ(k));
          if (a.behind || b.behind) continue;
          const d = segmentDistance(mx, my, a.x, a.y, b.x, b.y);
          if (d <= 12 && (!best || d < best.d)) best = { d, p: path };
        }
      }
      const p = best?.p;
      onFocusRef.current(p ? { match: p.match, player: p.player } : null);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(moveFrame);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [map]);


  // Heights stretch with the exaggeration; the player dots must not (they would become tall ellipses).
  const exaggerationRef = useRef(exaggeration);
  useEffect(() => {
    exaggerationRef.current = exaggeration;
    if (three.current) three.current.world.scale.y = exaggeration;
    for (const p of built.current.paths) p.head.scale.set(1, 1 / exaggeration, 1);
  }, [exaggeration]);

  // The ground's texture: the minimap, darkened and with the heatmap on top when one is shown (as in 2D).
  useEffect(() => {
    const ctx = three.current;
    if (!ctx) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!live || !three.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = TEXTURE_PX;
      const g = canvas.getContext('2d')!;
      g.drawImage(img, 0, 0, TEXTURE_PX, TEXTURE_PX);
      if (overlay) {
        g.fillStyle = 'rgba(8, 9, 12, 0.4)';
        g.fillRect(0, 0, TEXTURE_PX, TEXTURE_PX);
        overlay(g, TEXTURE_PX);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = three.current.renderer.capabilities.getMaxAnisotropy();
      const material = three.current.ground.material as THREE.MeshLambertMaterial;
      material.map?.dispose();
      material.map = texture;
      material.needsUpdate = true;
    };
    img.src = minimapUrl(map.id);
    return () => {
      live = false;
      img.onload = null;
    };
  }, [map, overlay]);

  // The ground: flat, or a mesh lifted to the estimated terrain (one vertex per terrain cell center).
  useEffect(() => {
    const ctx = three.current;
    if (!ctx) return;
    ctx.ground.geometry.dispose();
    ctx.ground.geometry = terrain ? terrainGeometry(map, terrain) : new THREE.PlaneGeometry(map.scale, map.scale);
  }, [terrain, map]);

  // Geometry for this selection: paths (with a dark shadow on the ground), events by type, fight lines.
  useEffect(() => {
    const ctx = three.current;
    if (!ctx) return;
    const { content } = ctx;
    content.children.slice().forEach((c) => {
      content.remove(c);
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material | undefined)?.dispose?.();
      });
    });
    const many = matches.length > MANY_MATCHES;
    const paths: PathLine[] = [];
    const materials: LineMaterial[] = [];
    matches.forEach((m, mi) => {
      m.players.forEach((p, pi) => {
        if (p.path.length < 6 || !p.h) return;
        const n = p.path.length / 3;
        const pos = new Float32Array(n * 3);
        const flat = new Float32Array(n * 3);
        const colors = new Float32Array(n * 3);
        const base = new THREE.Color(p.bot ? PATH_COLOR.bot : many || mono ? PATH_COLOR.human : MATCH_COLORS[mi]);
        for (let i = 0; i < n; i++) {
          const v = place(map, uvUnits, p.path[i * 3 + 1], p.path[i * 3 + 2], p.h[i]);
          pos.set([v.x, v.y, v.z], i * 3);
          flat.set([v.x, 0.3, v.z], i * 3);
          const c = base;
          colors.set([c.r, c.g, c.b], i * 3);
        }
        // Thick lines (Line2: width in screen pixels), colored per vertex (by player, or by height).
        const geo = new LineGeometry();
        geo.setPositions(pos);
        geo.setColors(colors);
        const material = new LineMaterial({
          vertexColors: true,
          linewidth: (p.bot ? 1.5 : 3) * (many ? 0.5 : 1),
          transparent: true,
          opacity: (p.bot ? 0.7 : 1) * (many ? 0.35 : 1),
          dashed: p.bot,
          dashSize: 6,
          gapSize: 4,
        });
        materials.push(material);
        const line = new Line2(geo, material);
        line.computeLineDistances();
        const shadowGeo = new THREE.BufferGeometry();
        shadowGeo.setAttribute('position', new THREE.BufferAttribute(flat, 3));
        // The path's shadow on the ground: shows where a raised path is above the map.
        const shadow = new THREE.Line(shadowGeo, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: many ? 0.15 : 0.45 }));
        shadow.scale.y = 1;
        const head = new THREE.Mesh(new THREE.SphereGeometry((p.bot ? 2 : 3.5) * (many ? 0.5 : 1), 12, 8), new THREE.MeshBasicMaterial({ color: base }));
        head.scale.set(1, 1 / exaggerationRef.current, 1);
        content.add(line, shadow, head);
        paths.push({ match: m.id, bot: p.bot, player: pi, baseOpacity: material.opacity, baseWidth: material.linewidth, line, shadow, head, path: p.path, h: p.h });
      });
    });

    const events = new Map<EventType, EventLayer>();
    const byType = new Map<EventType, { t: number; v: THREE.Vector3; ref: MatchEvent }[]>();
    for (const m of matches)
      for (const e of m.events) {
        const [time, type, u, v, , h] = e;
        if (many && type === 'loot') continue;
        if (!byType.has(type)) byType.set(type, []);
        byType.get(type)!.push({ t: time, v: place(map, uvUnits, u, v, h ?? map.hMin * 10), ref: e });
      }
    for (const [type, list] of byType) {
      list.sort((a, b) => a.t - b.t);
      const size = type === 'loot' ? 7 : many ? 8 : 13;
      const make = (opacity: number) =>
        new THREE.Points(
          new THREE.BufferGeometry().setFromPoints(list.map((e) => e.v)),
          // White: the texture carries the marker's own colors.
          new THREE.PointsMaterial({ color: 0xffffff, size: size * 1.6, sizeAttenuation: false, map: markerTexture(type), alphaTest: 0.05, transparent: true, opacity }),
        );
      const points = make(1);
      const future = make(0.35);
      content.add(points, future);
      events.set(type, { points, future, times: list.map((e) => e.t), refs: list.map((e) => e.ref), size: size * 1.6 });
    }
    // The one event pointed at: a bigger dot that pulses (moved and colored per frame).
    const marker = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]),
      new THREE.PointsMaterial({ color: 0xffffff, size: 24, sizeAttenuation: false, map: DOT, alphaTest: 0.05, transparent: true, depthTest: false }),
    );
    marker.visible = false;
    content.add(marker);
    activeMarker.current = marker;

    let fights: EventLayer | null = null;
    const fightList = matches
      .flatMap((m) => m.fights ?? [])
      .map(([time, ku, kv, vu, vv, , , kh, vh]) => ({ t: time, a: place(map, uvUnits, ku, kv, kh), b: place(map, uvUnits, vu, vv, vh) }))
      .sort((x, y) => x.t - y.t);
    if (fightList.length) {
      const geo = new THREE.BufferGeometry().setFromPoints(fightList.flatMap((f) => [f.a, f.b]));
      const segments = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: FIRE_COLOR }));
      content.add(segments);
      fights = { points: segments as unknown as THREE.Points, times: fightList.map((f) => f.t) };
    }
    built.current = { paths, events, fights };
    lineMaterials.current = materials;
    resizeLines();
  }, [matches, map, uvUnits, mono]);

  // Focus: the chosen path bold and fully opaque, the others faded.
  useEffect(() => {
    for (const p of built.current.paths) {
      const is = !!focus && p.match === focus.match && p.player === focus.player;
      const m = p.line.material as LineMaterial;
      m.opacity = focus ? (is ? 1 : 0.12) : p.baseOpacity;
      m.linewidth = is ? 6 : p.baseWidth;
      p.head.visible = p.head.visible && (!focus || is);
    }
  }, [focus, matches, mono]);

  // Every frame of the playback: how much of each path, which events, where the heads are.
  useEffect(() => {
    const { paths, events, fights } = built.current;
    for (const p of paths) {
      const n = samplesUntil(p.path, t);
      p.line.geometry.instanceCount = Math.max(0, n - 1); // Line2 draws one instance per segment
      p.shadow.geometry.setDrawRange(0, n);
      const hide = hidden.has(p.bot ? 'botPath' : 'humanPath');
      p.line.visible = !hide;
      p.shadow.visible = !terrain && !hide; // a flat shadow would be buried under the terrain
      const at = positionAt(p.path, t);
      const h = heightAt(p.path, p.h, t);
      p.head.visible = !!at && t < p.path[p.path.length - 3] && !hidden.has(p.bot ? 'botPath' : 'humanPath');
      if (at && h !== null) {
        p.head.position.copy(place(map, uvUnits, at.u, at.v, h));
      }
    }
    const count = (times: number[]) => {
      let lo = 0;
      let hi = times.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (times[mid] <= t) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
    for (const [type, layer] of events) {
      const n = count(layer.times);
      layer.points.visible = !hidden.has(type);
      layer.points.geometry.setDrawRange(0, n);
      if (layer.future) {
        layer.future.visible = !hidden.has(type) && hoverKind === type; // the hovered kind's future, see-through
        layer.future.geometry.setDrawRange(n, layer.times.length - n);
      }
    }
    const marker = activeMarker.current;
    if (marker) {
      marker.visible = !!activeEvent;
      if (activeEvent) {
        const [, type, u, v, , h] = activeEvent;
        (marker.geometry.attributes.position as THREE.BufferAttribute).setXYZ(0, ...place(map, uvUnits, u, v, h).toArray());
        marker.geometry.attributes.position.needsUpdate = true;
        const mat = marker.material as THREE.PointsMaterial;
        if (mat.map !== markerTexture(type)) {
          mat.map = markerTexture(type);
          mat.needsUpdate = true;
        }
      }
    }
    if (fights) {
      fights.points.visible = !hidden.has('fights');
      fights.points.geometry.setDrawRange(0, count(fights.times) * 2);
    }
  }, [t, hidden, map, uvUnits, matches, terrain, hoverKind, activeEvent]);

  return (
    <div className="map3d" ref={box}>
      <div className="map3d-help">Drag to orbit · middle or right drag to move · scroll to zoom · click a path or a dot</div>
    </div>
  );
}
