# LILA BLACK Player Journey Visualizer

A web tool for Level Designers to see how players actually move, fight, loot and die on LILA BLACK's three
maps, built from 5 days of production telemetry (Feb 10-14, 2026).

**Live: https://lila.belfiore.me**

> Work in progress (assignment for LILA Games, Product Engineer, Gaming). Done so far: map, day and match
> filters, every player's path on the right minimap, humans and bots told apart, event markers.
> Coming: match playback, heatmaps (kills, deaths, traffic), `ARCHITECTURE.md`, `INSIGHTS.md`.

## Tech stack

| Part | Choice |
|---|---|
| Data pipeline | Python 3 + pyarrow + Pillow, run once offline (`pipeline/build.py`) |
| App | Vite, React 19, TypeScript, HTML canvas |
| Hosting | Cloudflare Workers static assets (no server code, no database) |
| Tests | Vitest |

The telemetry never changes, so all parsing happens once at build time. The browser loads a 136 KB index (about 25 KB gzipped) and
then one small JSON file per match (about 5 KB on average), plus a 2048 px minimap.

## Setup

Requirements: Node 22, Python 3.10+.

```bash
npm install
python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
```

The raw data is LILA's and is not in this repository. To rebuild the processed files from it:

```bash
unzip player_data.zip -d data/raw     # gives data/raw/player_data/February_10 ... and minimaps/
npm run data                          # writes public/data/ and public/minimaps/
```

The processed files are committed, so `npm run data` is only needed if the pipeline changes.

## Run, test, deploy

```bash
npm run dev       # http://localhost:5173
npm run check     # type check + tests
npm run deploy    # build + deploy to Cloudflare (needs a Wrangler login)
```

No environment variables are needed: the app is fully static.

## Repository map

| Path | What |
|---|---|
| `pipeline/build.py` | Parquet to JSON: decodes events, groups by match, maps world coordinates to map UV |
| `public/data/` | `index.json` (maps, days, matches) and `matches/<id>.json` (paths and events) |
| `public/minimaps/` | The three minimaps, 2048 x 2048 JPEG |
| `src/lib/` | Pure logic: coordinate mapping, data loading, labels and colors (with tests) |
| `src/components/` | The map canvas and the legend |
| `_Claude/`, `CLAUDE.md`, `.claude/agents/` | How this was built with Claude: brief, data notes, decisions, session log |
