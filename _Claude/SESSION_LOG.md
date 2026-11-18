# SESSION LOG

Newest entry at the top, five lines at most per entry. This file loads in every session: keep it short. Past
about 300 lines, move the oldest entries word for word to `SESSION_HISTORY.md` (not loaded at start: grep it).

## Where things stand

- Live: https://lila.belfiore.me (first version: map, day and match filters, paths and event markers).
- Due 2026-11-23 (assumed: received 2026-11-18).
- Still open: playback, heatmaps, design pass (references first), INSIGHTS.md, ARCHITECTURE.md, walkthrough,
  auto-deploy from GitHub (needs a `CLOUDFLARE_API_TOKEN` repo secret from Ugo).

---

## 2026-11-18 (desktop session): the ground

- Asked: set up the repo like Ugo's other projects (CLAUDE.md, `_Claude/`, CEO / CTO agents, session log), public-safe,
  first commit, push, first shareable link.
- Done: Claude files and sub-agents; brief and data notes; full scan of the data (counts, UV bounds all inside);
  pipeline `pipeline/build.py`; Vite + React + canvas viewer; Worker `lila` deployed on Ugo's Cloudflare.
- Decisions: static site, data pre-processed offline to JSON per match; raw data never committed; minimaps 2048 px JPEG.
