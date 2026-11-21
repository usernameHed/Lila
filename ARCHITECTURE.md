# Architecture

**A static web app fed by an offline pipeline.** The telemetry is 89k rows that never change, so I parse it once,
at build time, and the browser only loads what the current view needs. Nothing to run, nothing to pay, it opens
instantly. Live: https://lila.belfiore.me.

## What I built it with, and why

- **Pipeline: Python + pyarrow** (`pipeline/build.py`), the reference tool for parquet; Pillow for the minimaps.
- **App: Vite + React + TypeScript.** The 2D map is a `<canvas>`: thousands of points per frame with no DOM cost.
  The 3D view uses three.js, loaded only when opened. Pure logic (mapping, playback, heatmaps, filters, picking)
  lives in `src/lib/`, with tests.
- **Hosting: Cloudflare static assets**, no server, no database. GitHub Actions checks, tests and deploys every push.
- **Offline**: a service worker keeps every file after the first visit and, on a new version, downloads only the
  files that changed.

## How the data gets to the screen

```
1,243 parquet files ─ build.py: decode event bytes · ts as seconds · drop 1 duplicate file · group by match
                               · bot or human by movement · (x, z) → map UV · keep y (height)
  ├─ index.json            136 KB   maps, days, one row per match, totals
  ├─ matches/<id>.json     ~5 KB    paths [t, u, v] + heights, events, killer → victim pairs
  ├─ bundles/<map>_<day>   15 files every match of a map and day: 566 matches = 5 requests
  ├─ heat/<map>.json                per-day 128 x 128 grids per kind
  ├─ terrain/<map>.json             96 x 96 ground height, estimated from where players and bots walked
  └─ minimaps/<map>.jpg    ~300 KB  2048 px (sources: 4320, 2160 and 9000 px)
browser: index once → replay (1-5 match files, or bundles) → canvas / three.js; heat files → heatmaps
Data tab: dropped zip / folder / parquet → Web Worker (fflate, hyparquet, src/lib/build.ts = build.py in TS)
          → the same structures in memory, kept in IndexedDB → the same views
```

The whole view (map, day, matches, filters, layers, picked player, 2D / 3D) lives in the URL, so any view is a link.

## How I mapped game coordinates to the minimap

```
u = (x - originX) / scale      v = (z - originZ) / scale      pixel = (u · size, (1 - v) · size)
```

`y` is height, not a map axis. The pipeline stores UV (x 10,000, as integers), never pixels, so any image size or
zoom level works: the README's 1024 px is only an example, the real minimaps are 4320, 2160 and 9000 px.
**I checked it three ways**: a unit test reproduces the README's worked example (pixel 78, 890); all 89,104 rows
land inside [0, 1] on their own map; and the paths follow the roads on all three maps. In 3D: x east, z south,
y = height above the map's lowest point.

## What was ambiguous, and what I decided

| What I ran into | What I did |
|---|---|
| `ts` is typed as milliseconds, but then matches last under 1 s; read as seconds, 13 s to 15 min | Seconds, from the match's first row (there is no wall clock: as Unix time it lands in Dec 2025) |
| 17 files with numeric (bot-style) ids move and loot like humans (mostly user 1429) | Bot or human decided by the movement event (`BotPosition` / `Position`); the id only as a fallback |
| `BotKill` means "I killed a bot" from a human, and "this bot killed someone" from a bot | Stored by meaning, from the emitter's side; heatmaps use the player's side |
| The same human file in `February_10` and `February_11` (a match across midnight) | Read once: 89,016 rows used |
| A kill has no victim, and bots are recorded in only 52 of 796 matches | 36 recorded killer → victim pairs, plus 6 inferred (a bot within 40 m, or a bot path ending at the kill), drawn lighter. No guess where no bot was recorded (95% of fights) |
| No storm position, no extraction event | The storm is not drawn (I tested inferring it: too weak); the timeline marks when it starts killing. "Survived" = no death logged |
| No terrain, no level geometry | Ground height estimated per cell from the heights players walked at; no line of sight (an early version without walls was misleading, so I removed it) |

## Trade-offs

| Considered | Chosen | Why |
|---|---|---|
| Parquet in the browser (DuckDB-WASM), or Streamlit | Offline pipeline + static site | 5 KB per match instead of a database engine or a server; opens instantly, nothing to keep running, full control of the UX |
| SVG or a map library | Canvas (2D), three.js on demand (3D) | A fixed image needs no tiles; designers read top-down first, 3D answers "which floor" |
| One request per match | Map-day bundles above 5 matches | 566 matches in 5 requests, replayed at 60 fps |
| Heatmaps from raw points | Per-day grids, flat color bands with sharp outlines, one color per kind | Small files that still filter by day; outlines stay sharp at any zoom; kinds stack and stay apart |
| Guess the missing victims or the storm | Show only what the data supports | A wrong line looks as true as a right one |
| A server to process new data | The pipeline ported to TypeScript, in a Web Worker | Nothing leaves the browser, no backend; checked equal to the Python output on all 89,016 rows |
