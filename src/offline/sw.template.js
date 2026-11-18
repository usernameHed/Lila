// Service worker: the tool works offline after its first visit. Written by vite.config.ts at build time from this
// template, with this build's name and the list of every file of the site with its content hash.
// - Every file (app, maps, data: about 10 MB) is cached on the first visit, in the background.
// - A new build downloads only the files whose hash changed; the previous build's app files are kept, so a page
//   left open across a deploy can still load its own pieces (the 3D view, the Data worker).
// - The page itself is asked from the network first (a new version shows at once), the cache when offline.
// - /build.txt always goes to the network: it is how an open page learns a new version is out (Update button).
const BUILD = '__BUILD__';
const FILES = __FILES__; // { "/path": "hash" }
const CACHE = 'lila-offline';
const META = '/__offline-meta.json';

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
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/build.txt' || url.pathname === '/sw.js') return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => (await caches.match('/')) ?? Response.error()),
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(url.pathname);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && !res.redirected && (FILES[url.pathname] || url.pathname.startsWith('/assets/'))) cache.put(url.pathname, res.clone());
      return res;
    }),
  );
});
