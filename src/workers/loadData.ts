// Web Worker: turns dropped files (a zip, a folder, loose parquet files) into the app's dataset, off the main
// thread, posting progress as it goes. Same pipeline as pipeline/build.py (src/lib/build.ts).
import { unzipSync } from 'fflate';
import { parquetReadObjects } from 'hyparquet';
import { buildDataset, dayOfFolder, type RawRow } from '../lib/build';

export interface LoadRequest {
  files: { path: string; file: File }[];
}

export type LoadMessage =
  | { type: 'progress'; phase: 'unzip' | 'read' | 'build'; done: number; total: number }
  | { type: 'done'; dataset: ReturnType<typeof buildDataset>['dataset']; report: ReturnType<typeof buildDataset>['report'] & { files: number; duplicates: number; notParquet: number } }
  | { type: 'error'; message: string };

const post = (m: LoadMessage) => (self as unknown as Worker).postMessage(m);
const isParquet = (b: Uint8Array) => b.length > 8 && b[0] === 0x50 && b[1] === 0x41 && b[2] === 0x52 && b[3] === 0x31; // "PAR1"
const skipPath = (p: string) => /(^|\/)(__MACOSX|\.)|minimaps\/|\.(md|txt|png|jpe?g|json|ds_store)$/i.test(p);

self.onmessage = async (e: MessageEvent<LoadRequest>) => {
  try {
    // 1. Everything as (path, bytes), zips opened.
    const entries: { path: string; bytes: Uint8Array }[] = [];
    const zips = e.data.files.filter((f) => /\.zip$/i.test(f.path));
    let z = 0;
    for (const { path, file } of e.data.files) {
      if (/\.zip$/i.test(path)) {
        post({ type: 'progress', phase: 'unzip', done: z++, total: zips.length });
        const all = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (f) => !skipPath(f.name) && !f.name.endsWith('/') });
        for (const [p, bytes] of Object.entries(all)) entries.push({ path: p, bytes });
      } else if (!skipPath(path)) entries.push({ path, bytes: new Uint8Array(await file.arrayBuffer()) });
    }
    // 2. Read each parquet file once (a file name found again in a later day folder is the same journey).
    entries.sort((a, b) => (a.path < b.path ? -1 : 1));
    const seen = new Set<string>();
    const rows: RawRow[] = [];
    let duplicates = 0;
    let notParquet = 0;
    let files = 0;
    for (let i = 0; i < entries.length; i++) {
      const { path, bytes } = entries[i];
      if (i % 25 === 0) post({ type: 'progress', phase: 'read', done: i, total: entries.length });
      if (!isParquet(bytes)) {
        notParquet++;
        continue;
      }
      const name = path.split('/').pop()!;
      if (seen.has(name)) {
        duplicates++;
        continue;
      }
      seen.add(name);
      files++;
      const day = dayOfFolder(path.split('/').slice(0, -1).join('/'));
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const objs = (await parquetReadObjects({ file: buf })) as Record<string, unknown>[];
      for (const o of objs) {
        const ts = o.ts instanceof Date ? o.ts.getTime() : Number(o.ts);
        const ev = o.event instanceof Uint8Array ? new TextDecoder().decode(o.event) : String(o.event);
        rows.push({ user: String(o.user_id), match: String(o.match_id), map: String(o.map_id), x: Number(o.x), y: Number(o.y), z: Number(o.z), sec: ts, event: ev, day });
      }
    }
    if (!rows.length) throw new Error('No LILA BLACK telemetry found: expected parquet files (the .nakama-0 files of player_data, or a zip of them).');
    // 3. The pipeline.
    post({ type: 'progress', phase: 'build', done: 0, total: 1 });
    const { dataset, report } = buildDataset(rows);
    if (!dataset.index.matches.length) throw new Error(`No match on a known map (found maps: ${report.unknownMaps.join(', ') || 'none'}).`);
    post({ type: 'done', dataset, report: { ...report, files, duplicates, notParquet } });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
