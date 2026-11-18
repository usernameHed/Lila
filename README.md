# LILA BLACK Player Journey Visualizer

A web tool for Level Designers to see how players actually move, fight, loot and die on LILA BLACK's three
maps, built from 5 days of production telemetry (Feb 10-14, 2026).

**Live: https://lila.belfiore.me**

Built for LILA Games' Product Engineer assignment. Read next: **[ARCHITECTURE.md](ARCHITECTURE.md)** (how it
works, the coordinate mapping, assumptions, trade-offs), **[INSIGHTS.md](INSIGHTS.md)** (three things the
tool shows about the game) and **[PRODUCT.md](PRODUCT.md)** (who it is for, what to do next, what the game
should log so the tool can answer more).

## What it does

- **Match replay**: pick a map, a day and a match; every player's path is drawn on the minimap (players solid
  blue, bots dashed orange) with a marker for each kill, death, storm death and loot. Play it at 10x, 30x or
  60x (Space plays and pauses), or scrub the timeline, which carries a tick for every fight and death.
- **Several matches at once**: tick matches in the list (or "Select all") to replay them together, all from
  their own 0:00, one color per match. With every match of a map selected, you see where all players are at
  minute 8, where fights start, who is still out at minute 11. "One color" draws them all in the same color.
- **Heatmaps**: where players spend time (green), stand when killing (red), get killed (white), get caught by the
  storm (violet), loot (yellow), and the line of fire between killer and victim (orange), per map, for one day or
  all five. Click a kind to show it alone, tick its box to stack several. Kills and deaths split into bots,
  players or both. Two looks: smooth, or toon (flat bands with outlines); one color per kind, or one for all.
- **Players who played once**: a replay filter for the 107 matches that were a player's only one, to see what
  happened to the players who did not come back.
- **Fight lines**: in replay, a dashed arrow from killer to victim for the 39 kills whose victim is also recorded.
- **Shareable views**: the URL holds the mode, map, day, match and layer, so a link opens exactly that view.
- **Update button**: when a newer version is deployed, an open page shows a green Update button (checked on
  open, on return to the tab and every 5 minutes); it reloads onto the new version and keeps the view.

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

A push to `main` deploys by itself (`.github/workflows/deploy.yml`) once the repository secret
`CLOUDFLARE_API_TOKEN` exists (a Cloudflare token from the "Edit Cloudflare Workers" template).

No environment variables are needed: the app is fully static.

## Repository map

| Path | What |
|---|---|
| `pipeline/build.py` | Parquet to JSON: decodes events, groups by match, maps world coordinates to map UV |
| `pipeline/insights.py` | The numbers behind INSIGHTS.md, from the processed files |
| `public/data/` | `index.json` (maps, days, matches), `matches/<id>.json` (paths and events), `bundles/<map>_<day>.json` (all matches of a map and day), `heat/<map>.json` (per-day grids) |
| `public/minimaps/` | The three minimaps, 2048 x 2048 JPEG |
| `src/lib/` | Pure logic: coordinate mapping, playback clock, heatmap binning and colors, URL view, drawing (with tests) |
| `src/components/` | Map canvas, match replay, playback bar, heatmaps, legend |
| `_Claude/`, `CLAUDE.md`, `.claude/agents/` | How this was built with Claude: brief, data notes, decisions, session log |
