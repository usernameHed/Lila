# AGENT CTO: how the tool is built

Details in `README.md` and `ARCHITECTURE.md`. Data facts in `_Claude/DATA.md`. This is the map.

## Stack (decided 2026-11-18)

- **Data pipeline**: Python 3 + pyarrow (`pipeline/build.py`), run once offline. Reads the 1,243 parquet files,
  decodes events, groups by match, converts world (x, z) to map UV (0-1), writes small static JSON:
  `public/data/index.json` (maps, days, matches), `public/data/matches/<match>.json` (one file per match) and
  `public/data/heat/<map>.json` (per-day 128 x 128 grids for each heatmap layer) and
  `public/data/bundles/<map>_<day>.json` (all matches of a map and day, for multi-match replay).
  Minimaps downscaled to 2048 px JPEG in `public/minimaps/`.
- **App**: Vite + React + TypeScript (`src/`), rendering on a 2D canvas (thousands of points, fast), no backend.
- **Hosting**: Cloudflare Worker `lila` with static assets (`wrangler.jsonc`), Ugo's own account. Static only:
  no server, no database, nothing to keep running.

Why: the data is 89k rows and never changes, so the heavy work happens once at build time and the browser
only loads what one view needs. Trade-offs are listed in `ARCHITECTURE.md`.

## Where things go

| Area | Files |
|---|---|
| Pipeline | `pipeline/build.py` (raw parquet to JSON), `pipeline/requirements.txt`; its TypeScript twin `src/lib/build.ts` (Data tab). Change both together; `.verify/compare.ts` (local, needs raw data) checks they agree |
| Coordinate mapping | `src/lib/coords.ts` (map config comes from `index.json`) |
| Playback clock, heatmap math, URL view | `src/lib/timeline.ts`, `src/lib/heat.ts`, `src/lib/view.ts` (all tested) |
| Canvas drawing, labels and colors | `src/lib/draw.ts`, `src/lib/style.ts` |
| Data loading and cache | `src/lib/data.ts` |
| New version check (green Update button, like the dashboard, no service worker) | `src/lib/update.ts`, `vite.config.ts` (`__BUILD__`, `build.txt`) |
| Screens and parts | `src/App.tsx`, `src/components/` (Replay, Heat, PlaybackBar, MapCanvas, Legend) |
| Deploy | `wrangler.jsonc`, `npm run deploy`; push to `main` deploys via `.github/workflows/deploy.yml` once the secret exists |

## Rules

1. `npm run check` after every change; fix what fails.
2. Try every change in a browser before saying it works, also at phone width; say what was not checked.
3. Pure logic (mapping, filters, timeline, heatmap binning) lives in `src/lib/` with tests.
4. The pipeline is deterministic: running it twice gives the same files. Never hand-edit `public/data/`.
5. Wrangler: prefix `XDG_CONFIG_HOME=/Users/hed/.config/wrangler-ugo` (Ugo's account); `wrangler whoami` with it if unsure.
6. Keep the deploy free: static assets only.
