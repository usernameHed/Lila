// Undo / redo of the view (every setting on screen). Quick successive changes of the same setting (dragging a
// slider, typing) merge into one step, so one undo goes back to before the drag.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  lastKey: string | null; // which setting changed last
  lastAt: number; // when (ms)
}

export const MERGE_MS = 800;
const LIMIT = 100;

export const start = <T>(present: T): History<T> => ({ past: [], present, future: [], lastKey: null, lastAt: 0 });

/**
 * A new state. `key` names what changed: the same key within MERGE_MS replaces the last step instead of adding one.
 * `null`: never merged (clicks that pick something: each one is its own step).
 */
export function record<T>(h: History<T>, next: T, key: string | null, now: number): History<T> {
  if (Object.is(next, h.present)) return h;
  const merge = key !== null && key === h.lastKey && now - h.lastAt < MERGE_MS && h.past.length > 0;
  return {
    past: merge ? h.past : [...h.past, h.present].slice(-LIMIT),
    present: next,
    future: [],
    lastKey: key,
    lastAt: now,
  };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], lastKey: null, lastAt: 0 };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), lastKey: null, lastAt: 0 };
}
