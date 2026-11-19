// Where the data comes from: the built-in LILA dataset (static files) or a dataset someone dropped in the Data tab,
// built in the browser and kept in this browser only (IndexedDB). The loaders in data.ts read the active one.
import type { Dataset } from './build';

export interface SourceInfo {
  id: string; // 'builtin' or 'upload-<time>'
  name: string;
  kind: 'builtin' | 'upload';
  createdAt?: number;
  files?: number;
  rows: number;
  matches: number;
  players: number;
  days: string[];
  maps: string[];
  /** Matches per map (older saved datasets may not have it). */
  mapMatches?: Record<string, number>;
}

export const BUILTIN_ID = 'builtin';
const DB = 'lila-data';
const STORE = 'datasets';
const KEY = 'lila-source';

function db(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((ok, fail) => {
    const req = run(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

/** Uploaded datasets kept in this browser (their summaries, not the data). */
export async function listUploads(): Promise<SourceInfo[]> {
  try {
    const all = await tx<{ info: SourceInfo }[]>('readonly', (s) => s.getAll());
    return all.map((x) => x.info).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } catch {
    return []; // private mode or storage blocked: uploads simply are not kept
  }
}

export async function saveUpload(info: SourceInfo, dataset: Dataset): Promise<void> {
  await tx('readwrite', (s) => s.put({ info, dataset }, info.id));
}

export async function deleteUpload(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

// The active source, shared by the loaders and the React views (subscribe / snapshot).
let active: { id: string; dataset: Dataset | null } = { id: BUILTIN_ID, dataset: null };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

export const subscribeSource = (f: () => void) => (listeners.add(f), () => listeners.delete(f));
export const currentSource = () => active;

/** Make a dataset the active one (an upload, given directly after building it, or read back from storage). */
export async function selectSource(id: string, dataset?: Dataset): Promise<void> {
  if (id === BUILTIN_ID) active = { id, dataset: null };
  else {
    const data = dataset ?? (await tx<{ dataset: Dataset } | undefined>('readonly', (s) => s.get(id)))?.dataset;
    if (!data) throw new Error('This dataset is no longer in this browser.');
    active = { id, dataset: data };
  }
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // storage blocked: the choice lasts for this visit only
  }
  notify();
}

/** On start: the dataset chosen last time in this browser, else the built-in one. */
export async function restoreSource(): Promise<void> {
  let id: string | null = null;
  try {
    id = localStorage.getItem(KEY);
  } catch {
    id = null;
  }
  if (id && id !== BUILTIN_ID) await selectSource(id).catch(() => selectSource(BUILTIN_ID));
}

/** A short summary of a dataset for its card. */
export function describe(id: string, name: string, kind: SourceInfo['kind'], d: Dataset, files?: number): SourceInfo {
  return {
    id,
    name,
    kind,
    createdAt: kind === 'upload' ? Date.now() : undefined,
    files,
    rows: d.index.totals.rows,
    matches: d.index.matches.length,
    players: d.index.totals.humans,
    days: d.index.days,
    maps: [...new Set(d.index.matches.map((m) => m.map))],
    mapMatches: d.index.matches.reduce<Record<string, number>>((a, m) => ((a[m.map] = (a[m.map] ?? 0) + 1), a), {}),
  };
}
