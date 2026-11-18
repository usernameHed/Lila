// The replay in 3D: the minimap as the ground, paths and events at their real height (the data's y), orbitable.
// Loaded only when the 3D view is opened (three.js stays out of the main bundle).
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { LegendKey } from '../lib/draw';
import { minimapUrl } from '../lib/data';
import { EVENT_STYLE, FIRE_COLOR, MANY_MATCHES, MATCH_COLORS, PATH_COLOR, heightColor } from '../lib/style';
import { heightAt, positionAt, samplesUntil } from '../lib/timeline';
import type { EventType, MapConfig, Match } from '../lib/types';

export interface Map3DProps {
  map: MapConfig;
  matches: Match[];
  uvUnits: number;
  t: number;
  hidden: ReadonlySet<LegendKey>;
  byHeight: boolean;
  mono: boolean;
  /** Vertical exaggeration: 40 m of relief on a 900 m map is hard to see at 1x. */
  exaggeration: number;
}

interface PathLine {
  line: Line2;
  shadow: THREE.Line;
  head: THREE.Mesh;
  path: number[];
  h: number[];
}

interface EventLayer {
  points: THREE.Points;
  times: number[]; // sorted, for drawRange by time
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

/** World meters: x east, z south (image down), y up = height above the map's lowest point. */
function place(map: MapConfig, uvUnits: number, u: number, v: number, hDm: number) {
  return new THREE.Vector3((u / uvUnits) * map.scale, hDm / 10 - map.hMin, (1 - v / uvUnits) * map.scale);
}

export default function Map3D({ map, matches, uvUnits, t, hidden, byHeight, mono, exaggeration }: Map3DProps) {
  const box = useRef<HTMLDivElement>(null);
  const three = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    world: THREE.Group; // everything that has a height: scaled in y by the exaggeration
    content: THREE.Group; // this selection's paths, events, fights
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
    controls.maxPolarAngle = Math.PI * 0.49; // never under the ground
    controls.update();

    const texture = new THREE.TextureLoader().load(minimapUrl(map.id));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(S, S), new THREE.MeshBasicMaterial({ map: texture, color: 0xb0b0b0 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(S / 2, 0, S / 2);
    scene.add(ground);

    const world = new THREE.Group();
    const content = new THREE.Group();
    world.add(content);
    scene.add(world);
    three.current = { renderer, scene, camera, controls, world, content };

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
    const loop = () => {
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
      texture.dispose();
      el.removeChild(renderer.domElement);
      three.current = null;
    };
  }, [map]);

  useEffect(() => {
    if (three.current) three.current.world.scale.y = exaggeration;
  }, [exaggeration]);

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
    const range = { min: map.hMin * 10, max: map.hMax * 10 };
    const paths: PathLine[] = [];
    const materials: LineMaterial[] = [];
    matches.forEach((m, mi) => {
      for (const p of m.players) {
        if (p.path.length < 6 || !p.h) continue;
        const n = p.path.length / 3;
        const pos = new Float32Array(n * 3);
        const flat = new Float32Array(n * 3);
        const colors = new Float32Array(n * 3);
        const base = new THREE.Color(p.bot ? PATH_COLOR.bot : many || mono ? PATH_COLOR.human : MATCH_COLORS[mi]);
        for (let i = 0; i < n; i++) {
          const v = place(map, uvUnits, p.path[i * 3 + 1], p.path[i * 3 + 2], p.h[i]);
          pos.set([v.x, v.y, v.z], i * 3);
          flat.set([v.x, 0.3, v.z], i * 3);
          const c = byHeight ? new THREE.Color(heightColor((p.h[i] - range.min) / (range.max - range.min))) : base;
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
        const head = new THREE.Mesh(new THREE.SphereGeometry(p.bot ? 2 : 3.5, 12, 8), new THREE.MeshBasicMaterial({ color: base }));
        content.add(line, shadow, head);
        paths.push({ line, shadow, head, path: p.path, h: p.h });
      }
    });

    const events = new Map<EventType, EventLayer>();
    const byType = new Map<EventType, { t: number; v: THREE.Vector3 }[]>();
    for (const m of matches)
      for (const [time, type, u, v, , h] of m.events) {
        if (many && type === 'loot') continue;
        if (!byType.has(type)) byType.set(type, []);
        byType.get(type)!.push({ t: time, v: place(map, uvUnits, u, v, h ?? map.hMin * 10) });
      }
    for (const [type, list] of byType) {
      list.sort((a, b) => a.t - b.t);
      const geo = new THREE.BufferGeometry().setFromPoints(list.map((e) => e.v));
      const size = type === 'loot' ? 7 : many ? 8 : 13;
      const points = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: EVENT_STYLE[type].color, size, sizeAttenuation: false, map: DOT, alphaTest: 0.5, transparent: true }),
      );
      content.add(points);
      events.set(type, { points, times: list.map((e) => e.t) });
    }

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
  }, [matches, map, uvUnits, byHeight, mono]);

  // Every frame of the playback: how much of each path, which events, where the heads are.
  useEffect(() => {
    const { paths, events, fights } = built.current;
    const range = { min: map.hMin * 10, max: map.hMax * 10 };
    for (const p of paths) {
      const n = samplesUntil(p.path, t);
      p.line.geometry.instanceCount = Math.max(0, n - 1); // Line2 draws one instance per segment
      p.shadow.geometry.setDrawRange(0, n);
      const at = positionAt(p.path, t);
      const h = heightAt(p.path, p.h, t);
      p.head.visible = !!at && t < p.path[p.path.length - 3];
      if (at && h !== null) {
        p.head.position.copy(place(map, uvUnits, at.u, at.v, h));
        if (byHeight) (p.head.material as THREE.MeshBasicMaterial).color.set(heightColor((h - range.min) / (range.max - range.min)));
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
      layer.points.visible = !hidden.has(type);
      layer.points.geometry.setDrawRange(0, count(layer.times));
    }
    if (fights) {
      fights.points.visible = !hidden.has('fights');
      fights.points.geometry.setDrawRange(0, count(fights.times) * 2);
    }
  }, [t, hidden, map, uvUnits, byHeight, matches]);

  return (
    <div className="map3d" ref={box}>
      <div className="map3d-help">Drag to orbit · right-drag to pan · scroll to zoom</div>
    </div>
  );
}
