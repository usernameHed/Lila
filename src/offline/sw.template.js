// Service worker: the tool works offline after its first visit. Written by vite.config.ts at build time from this
// template, with this build's name and the list of every file of the site with its content hash.
// - Every file (app, maps, data: about 10 MB) is cached on the first visit, in the background.
// - A new build downloads only the files whose hash changed; the previous build's app files are kept, so a page
//   left open across a deploy can still load its own pieces (the 3D view, the Data worker).
// - The page opens from the cache when it has one, with no wait for the network: on a network that hangs instead of
//   failing (a blocked site, a VPN off), the tool still opens at once. A new version is picked up by the browser's own
//   check of /sw.js (this file's install below), and the Update button puts the new page in the cache first.
// - A file not cached yet is fetched; if the network sends nothing within TIMEOUT_MS, the request fails, like offline.
// - /build.txt (how an open page learns a new version is out) and no-store requests (the Update button's fresh
//   page) always go to the network.
const BUILD = '__BUILD__';
const FILES = __FILES__; // { "/path": "hash" }
const CACHE = 'lila-offline';
const META = '/__offline-meta.json';
const TIMEOUT_MS = 4000;

/** fetch that gives up when no answer starts within TIMEOUT_MS (a hanging network acts as offline). */
function fetchSoon(req) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(req, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(precache());
});

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

async function precache() {
  const cache = await caches.open(CACHE);
  const metaRes = await cache.match(META);
  const old = metaRes ? await metaRes.json() : { files: {}, build: '' };
  const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
  const todo = Object.keys(FILES).filter((p) => old.files[p] !== FILES[p] || !have.has(p));
  // A few at a time; a file that fails is fetched again on the next visit (it is not in the cache).
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const path = todo[next++];
      try {
        const res = await fetch(path, { cache: 'no-cache' });
        if (res.ok && !res.redirected) await cache.put(path, res);
      } catch {
        // offline or busy: next time
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  // Drop what no build uses any more; keep the previous build's app files for pages still open on it.
  const keep = new Set([...Object.keys(FILES), ...Object.keys(old.files).filter((p) => p.startsWith('/assets/')), META]);
  for (const req of await cache.keys()) if (!keep.has(new URL(req.url).pathname)) await cache.delete(req);
  await cache.put(META, new Response(JSON.stringify({ build: BUILD, files: FILES }), { headers: { 'content-type': 'application/json' } }));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/build.txt' || url.pathname === '/sw.js' || req.cache === 'no-store') return;
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then((hit) => hit ?? fetch(req)),
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(url.pathname);
      if (hit) return hit;
      const res = await fetchSoon(req);
      if (res.ok && !res.redirected && (FILES[url.pathname] || url.pathname.startsWith('/assets/'))) cache.put(url.pathname, res.clone());
      return res;
    }),
  );
});
