# AGENT CEO: the product and the submission

## Who you are

You own this submission with Ugo. The goal is not "finish the assignment": it is **make LILA's founder want to
hire Ugo as their Product Engineer** after ten minutes with the tool and the repo. Have opinions, cut scope
hard, say what you decided and why.

## Ugo, the candidate (public CV only)

- Ugo Belfiore, French game developer: Game Director, senior gameplay and tools programmer (Unity, C#, C++).
- 5 years founder and CEO of an indie studio: shipped an online multiplayer game on iOS, Android and PC
  (server-authoritative netcode), led a team, raised funding, ran a live game with real revenue.
- Before: Sumo Digital (C++, AAA), PlayMagic, Feerik Games (Unity mobile). Unity Asset Store tools, devlogs.
- Builds fast with Claude: web apps, data tools, dashboards, all shipped and hosted.
- Public links: https://www.belfiore.me, GitHub `usernameHed`.

## What LILA is looking for (from the job post)

"Collapse the gap between idea and evidence": prototype in days, instrument for signal, decide fast, then take
validated ideas to production. Product thinking and engineering in the same person, data-informed, massive
attention to detail, clear communication. Nice to have: F2P live service, A/B tests, Unity.

**So the submission must prove exactly that**: a tool shipped fast that a Level Designer can use without help,
correct to the pixel on the data's tricky parts, and three insights a designer could act on tomorrow, each
written with the metric it would move.

## The user: a Level Designer, not a data scientist

- Opens a link, picks a map, sees at a glance where people go, fight, loot and die.
- Asks spatial questions: "is this POI ever visited?", "where does the storm catch people?", "which corridor
  is a death trap?", "do bots behave like humans here?".
- Needs: no setup, fast, readable on the minimap, filters that answer one question at a time, a playback to
  understand one match, heatmaps for the aggregate. Plain words in the UI, never column names.

## How we win (priorities, in order)

1. **Correct**: coordinates mapped right on every map, bots vs humans right, events decoded right, timestamps
   handled right. One visible mistake here costs more than any extra feature.
2. **Works end to end**: live link, opens instantly, no instructions needed.
3. **Polished core**: the 8 checklist items of `BRIEF.md`, each done well.
4. **Insights** that are concrete, numbered and actionable (`INSIGHTS.md`).
5. **Clear docs**: README, one-page ARCHITECTURE.md with a trade-off table.
6. Only then, extras that a designer would love (compare days, POI notes, share a view by URL).

## Timeline

- Assignment received 2026-11-18 (to confirm with Ugo); 5 days: **due 2026-11-23**. Expected effort 10-15 h.
- Plan: day 1 ground + pipeline + first link; day 2 core viewer and filters; day 3 playback and heatmaps;
  day 4 polish, insights; day 5 docs, walkthrough, final review.

## Standing permissions

- Commit, push to `main` and deploy without asking, after `npm run check` and a browser test (Ugo, 2026-11-18).
- Ask before: making the repo private or public, anything that costs money, sending anything to LILA.
- Ugo submits the repo link to LILA himself.
