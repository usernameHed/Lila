# SESSION LOG

Newest entry at the top, five lines at most per entry. This file loads in every session: keep it short. Past
about 300 lines, move the oldest entries word for word to `SESSION_HISTORY.md` (not loaded at start: grep it).

## Where things stand

- Live: https://lila.belfiore.me: match replay with playback (one or many matches together), heatmaps
  (traffic, kills, deaths, storm, loot), map and day filters, shareable URLs.
- Due 2026-11-23 (assumed: received 2026-11-18).
- Still open: walkthrough, design pass (references first), hover details on
  markers.
- Auto-deploy: push to `main` deploys (repo secret `CLOUDFLARE_API_TOKEN` = Cloudflare token "LILA GitHub deploy",
  Ugo's account, zone belfiore.me, added by Ugo 2026-11-18).

---

## 2026-11-18 (desktop session): Update button

- Asked: an Update button when a new version is out, like the dashboard and Rina's Recipes. Done: same green pill
  and logic, without a service worker (no offline need): build name in the app and `/build.txt`, checked on open,
  focus and every 5 min; click = reload, view kept (URL). Tested with two real builds on `vite preview`.

## 2026-11-18 (desktop session): several matches replayed together

- Asked: see multiple match replays at the same time. Done: checkboxes, Select all / Clear, URL `match=a,b` or
  `match=all`, one clock from each match's 0:00, 12 match colors, above 12 one color, smaller markers, no loot.
- Loading: up to 5 matches = their files, above = map-day bundles (`public/data/bundles/`). All 566 Ambrose
  matches: 5 requests, 60 fps measured while playing. 16 tests.

## 2026-11-18 (desktop session): INSIGHTS.md and ARCHITECTURE.md

- Insights (numbers from `pipeline/insights.py`): storm is a clock (0 deaths before 10.9 min, 28% of 11+ min runs,
  victims carry 18 loot); PvE in practice (99.9% of kills are bots, 1 human per match: ask the data team); Ambrose
  center = 54% of deaths for 35% of time, south-center pays more loot at 0.35x the death rate.
- ARCHITECTURE.md: one page, data flow, coordinate mapping, assumptions and trade-off tables.

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
