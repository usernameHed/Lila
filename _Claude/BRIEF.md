# BRIEF: the assignment, in short

Source: LILA's written test "Player Journey Visualization Tool" (local `.docx`, not tracked). Summarised here.

## Task

Build and deploy a web tool that lets a **Level Designer** explore player behavior on LILA BLACK's maps (an
extraction shooter), from 5 days of production telemetry (Feb 10-14, 2026, parquet), 3 minimaps and a README.
AI tools are expected. About 10-15 h of work, 5 days.

## Core requirements

- Load and parse the parquet data.
- Player journeys on the correct minimap, world coordinates mapped properly.
- Humans and bots told apart visually.
- Event types (kills, deaths, loot, storm deaths) as distinct markers.
- Filters by map, date and/or match.
- Timeline / playback to watch a match unfold.
- Heatmaps: kill zones, death zones, high-traffic areas.
- Hosted, shareable link.

Free choice of stack, design and architecture. "A polished tool with 4 well-executed features beats a messy
tool with 10 half-working ones." Data nuances to get right: coordinate mapping, bytes encoding, bot detection,
timestamps. Document every assumption.

## Graded on

System design, attention to detail, end-to-end execution, product thinking, code quality, communication.

## Deliverables (one GitHub repo link, nothing else accepted)

- All source code and a working deployment URL.
- `README.md`: tech stack, setup steps, env vars.
- `ARCHITECTURE.md`, one page: what and why, data flow parquet to screen, **coordinate mapping walkthrough**,
  assumptions, trade-offs table.
- `INSIGHTS.md`: three things learned about the game with the tool. For each: what caught the eye, concrete
  evidence (stat, pattern), the actionable (metrics affected, action items), why a level designer should care.

## Checklist before submitting

- [ ] Tool live at the hosted URL
- [ ] Player paths render correctly on the minimap
- [ ] Humans vs bots visible
- [ ] Kill, death, loot and storm events marked
- [ ] Filtering by map / date / match works
- [ ] Timeline or playback shows match progression
- [ ] Heatmaps: kill zones, death zones, traffic
- [ ] Architecture doc covers the coordinate mapping
- [ ] Three insights with evidence
- [ ] Walkthrough covers all major features (a short video or a section in the README, to decide)
