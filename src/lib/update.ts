// New version check, like Ugo's dashboard and Rina's Recipes: when a newer build is live, a green Update button
// shows; a click reloads onto it, keeping the current view (it is in the URL).
// Each build writes its name into the app (__BUILD__) and into /build.txt, and the open page compares the two on
// open, when it comes back to the front, and every 5 minutes. The service worker (offline mode, see
// src/offline/sw.template.js) never caches /build.txt and asks the network first for the page, so a reload
// always lands on the new version.
import { useSyncExternalStore } from 'react';

declare const __BUILD__: string;
export const BUILD = typeof __BUILD__ === 'string' ? __BUILD__ : '';

const EVERY_MS = 5 * 60_000;

let ready = false;
const listeners = new Set<() => void>();

/** True once the live build differs from this page's build. Pure, for tests. */
export function isNewer(live: string | null, mine: string): boolean {
  const name = live?.trim() ?? '';
  return !!name && !!mine && name !== mine && /^[a-z0-9]{4,20}$/.test(name);
}

async function check() {
  if (ready || document.visibilityState !== 'visible' || !navigator.onLine) return;
  try {
    const r = await fetch('/build.txt', { cache: 'no-store' });
    if (r.ok && isNewer(await r.text(), BUILD)) {
      ready = true;
      listeners.forEach((f) => f());
    }
  } catch {
    // offline or the site is busy: next time
  }
}

export function startUpdates() {
  if (import.meta.env.DEV || !BUILD) return;
  void check();
  setInterval(check, EVERY_MS);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
}

export function useUpdateReady(): boolean {
  return useSyncExternalStore(
    (f) => (listeners.add(f), () => listeners.delete(f)),
    () => ready,
  );
}

export const applyUpdate = () => location.reload();

/** Offline mode: after the first visit, every file of the site is kept in this browser (production only). */
export function startOffline() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined); // not supported or blocked: online only
  });
}
