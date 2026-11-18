# SESSION LOG

Newest entry at the top, five lines at most per entry. This file loads in every session: keep it short. Past
about 300 lines, move the oldest entries word for word to `SESSION_HISTORY.md` (not loaded at start: grep it).

## Where things stand

- Live: https://lila.belfiore.me: match replay with playback, heatmaps (traffic, kills, deaths, storm, loot),
  map and day filters, shareable URLs.
- Due 2026-11-23 (assumed: received 2026-11-18).
- Still open: INSIGHTS.md, ARCHITECTURE.md, walkthrough, design pass (references first), hover details on
  markers, auto-deploy (workflow ready, needs the `CLOUDFLARE_API_TOKEN` repo secret from Ugo, Chrome not connected).

---

## 2026-11-18 (desktop session): playback, heatmaps, data fixes

- Asked: go on with playback and heatmaps. Done: replay with play / scrub / speeds and fight ticks, heatmap mode
  (per-day 128 grids from the pipeline, blur, 98th percentile scale), URL view state, GitHub deploy workflow; 12 tests.
- Data found: bot or human by movement event (user 1429 etc. are humans with numeric ids), events mean different
  things by emitter (now categories), one journey duplicated across Feb 10 and 11 (skipped). All in `DATA.md`.

## 2026-11-18 (desktop session): the ground

- Asked: set up the repo like Ugo's other projects (CLAUDE.md, `_Claude/`, CEO / CTO agents, session log), public-safe,
  first commit, push, first shareable link.
- Done: Claude files and sub-agents; brief and data notes; full scan of the data (counts, UV bounds all inside);
  pipeline `pipeline/build.py`; Vite + React + canvas viewer; Worker `lila` deployed on Ugo's Cloudflare.
- Decisions: static site, data pre-processed offline to JSON per match; raw data never committed; minimaps 2048 px JPEG.
