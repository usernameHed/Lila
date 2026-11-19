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

**Match replay** (left: which matches; middle: the map; right: the layers).
On a 16:9 screen (1366x768 to 1920x1080) everything fits without scrolling:
- **Replay** one match or many on one clock, at 10x / 30x / 60x; Space plays and pauses; grabbing the timeline
  pauses. The timeline has a tick per fight and death, and a band where the storm kills (from minute 10.9).
- **Match filters**, as one-click chips that show how many matches each would leave: day, how it ended (survived, bot, storm, player), length (under 5, 5-10, over 10 min), others
  recorded (bots or a second player logged too: fights from both sides, marked ⇄), players who played only once;
  order by day, longest, shortest, most kills, most loot. By day, matches are grouped: fold a day, tick it to select
  all its matches; one line per match (duration, how it ended, kills ✕, loot ◆).
- **Layers** (one list for icons and heatmaps): each kind of data is one row, with two switches. **Icons** draws it
  on the replay (path lines, or an icon per event), **Heat** draws it as a heatmap of the whole selection: the
  same events seen two ways, in one place ("Item looted" = gems and the loot heat; "Bot killed" = icons and where
  players stand when killing bots). Column headers turn a whole column on or off. Heat only, under "Analysis":
  power positions (kills per minute spent) and raised kills (from 3 m above the ground). Hover a row: it explains
  itself, its markers pulse on the map and their ticks light up on the timeline. Heat per kind or merged; sliders
  for icon size, path width and path opacity. Heatmaps are toon bands with vector outlines, sharp at any zoom.
  Icons: a robot spider where a player killed a bot, a crosshair for other kills, a skull over crossed bones where
  a player died, a dead monster for a bot's death, a diamond for loot and the storm.
  Hovering a path in 2D highlights it; click it for the player's card (each event with its icon).
- **Map picker**: the three maps as tiles (picture, name, matches), the same tiles on the Data page.
  Paths keep the same peak brightness whatever the number of matches shown.
- **Hover never hides**: what is pointed at stays bright and pulses, the rest fades back halfway, eased in and out.
- **Everything is linked**: hover an event on the map, its tick on the timeline or its row in a player's card,
  and it pulses in all of them and in the layer list. Click a player or an event for its card (how it ended,
  distance, height range, fights, every event; click one to jump there). Everyone that player fought is
  highlighted with them, and each fight links to the other side.
- **2D**: the map fills the stage, opens just past its dark border; scroll, pinch or + / - to zoom (8x) into the side
  space, drag to pan, double-click to reset. Each map has a small picture in the map list and on the Data page.
- **3D**: an estimated terrain (from where players walked), paths, events and the heatmap at their real height;
  drag to orbit, middle or right drag to move, scroll to zoom, height x1 to x8; hover and click work as in 2D.
- **Line of fire**: killer-to-victim arrows for the 36 recorded pairs, plus 6 inferred (lighter).
- **Data tab**: drop another export (`player_data.zip`, its folder, or `.nakama-0` parquet files) and the whole tool
  runs on it. It is read and processed in the browser (a Web Worker running the same pipeline as `pipeline/build.py`,
  ported to `src/lib/build.ts` and checked value for value against it), kept in this browser, and shown when ready;
  the left panel always says which data is on screen, one click to change it.
- **Undo / redo** for every setting (arrows in the header, Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z); dragging a slider is one step.
- **Works offline** after the first visit: a service worker keeps every file (app, maps, data, about 10 MB) in the
  browser; a new version downloads only the files that changed. A loading screen while files arrive, and a Reload
  screen instead of a blank page if a piece fails.
- **Installs as an app** (Chrome, Edge, Safari, phones): its own window and icon, a popup offers it on a computer
  (as on Ugo's dashboard, "Not now" hides it 30 days); it updates itself, with the green Update button.
- **Any screen**: fits a 16:9 screen with no scrolling; on a phone, drag and pinch the map, or use + and -.
- **Shareable views**: the URL holds the whole view. **Update button** when a new version is deployed.

## Tech stack

| Part | Choice |
|---|---|
| Data pipeline | Python 3 + pyarrow + Pillow, run once offline (`pipeline/build.py`); the same steps in TypeScript for data dropped in the browser |
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
| `src/lib/` | Pure logic: coordinate mapping, playback clock, heatmap binning and colors, URL view, drawing, the in-browser pipeline (with tests) |
| `src/workers/loadData.ts` | Web Worker for dropped data: unzip (fflate), parquet (hyparquet), pipeline |
| `src/components/` | Map canvas, match replay, playback bar, heatmaps, layer list |
| `_Claude/`, `CLAUDE.md`, `.claude/agents/` | How this was built with Claude: brief, data notes, decisions, session log |
