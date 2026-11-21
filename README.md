# LILA BLACK Player Journey Visualizer

**Live: https://lila.belfiore.me**

A browser tool for Level Designers: open the link, pick a map, and see where players walk, fight, loot and die on
LILA BLACK's three maps. Built from 5 days of production telemetry (Feb 10-14, 2026) for LILA Games' Product
Engineer assignment.

**TL;DR:** I made it a tool you can use straight away, with no setup, and I spent time on the basics people
usually forget: it installs as an app, works offline after the first visit, takes new data with a drag and drop,
has undo and redo for everything, reacts before the data has loaded, and works on a phone as on a PC.

Read next: [INSIGHTS.md](INSIGHTS.md) (three things I learned about the game), [ARCHITECTURE.md](ARCHITECTURE.md)
(how it is built, the coordinate mapping, my assumptions, the trade-offs) and [PRODUCT.md](PRODUCT.md) (who it is
for, what I would change in the game, what the game should log next).

## Walkthrough (3 minutes)

1. **Match replay** (the landing page): pick a map (Ambrose Valley, Grand Rift, Lockdown) and a day (or all five).
   Show **All**, **10** or **100** matches drawn at random (↻ draws again), or **Custom** to pick them one by one.
2. **Filters** over the map, one line each, every chip showing how many matches it leaves: game (no bots
   recorded, bots recorded, 2 players), how the player's run ended (survived, killed by a bot, by a player, by the
   storm) and length. "Clear all filters" goes back to every match.
3. **Watch it**: press Space or Play. Every selected match runs on one clock, at 10x, 30x or 60x; drag the
   timeline to scrub. It has a tick per fight and death, and a band where the storm kills (from minute 10.9).
4. **Humans and bots**: players are solid lines, one color per match; bots are dashed. Event icons: an orange
   robot head under a crosshair where a player killed a bot, the robot head alone where a bot died, a skull over
   crossed bones where a player died (white: by a bot, red: by a player), a violet icon for a storm death, a
   yellow diamond for loot.
5. **One match**: click it in the "On the map" list, or click a path. Only that match stays, it plays from 0:00,
   and the player's card lists every event (click one to jump there). In the 52 matches with bots recorded, each
   bot can be picked too, and arrows go from killer to victim.
6. **Elements and Heatmap** (bottom of the left panel): turn each kind of path or icon on and off; draw heatmaps
   of the whole selection: traffic, loot, bot kills, deaths by bot, deaths by player, power positions (kills per
   minute spent) and raised kills (made from 3 m above the ground). Hover a row: it explains itself and its icons
   pulse on the map.
7. **3D**: the same replay on a terrain estimated from where players walked, with the real heights (x1 to x8).
8. **Share**: the URL holds the whole view (map, day, matches, filters, layers, picked player, 2D / 3D). Copy it.
9. **Data**: drop another export (`player_data.zip`, its folder or the parquet files) and the whole tool runs on
    it, in the browser, nothing uploaded.

What I learned with it, and why the tool is built this way, is in [INSIGHTS.md](INSIGHTS.md).

Also: undo / redo (arrows next to the zoom, Cmd / Ctrl + Z), zoom and drag in 2D (pinch on a phone), Cmd / Ctrl + A
to select every match, a green Update button when a new version is out, and an offer to install it as an app.

## Tech stack

| Part | Choice |
|---|---|
| Data pipeline | Python 3 + pyarrow + Pillow, run once offline (`pipeline/build.py`); the same steps in TypeScript for data dropped in the browser |
| App | Vite, React 19, TypeScript, HTML canvas (2D), three.js (3D, loaded only when opened) |
| Hosting | Cloudflare Workers static assets: no server code, no database |
| Tests | Vitest |

The telemetry never changes, so all the parsing happens once, at build time. The browser loads a 136 KB index
(25 KB gzipped), then one small file per match (5 KB on average) and a 2048 px minimap.

## Setup

Requirements: Node 22, Python 3.10+.

```bash
npm install
python3 -m venv .venv && .venv/bin/pip install -r pipeline/requirements.txt
```

The raw data is LILA's and is not in this repository. The processed files are, so you only need this if the
pipeline changes:

```bash
unzip player_data.zip -d data/raw     # gives data/raw/player_data/February_10 ... and minimaps/
npm run data                          # writes public/data/ and public/minimaps/
```

## Run, test, deploy

```bash
npm run dev       # http://localhost:5173
npm run check     # type check + tests
npm run deploy    # build + deploy to Cloudflare (needs a Wrangler login)
```

**Environment variables: none.** The app is fully static. A push to `main` deploys by itself
(`.github/workflows/deploy.yml`) with the repository secret `CLOUDFLARE_API_TOKEN` (a Cloudflare token made from
the "Edit Cloudflare Workers" template).

## Repository map

| Path | What |
|---|---|
| `pipeline/build.py` | Parquet to JSON: decodes events, groups by match, maps world coordinates to the minimap |
| `pipeline/insights.py`, `pipeline/figures.py` | The numbers and charts behind INSIGHTS.md and PRODUCT.md (charts in `public/figures/`) |
| `public/data/` | `index.json` (maps, days, matches), `matches/` (one file per match), `bundles/` (every match of a map and day), `heat/` (per-day heatmap grids), `terrain/` |
| `public/minimaps/` | The three minimaps, 2048 px JPEG |
| `src/lib/` | Pure logic with tests: coordinate mapping, playback clock, heatmaps, filters, URL view, drawing, the in-browser pipeline |
| `src/workers/loadData.ts` | Reads dropped data in a Web Worker: unzip (fflate), parquet (hyparquet), pipeline |
| `src/components/` | Screens and parts: replay, map canvas, 3D view, playback bar, panels |
| `src/offline/` | The service worker that keeps the site working offline |
| `_Claude/`, `CLAUDE.md`, `.claude/agents/` | How I built it with Claude: the brief, data notes, decisions, session log |
