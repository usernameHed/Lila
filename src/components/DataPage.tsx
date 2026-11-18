// The Data tab: which dataset the tool shows, and a drop zone to look at any other LILA BLACK telemetry. A dropped
// zip, folder or set of parquet files is read and processed in the browser (a Web Worker running the same pipeline
// as pipeline/build.py), kept in this browser, and shown as soon as it is ready.
import { useEffect, useRef, useState } from 'react';
import { loadBuiltinIndex } from '../lib/data';
import { BUILTIN_ID, deleteUpload, describe, listUploads, saveUpload, selectSource, type SourceInfo } from '../lib/sources';
import { useSourceId } from './useSourceId';
import { MAP_LABEL, formatDay } from '../lib/style';
import type { MapId } from '../lib/types';
import type { LoadMessage } from '../workers/loadData';

interface Job {
  name: string;
  phase: 'unzip' | 'read' | 'build' | 'save';
  done: number;
  total: number;
  error?: string;
}

const PHASE: Record<Job['phase'], string> = { unzip: 'Opening the zip', read: 'Reading parquet files', build: 'Building matches, heatmaps, terrain', save: 'Keeping it in this browser' };


/** Files from a drop: folders are walked, every file keeps its path (the day comes from its folder name). */
async function filesOf(dt: DataTransfer): Promise<{ path: string; file: File }[]> {
  const out: { path: string; file: File }[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((ok, fail) => (entry as FileSystemFileEntry).file(ok, fail));
      out.push({ path: prefix + entry.name, file });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((ok, fail) => reader.readEntries(ok, fail));
        if (!batch.length) break;
        for (const e of batch) await walk(e, `${prefix}${entry.name}/`);
      }
    }
  };
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e);
  if (entries.length) for (const e of entries) await walk(e, '');
  else for (const f of [...dt.files]) out.push({ path: f.name, file: f });
  return out;
}

function Stats({ s }: { s: SourceInfo }) {
  const days = s.days.length ? `${formatDay(s.days[0])}${s.days.length > 1 ? ` to ${formatDay(s.days[s.days.length - 1])}` : ''}` : '';
  return (
    <div className="ds-stats">
      <span><b>{s.matches.toLocaleString('en')}</b> matches</span>
      <span><b>{s.players.toLocaleString('en')}</b> players</span>
      <span><b>{s.rows.toLocaleString('en')}</b> events</span>
      {s.files !== undefined && <span><b>{s.files.toLocaleString('en')}</b> files</span>}
      <span>{days}</span>
      <span>{s.maps.map((m) => MAP_LABEL[m as MapId] ?? m).join(' · ')}</span>
    </div>
  );
}

export function DataPage({ onShow }: { onShow: () => void }) {
  const active = useSourceId();
  const [builtin, setBuiltin] = useState<SourceInfo | null>(null);
  const [uploads, setUploads] = useState<SourceInfo[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBuiltinIndex().then((index) => setBuiltin(describe(BUILTIN_ID, "LILA BLACK, LILA's sample (Feb 10-14, 2026)", 'builtin', { index, matches: {}, heat: {}, terrain: {} }, 1243)));
    listUploads().then(setUploads);
  }, []);

  const load = (files: { path: string; file: File }[]) => {
    if (!files.length || job && !job.error) return;
    const top = files[0].path.split('/')[0];
    const name = files.length === 1 ? files[0].file.name : top && files.every((f) => f.path.startsWith(`${top}/`)) ? top : `${files.length} files`;
    // Optimistic: the new dataset's card appears at once, filling up as the worker goes.
    setJob({ name, phase: files.some((f) => /\.zip$/i.test(f.path)) ? 'unzip' : 'read', done: 0, total: files.length });
    const worker = new Worker(new URL('../workers/loadData.ts', import.meta.url), { type: 'module' });
    worker.onmessage = async (e: MessageEvent<LoadMessage>) => {
      const m = e.data;
      if (m.type === 'progress') setJob((j) => j && { ...j, phase: m.phase, done: m.done, total: m.total });
      else if (m.type === 'error') {
        setJob((j) => j && { ...j, error: m.message });
        worker.terminate();
      } else {
        worker.terminate();
        const info = describe(`upload-${Date.now()}`, name, 'upload', m.dataset, m.report.files);
        setJob((j) => j && { ...j, phase: 'save', done: 0, total: 1 });
        await saveUpload(info, m.dataset).catch(() => undefined); // storage full or blocked: still shown, just not kept
        await selectSource(info.id, m.dataset);
        setUploads(await listUploads());
        setJob(null);
        onShow(); // straight to the replay of the new data
      }
    };
    worker.postMessage({ files });
  };

  const choose = async (id: string) => {
    await selectSource(id);
    onShow();
  };
  const remove = async (s: SourceInfo) => {
    if (!window.confirm(`Remove "${s.name}" from this browser? The file you dropped is not touched.`)) return;
    if (active === s.id) await selectSource(BUILTIN_ID);
    await deleteUpload(s.id);
    setUploads(await listUploads());
  };

  const card = (s: SourceInfo) => (
    <article key={s.id} className={`ds-card ${active === s.id ? 'current' : ''}`}>
      <header>
        <div>
          <strong>{s.name}</strong>
          <span className="ds-kind">{s.kind === 'builtin' ? 'Built in · the data of this assignment' : `In this browser · added ${new Date(s.createdAt ?? 0).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`}</span>
        </div>
        {active === s.id ? (
          <span className="ds-current">Showing now</span>
        ) : (
          <button className="ds-use" onClick={() => choose(s.id)}>
            Show this data
          </button>
        )}
      </header>
      <Stats s={s} />
      {s.kind === 'upload' && (
        <button className="ds-remove" onClick={() => remove(s)}>
          Remove from this browser
        </button>
      )}
    </article>
  );

  return (
    <div
      className="data-page"
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false);
      }}
      onDrop={async (e) => {
        e.preventDefault();
        setDrag(false);
        load(await filesOf(e.dataTransfer));
      }}
    >
      <header className="ov-hero">
        <p className="eyebrow">Data</p>
        <h1>Look at any LILA BLACK telemetry</h1>
        <p className="lede">
          Drop another export (new days, another build, a playtest) and the whole tool runs on it: replays, heatmaps, 3D,
          filters. It is processed here, in your browser, with the same pipeline as the built-in data; nothing is uploaded
          anywhere.
        </p>
      </header>

      <div className={`dropzone ${drag ? 'drag' : ''} ${job && !job.error ? 'busy' : ''}`} onClick={() => !job && input.current?.click()} role="button" tabIndex={0}>
        <div className="dz-icon" aria-hidden>
          ⇪
        </div>
        <strong>{drag ? 'Drop it here' : 'Drop a dataset here'}</strong>
        <span>
          <code>player_data.zip</code>, its folder, or <code>.nakama-0</code> parquet files (one per player per match, in day folders like
          <code> February_10</code>)
        </span>
        <span className="dz-buttons">
          <button onClick={(e) => (e.stopPropagation(), input.current?.click())}>Choose files or a zip</button>
          <button onClick={(e) => (e.stopPropagation(), folder.current?.click())}>Choose a folder</button>
        </span>
        <input ref={input} type="file" multiple hidden onChange={(e) => load([...(e.target.files ?? [])].map((file) => ({ path: file.name, file })))} />
        <input
          ref={folder}
          type="file"
          hidden
          {...({ webkitdirectory: '' } as object)}
          onChange={(e) => load([...(e.target.files ?? [])].map((file) => ({ path: file.webkitRelativePath || file.name, file })))}
        />
      </div>

      <section>
        <h2>Datasets</h2>
        <div className="ds-list">
          {job && (
            <article className={`ds-card loading ${job.error ? 'failed' : ''}`}>
              <header>
                <div>
                  <strong>{job.name}</strong>
                  <span className="ds-kind">{job.error ? 'Could not be read' : `${PHASE[job.phase]}${job.total > 1 ? ` · ${job.done.toLocaleString('en')} / ${job.total.toLocaleString('en')}` : ''}`}</span>
                </div>
                {job.error && <button className="ds-use" onClick={() => setJob(null)}>Close</button>}
              </header>
              {job.error ? (
                <p className="ds-error">{job.error}</p>
              ) : (
                <div className="ds-progress">
                  <div style={{ width: `${Math.round((['unzip', 'read', 'build', 'save'].indexOf(job.phase) / 4 + (job.total ? job.done / job.total / 4 : 0)) * 100)}%` }} />
                </div>
              )}
            </article>
          )}
          {builtin && card(builtin)}
          {uploads.map(card)}
        </div>
      </section>
    </div>
  );
}
