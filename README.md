# LILA BLACK Player Journey Visualizer

A web tool for Level Designers to see how players actually move, fight, loot and die on LILA BLACK's three
maps, built from 5 days of production telemetry (Feb 10-14, 2026).

**Live: https://lila.belfiore.me**

Built for LILA Games' Product Engineer assignment. Read next: **[ARCHITECTURE.md](ARCHITECTURE.md)** (how it
works, the coordinate mapping, assumptions, trade-offs), **[INSIGHTS.md](INSIGHTS.md)** (three things the
tool shows about the game) and **[PRODUCT.md](PRODUCT.md)** (who it is for, what to do next, what the game
should log so the tool can answer more).

## What it does

The site opens on an **Overview**: what the tool is for, the four findings with their charts, the proposals, the
data details we had to get right, how it is built, and what the game should log next, each with links into the
live views. It doubles as the walkthrough of the features below.

**Match replay** (left: which matches and the legend; middle: the map; right: the heatmap):
- **Replay** one match or many on one clock, at 10x / 30x / 60x; Space plays and pauses; grabbing the timeline
  pauses. The timeline has a tick per fight and death, and a band where the storm kills (from minute 10.9).
- **Matches grouped by day**: fold a day, tick it to select all its matches; one line per match (duration, how
  it ended, kills, loot). Filters: all, players who played only once, matches with a player-vs-player fight.
- **Legend**: click a row to show or hide it (paths included), All / None; hover a row and those markers pulse
  on the map, future ones shown see-through.
- **Everything is linked**: hover an event on the map, its tick on the timeline or its row in a player's card,
  and it pulses in all of them and in the legend. Click a player or an event for its card (how it ended,
  distance, height range, fights, every event; click one to jump there). Everyone that player fought is
  highlighted with them, and each fight links to the other side.
- **Heatmap panel**: traffic, loot, power positions (kills per minute spent), raised kills (from 3 m above the
  ground), line of fire, kills and deaths (bots / players / both), storm deaths; one color per kind or one color;
  toon bands with vector outlines, sharp at any zoom.
- **2D**: the map fills the stage, opens just past its dark border; scroll to zoom (8x) into the side space, drag
  to pan, double-click to reset.
- **3D**: an estimated terrain (from where players walked), paths, events and the heatmap at their real height;
  drag to orbit, middle or right drag to move, scroll to zoom, height x1 to x8; hover and click work as in 2D.
- **Line of fire**: killer-to-victim arrows for the 36 recorded pairs, plus 6 inferred (lighter).
- **Shareable views**: the URL holds the whole view. **Update button** when a new version is deployed.

## Tech stack

| Part | Choice |
|---|---|
| Data pipeline | Python 3 + pyarrow + Pillow, run once offline (`pipeline/build.py`) |
| App | Vite, React 19, TypeScript, HTML canvas (2D), three.js (3D, loaded on demand) |
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

A push to `main` deploys by itself (`.github/workflows/deploy.yml`) once the repository secret
`CLOUDFLARE_API_TOKEN` exists (a Cloudflare token from the "Edit Cloudflare Workers" template).

No environment variables are needed: the app is fully static.

## Repository map

| Path | What |
|---|---|
| `pipeline/build.py` | Parquet to JSON: decodes events, groups by match, maps world coordinates to map UV |
| `pipeline/insights.py` | The numbers behind INSIGHTS.md and PRODUCT.md, from the processed files |
| `pipeline/figures.py`, `public/figures/` | The charts and maps in INSIGHTS.md and PRODUCT.md (matplotlib, from the processed files) |
| `public/data/` | `index.json` (maps, days, matches), `matches/<id>.json` (paths and events), `bundles/<map>_<day>.json` (all matches of a map and day), `heat/<map>.json` (per-day grids) |
| `public/minimaps/` | The three minimaps, 2048 x 2048 JPEG |
| `src/lib/` | Pure logic: coordinate mapping, playback clock, heatmap binning and colors, URL view, drawing (with tests) |
| `src/components/` | Map canvas, match replay, playback bar, heatmaps, legend |
| `_Claude/`, `CLAUDE.md`, `.claude/agents/` | How this was built with Claude: brief, data notes, decisions, session log |
