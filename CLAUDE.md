# CLAUDE.md: LILA BLACK Player Journey Visualizer

Ugo Belfiore's take-home assignment for **LILA Games, Product Engineer, Gaming** (Bangalore): a web tool that
lets a Level Designer see how players move, fight, loot and die on the three maps of LILA BLACK, built from
5 days of production telemetry, hosted behind a shareable link.

**This repository is public and will be read by LILA's founder and team.** Everything tracked here (code,
docs, these Claude files, commit messages) is part of the submission: write it as you would for a reviewer.

## START OF EVERY CONVERSATION: MANDATORY

These are imported below, so they are already loaded. Keep them short. Confirm in two lines what you loaded.

@_Claude/AGENT_CEO.md
@_Claude/AGENT_CTO.md
@_Claude/SESSION_LOG.md

## Read only when the task needs it

| File | Read it before |
|---|---|
| `_Claude/BRIEF.md` | Anything about scope: the assignment's requirements, deliverables, how it is graded, the checklist |
| `_Claude/DATA.md` | Touching the data pipeline or the map mapping: schema, events, coordinate system, nuances found |
| `ARCHITECTURE.md` / `INSIGHTS.md` / `README.md` | Changing them (they are deliverables, see `BRIEF.md`) |

Sub-agents (`.claude/agents/`): `ceo` (product and reviewer view: is this what a Level Designer needs, does it
score on the rubric) and `cto` (architecture, data correctness, code review). Use them for second opinions.

## END OF EVERY SESSION where something changed

- Add an entry at the **top** of `_Claude/SESSION_LOG.md`: date, asked, done, decisions, to do. Five lines at most.
- Update "Where things stand" at the top of the log, and `AGENT_CTO.md` / `README.md` / `ARCHITECTURE.md` when
  the stack, the data flow or the deploy changed.
- Past about 300 lines, move the oldest log entries word for word to `_Claude/SESSION_HISTORY.md` (not loaded).

## Hard rules

- **Public repo, professional only.** No personal life, no other job applications, no salary, no private
  contact details, no secrets, nothing about Ugo's other companies beyond his public CV. Never state where Ugo
  lives now.
- **Never commit the raw data** (`player_data.zip`, `data/raw/`): it is LILA's production telemetry. Only the
  processed files the deployed tool needs are tracked (`public/data/`, `public/minimaps/`). The two LILA
  `.docx` files stay local and untracked too.
- **Commit and push to `main` without asking** (Ugo, 2026-11-18), once `npm run check` passes and the change
  was tried in a browser. Clear English commit messages: the reviewers will read the history.
- **Deploy**: Cloudflare Worker `lila` on Ugo's own Cloudflare account. Prefix every Wrangler command with
  `XDG_CONFIG_HOME=/Users/hed/.config/wrangler-ugo` (the default login on this Mac is another account).
- **Secrets**: never in a file, a command line or a form field filled by Claude. Ugo pastes them himself.
- **Never use the em dash** in the app, the docs or these files (Ugo's rule): ", " for an aside, ":" before an
  explanation, the short dash only for ranges.
- Talk to Ugo in the language he writes in (English or French). App text and all files are English.
- **Speed** (Ugo's global rule): no fetch per row in a loop, data that rarely changes cached, big pictures
  lazy-loaded and downscaled, the screen reacts before the network answers.
- **Design**: before a new look, find real references on minimal.gallery, darkmodedesign.com and land-book.com
  and let Ugo pick (Ugo's global rule). Reuse validated pieces from his dashboard (`/Users/hed/GIT/Unity/dashboard`)
  before building new ones.
- **Code by the common rules**: KISS, SOLID, DRY, YAGNI. Small single-purpose modules, pure logic (coordinate
  mapping, filters, playback) in `src/lib/` with tests. Quality over quantity: 4 polished features beat 10 half-done.
- **Document every assumption** about the data in `_Claude/DATA.md` as you find it, then in `ARCHITECTURE.md`.

## Quick commands

```bash
npm run data        # parquet (data/raw/player_data) -> public/data + public/minimaps (needs .venv, see README)
npm run dev         # local app on http://localhost:5173
npm run check       # types + tests
npm run deploy      # build + deploy the Worker (uses Ugo's Cloudflare login)
```
