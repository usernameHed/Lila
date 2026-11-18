# Architecture

## What and why

A **static web app** fed by an **offline data pipeline**. The telemetry is 89k rows that never change, so all
the parsing happens once, at build time, and the browser only downloads what the current view needs.

- **Pipeline: Python + pyarrow** (`pipeline/build.py`). The reference tool for parquet, and the dataset's own
  README is written for it. Pillow downscales the minimaps.
- **App: Vite + React + TypeScript, drawn on a `<canvas>`.** A match has hundreds of points and a heatmap
  16k cells: canvas redraws them every animation frame with no DOM cost. React only runs the side panel.
- **Hosting: Cloudflare Workers static assets** at https://lila.belfiore.me. No server code, no database,
  free, deployed by GitHub Actions on every push to `main` after the type check and tests pass.

## Data flow

```
player_data/February_XX/*.nakama-0  (1,243 parquet files)
  └─ pipeline/build.py
       ├─ decode event bytes, read ts as seconds, drop 1 duplicated file
       ├─ group rows by match, sort by time, human or bot per player
       ├─ world (x, z) -> map UV (0-1) x 10,000, integers
       ├─ public/data/index.json          136 KB: maps, days, one summary row per match
       ├─ public/data/matches/<id>.json   796 files, ~5 KB each: paths [t, u, v...] + events
       ├─ public/data/bundles/<map>_<day>.json  15 files: every match of one map and day (largest 173 KB gzipped)
       ├─ public/data/heat/<map>.json     per-day 128 x 128 grids (traffic, loot, kills and deaths split by bots /
       │                                  players, storm) + the map's killer-to-victim lines
       └─ public/minimaps/<map>.jpg       2048 x 2048, ~300 KB each
browser
  ├─ loads index.json once: filters and match list work with no further request
  ├─ Match replay: 1-5 matches -> their own files; more -> the map-day bundles (566 matches = 5 requests);
  │    draws every path up to time t (interpolated between samples), all matches on one clock
  └─ Heatmaps: fetches one heat file per map; for each kind shown, sums the chosen days, blurs, colors it in
       its own hue, and stacks the kinds over the map (traffic at the bottom, storm deaths on top)
```

Files are cached in memory after their first load. The view (mode, map, day, match, layer) lives in the URL
hash, so any view can be shared as a link.

## Coordinate mapping

The README gives each map a `scale` and an `origin (x, z)`. The game is 3D; the minimap is a top-down view,
so `y` (elevation) is dropped and `(x, z)` becomes the 2D position:

```
u = (x - originX) / scale          v = (z - originZ) / scale           (both 0-1 on the map)
pixelX = u * imageSize             pixelY = (1 - v) * imageSize        (images start top-left: flip v)
```

1. **UV in the pipeline, pixels in the browser.** The pipeline stores `u, v` (times 10,000, as integers), not
   pixels, so the same data fits any image size and any screen. The canvas converts at draw time
   (`src/lib/coords.ts`).
2. **The images are not 1024 px**, as the README says: 4320, 2160 x 2158 and 9000 px. Working in UV makes this
   harmless. All three are resized to 2048 x 2048 (GrandRift stretched by 2 px, 0.1%).
3. **Checked three ways**: a unit test reproduces the README's worked example (pixel 78, 890); every one of
   the 89,104 rows falls inside [0, 1] on its map; paths follow roads and corridors on all three maps.

## Assumptions where the data was ambiguous

| Found | Decision |
|---|---|
| `ts` is typed milliseconds, but read as ms every match lasts under 1 s; read as seconds, 13 s to 15 min | Seconds. Match clock = `ts - first ts of the match`, 1 s resolution. Not wall clock (as Unix time it lands in Dec 2025) |
| 17 files with numeric (bot) ids emit human events: `Position`, `Loot`, never `BotPosition` (mostly user 1429) | Human or bot is decided by the movement event, the id only when a player has no movement. Every match then has a human |
| `BotKill` means "I killed a bot" in a human's file, "this bot killed someone" in a bot's | Events stored as categories from the emitter's side (`killBot`, `diedToBot`, `botKill`, ...). Heatmaps use the human side |
| One match crosses midnight: the same human file is in `February_10` and `February_11`, row for row | Read once (first day wins): 89,016 rows used |
| 794 of 796 matches have a single human | Shown as is, and called out in INSIGHTS.md |
| No extraction event | "Survived" = no death event in the log |
| `y` is height in meters (README), about 40 m of range per map with clear levels (ground, floors, hills) | Kept in decimeters on every sample and event; 3D ground plane at the map's 1st-percentile height |
| No storm position anywhere in the data | The storm is not drawn: inferring it was tested and rejected (players drift one way only 55-67% of the time; 17 storm deaths per map at most). Logging ask in PRODUCT.md |
| A kill row holds only the killer's position: no victim id, position or aim | Killer-victim pairs only where both ends are recorded (same match, same second, within 60 m): 39 fights. Not estimated elsewhere: 95% of kills happen in matches with no bot file, and the nearest recorded bot is a median 105 m away |

## Trade-offs

| Considered | Chosen | Why |
|---|---|---|
| Parse parquet in the browser (DuckDB-WASM) | Offline pipeline to JSON | Instant load, about 5 KB per match instead of a multi-MB engine plus 10 MB of raw files; the data is static |
| Streamlit / a Python server | Static React app | A link that always works, no cold start, nothing to keep running, and finer control of the UX |
| SVG or a map library (Leaflet, deck.gl) | Plain canvas | A fixed square image needs no tiles or projections; canvas is the fastest and smallest option |
| Heatmap from raw points in the browser | Per-day grids from the pipeline | Traffic is 51k points; grids of non-empty cells make one small file per map and still filter by day |
| Max-scaled colors | 98th percentile + square root scale | One extreme hot spot would otherwise wash out every other area |
| One shared color ramp | One hue per kind, opacity = intensity | Several kinds can be stacked and still told apart (kills over traffic, deaths over loot) |
| Gradient only | Toon look by default: 4 flat bands with outlines, bicubic upscale to 8x the grid | Bands read like contour lines: "how hot" at a glance; bicubic keeps the edges curved, not pixelated |
| Line of fire as a heat grid | Drawn as arrows | 39 lines blur into noise as a heatmap; as arrows each one reads |
| One request per match for multi-replay | Map-day bundles above 5 matches | Never hundreds of requests; one match alone stays a 5 KB load. 566 matches replay at 60 fps |
| 3D always, or a 3D library in the main bundle | 2D by default, 3D on demand (lazy chunk, 125 KB gzipped) | Level designers read top-down maps first; 3D answers "which floor", not "where" |
| Full-size minimaps | 2048 px JPEG | ~300 KB instead of 3-12 MB, still sharp on a retina laptop |
