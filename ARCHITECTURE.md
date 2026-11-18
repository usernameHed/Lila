# Architecture

**A static web app fed by an offline pipeline.** The telemetry is 89k rows that never change, so parsing happens
once at build time and the browser loads only what the current view needs. Live: https://lila.belfiore.me.

- **Pipeline**: Python + pyarrow (`pipeline/build.py`), the reference parquet tool; Pillow for the minimaps.
- **App**: Vite + React + TypeScript. 2D on a `<canvas>` (thousands of points per frame, no DOM cost); 3D with
  three.js, loaded only when opened. Pure logic (mapping, playback, heat, picking) lives in `src/lib/` with tests.
- **Hosting**: Cloudflare static assets, no server, no database; GitHub Actions checks, tests and deploys every push.

## Data flow

```
1,243 parquet files ─ build.py: decode event bytes · ts as seconds · drop 1 duplicate file · group by match
                               · bot or human by movement · (x, z) → map UV · keep y (height)
  ├─ index.json            136 KB   maps, days, one row per match, totals
  ├─ matches/<id>.json     ~5 KB    paths [t, u, v] + heights, events, killer → victim pairs
  ├─ bundles/<map>_<day>   15 files every match of a map-day: 566 matches = 5 requests
  ├─ heat/<map>.json                per-day 128² grids per kind + line-of-fire pairs
  ├─ terrain/<map>.json             96² ground height estimated from where players and bots walked
  └─ minimaps/<map>.jpg    ~300 KB  2048² (sources: 4320, 2160 and 9000 px)
browser: index once → replay (1-5 match files, or bundles) → canvas / three.js; heat files → toon bands
```

Files are cached after the first load; the whole view (mode, map, day, matches, layers, 3D...) lives in the URL.

## Coordinate mapping

```
u = (x - originX) / scale      v = (z - originZ) / scale      pixel = (u · size, (1 - v) · size)
```

`y` is height, not a map axis. The pipeline stores UV × 10,000 as integers, never pixels, so any image size or
zoom level works; the README's 1024 px is only an example (the real images differ). **Checked three ways**: a unit
test reproduces the README's worked example (pixel 78, 890); all 89,104 rows land inside [0, 1] on their map;
paths follow roads on all three maps. In 3D: x east, z south, y = height above the map's low point.

## Assumptions where the data was ambiguous

| Found | Decision |
|---|---|
| `ts` typed ms, but matches would last < 1 s; as seconds, 13 s to 15 min | Seconds, relative to the match's first row (no wall clock: as Unix time it lands in Dec 2025) |
| 17 numeric-id (bot-style) files move and loot like humans (mostly user 1429) | Bot or human decided by `BotPosition` / `Position`; the id only as a fallback |
| `BotKill` means "I killed a bot" from a human, "this bot killed someone" from a bot | Stored as categories from the emitter's side; heatmaps use the player's side |
| The same human file in `February_10` and `February_11` (a match across midnight) | Read once: 89,016 rows used |
| No victim on a kill row; bot files for only 52 of 796 matches | 39 recorded pairs + 6 inferred (bot within 40 m / bot path ending at the kill), drawn lighter. No guess where no bot was recorded (95% of fights) |
| No storm position, no extraction event | Storm not drawn (inference tested, too weak); "survived" = no death logged |
| No terrain | Estimated: 10th percentile of heights per cell, unwalked cells filled from neighbors, labeled estimated |

## Trade-offs

| Considered | Chosen | Why |
|---|---|---|
| Parquet in the browser (DuckDB-WASM), or Streamlit | Offline pipeline + static site | 5 KB per match instead of an engine or a server; opens instantly, nothing to run |
| SVG or a map library | Canvas (2D), three.js on demand (3D) | A fixed image needs no tiles; 3D answers "which floor", designers start top-down |
| One request per match | Map-day bundles above 5 matches | 566 matches in 5 requests, replayed at 60 fps |
| Raw points for heatmaps | Per-day grids, toon bands, one hue per kind | Small files that still filter by day; bands read like contours and kinds stack |
| Line of fire as a heat grid | Arrows | 45 lines blur into noise as heat |
| Guess missing victims or the storm | Show only what the data supports | A wrong line looks as true as a right one |
