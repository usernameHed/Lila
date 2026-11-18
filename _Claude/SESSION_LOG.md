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

## 2026-11-18 (desktop session): match filters

- Ugo: reword "3 of 566"; filter the interesting ones: connected, survived / killed, game length. Done
  (`lib/matchFilter.ts`, tested): Ended, Length, Others recorded (bots or 2nd human: 52 matches, ⇄), Players,
  Order (day / longest / shortest / kills / loot; flat list when not by day). Header "N matches · K shown".
  Old `players=pvp` links -> `end=player`.

## 2026-11-18 (desktop session): fights from both sides

- Ugo: PvP line of fire, other player's path. Searched the raw data: the 3 PvP pairs are one player's Kill + Killed at
  the same second; no other file matches; nearby players are in other matches. Card says so (pvp-note).
- Built for the 42 recorded / inferred fights: a focused player's opponents are highlighted (2D, 3D), fight rows
  link to the other side. Also: 3D events use the 2D icons; loot icon bigger.

## 2026-11-18 (desktop session): big UI pass (Ugo's list)

- Heatmaps tab gone: heatmap is a right panel in Match replay (own one-color switch); old `mode=heat` links map to
  replay + heatmap + paths hidden. Tabs clearer (accent). Legend: paths toggleable, click = toggle, All / None.
- Removed: line of sight (misleading), By player / By height. Map canvas fills the stage, opens 1.15x past the
  border, zoom uses side space. 3D: middle / right drag pans. Timeline: storm band from 10.9 min (zone not logged).
- Toon outlines are vector contours (marching squares, `lib/contours.ts`). Match list grouped by day (fold, tick a
  day). Linked hover / click of one event across map (2D, 3D), timeline tick, legend row and player card.
- Ugo: storm zone = "needed next time": in Overview and PRODUCT.md telemetry asks.

## 2026-11-18 (desktop session): power positions, raised kills, line of sight, PvP filter

- Ugo: "build both" (power positions, raised kills); line of sight even if approximate; PvP fights viewable apart.
  Done: `killsRaised` heat layer (terrain built first), `powerGrid` (tested), viewshed on the terrain (tested,
  250 m, 1.7 m eye, Line of sight switch in replay 2D and heatmaps), Players "Fought a player" (3 matches).
- Found: the 3 PvP events are Kill + Killed at the same second and spot at match end (trade or self-kill); they had
  been paired as a fight of a player with themself: fixed (36 recorded + 6 inferred = 42 lines).
- Ugo: toon edges not clean -> anti-aliased (distance to the band edge in pixels); 3D terrain "bent" -> unwalked cells
  had sunk (filled from the map's lowest point): now flood-filled from the nearest walked cells. Then (Ugo, x8 offset):
  the 2 m terrain sink was scaled by the exaggeration (16 m at x8): removed, depth polygon offset instead.

## 2026-11-18 (desktop session): click a player, 2D zoom, deeper pairs

- Ugo: zoom in 2D; 3D dots stretched; click a dot / path for all its info; line of fire short? search deeper.
  Done: zoom / pan / reset (MapCanvas); heads counter-scaled; pick (lib/pick.ts, 2D by UV, 3D by screen projection)
  -> focus highlight + PlayerCard (lib/story.ts); 6 inferred pairs (flagged, lighter). Arrow = killer -> victim,
  short because fights are close (median 9 m). ARCHITECTURE.md trimmed to one page.

## 2026-11-18 (desktop session): Overview page, terrain, rubric pass

- Ugo: rubric pasted; "no one reads docs": a summary in the page. Done: Overview tab (default landing): stats, 6 "try it"
  cards, 4 findings with charts, proposals, data details, build + trade-offs, logging asks. Charts in public/figures.
- Ugo: terrain from paths: 96 grid, 10th percentile per cell, Laplace fill, lit mesh in 3D (Terrain / Flat); heatmap
  draped in 3D; smooth look removed (toon only). App split: SidePanels.tsx, legend click rules tested in view.ts.

## 2026-11-18 (desktop session): height, 2D and 3D

- Ugo: use y (height) for 2D and 3D. Done: pipeline keeps height (dm) on samples, events, fights, `hMin/hMax` per map;
  2D "By height" path colors (8 bands, one stroke each); 3D view (three.js, lazy chunk): minimap ground, Line2 paths,
  round event dots, fights, orbit, playback, exaggeration x1-8. URL `view=3d`, `color=height`, `ex=`.
- Ugo: show the storm moving. Not in the data; inference tested and rejected (see DATA.md). Logged as a telemetry ask.

## 2026-11-18 (desktop session): charts for the decisions

- Ugo: a doc section with the "why the team needs it" content, and charts to back each view, assumption and proposal.
  Done: `pipeline/figures.py` -> 7 PNGs in `public/figures/` (validated palette, each next to a table of its numbers);
  PRODUCT.md rewritten (LILA's problem quote, who/decision/where, 4 findings with chart + table + live link, proposals
  table, assumptions and limits, logging asks); charts added to INSIGHTS.md.

## 2026-11-18 (desktop session): interactive legend, heatmap under replay, toon default

- Ugo: legend hover animates, row = only, box = toggle (URL `hide=`); heatmap under the replay (URL `under=1`);
  toon by default and less pixelated (bicubic, 8x); he did not get the line of fire: now arrows in both modes
  (heat file `fights`, no more fire grid), bigger, outlined, a legend row. Side panel scrolls, 330 px wide.

## 2026-11-18 (desktop session): PRODUCT.md, telemetry asks, "played once" filter

- Ugo: the missing victim data is worth telling LILA; and why the tool, for which decisions, propose concrete things.
- Found: 43% of players played once; 62% of them died to a bot in it (49% in repeat players' matches); next-day
  return 6-18%. PRODUCT.md: users and decisions, 4 ranked proposals (first-match bots first), telemetry asks table.
- Tool: Match replay filter "Played only once" (`onlyMatch` in the index, URL `players=once`).

## 2026-11-18 (desktop session): one color, bots / players, fight lines, toon heatmaps

- Ugo: one-color option (both modes), "Kill" -> "Position when killing", bots / players / both, kill-death pairs with
  a line-of-fire heatmap (he chose lines + heatmap knowing only ~39 pairs exist), toon (BotW-like) heatmap. All done.
- Pairs: same second + within 60 m (3 false pairs at 88-389 m dropped). Ugo asked why not extrapolate: no victim
  data in 95% of kills; nearest-bot estimate rejected (median 105 m). Heat list: row = only that kind, box = toggle.

## 2026-11-18 (desktop session): playback keys, heatmap colors and stacking

- Ugo: grabbing the timeline must pause; Space stopped working once the timeline had focus. Fixed (pause on pointer
  down; Space toggles anywhere but text fields and dropdowns, focused control blurred first). Tested with real clicks.
- Ugo: color the heatmaps (red kills, green traffic) and show several at once. Done: one hue per kind (traffic green,
  loot yellow, kills red, deaths white, storm violet), toggles on the left, URL `layer=traffic,kills`; old links work.

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
