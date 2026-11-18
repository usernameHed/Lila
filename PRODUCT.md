# Why this tool, and what to do with it

A visualizer is only worth building if it changes a decision. This page is about the decisions, the data that
should drive them, and what the game should log so the next version of the tool can answer more.

## Who uses it, for which decision

| Who | Question | Where in the tool |
|---|---|---|
| Level designer | Which POIs, routes and corners are used, ignored, or deadly? Does a layout change move players? | Traffic, loot and kill heatmaps per day; compare days before and after a change |
| Level designer | Can players reach extraction before the storm? | Storm deaths heatmap, replays of 11+ minute matches |
| Game designer | Are bots too strong, too weak, badly placed? | Position when killed (bots), replays with bot paths and fight lines |
| Product | Why do new players stop after one match? | Match replay, Players: "Played only once" (107 matches), then Select all |
| Everyone | "Show me" in a meeting | Any view is a link: send it, the other person sees the same thing |

The loop it serves is the one in the job post: **hypothesis → change → telemetry → see it on the map → keep or
revert**, in days rather than weeks.

## What the data says matters most: the first match

Insights 1 to 3 (`INSIGHTS.md`) are about the maps. Looking at players instead (all numbers from
`python3 pipeline/insights.py`):

- **43% of players (107 of 248) played only one match** in the 5 days.
- In that only match, **62% died to a bot**. In the matches of players who came back, 49% did.
- Of new players each day, **6% to 18% came back the next day**.
- Bots cause 91% of player deaths (insight 2): for a new player, *the game is the bots*.

Correlation, not proof, and a small, partial sample (a paused game, 5 days). But it points at one testable
idea, and it is cheap to test.

## Proposals, most leverage first

1. **First-match bots (FTUE).** For a player's first 3 matches, fewer or softer bots near spawn and the first
   POIs, and an extraction point shown from minute 0.
   *Test*: A/B on new players. *Metrics*: first-match survival, matches per player, next-day return.
   *Tool today*: Match replay, Players "Played only once", Select all: where those players died.
   *Tool next*: with match order logged (below), a "first 3 matches" filter and a before / after comparison.
2. **Extraction before the storm** (insight 1). A minute-10 "extract now" cue and a look at extraction points
   near where storm victims stood. *Metrics*: storm deaths per match, extraction rate of 10+ minute runs.
3. **Risk pays on Ambrose Valley** (insight 3). Raise loot value in the center, or move bot pressure to the
   south, where loot is nearly free. *Metrics*: loot per minute and deaths per minute by region.
4. **Decide what the matchmaking is for** (insight 2). With one human per match, PvP spaces are dead space:
   either fill matches with more humans (fewer concurrent rooms, longer queue), or design the maps for PvE.
   A product decision first, then a level design one.

## What to log next (so the tool can answer more)

Today a kill row holds only the killer's own position and the time: **no victim id, no victim position, no aim
or facing**. A victim is known only when its own file exists (bot files: 52 of 796 matches), so 39 of ~2,650
fights can be drawn as killer→victim lines. Asks, smallest change first:

| Event | Add | Unlocks |
|---|---|---|
| `Kill`, `BotKill`, `Killed`, `BotKilled` | other side's id and position, weapon, distance, line of sight | Lines of fire for every fight, sightline heatmaps, weapon range by area |
| Every position sample | facing (yaw), and 1-2 s sampling in combat instead of ~5 s | Where players look, what they see from each corner |
| New: `Extracted` | extraction point id, time, loot value carried | Real extraction rate (today "survived" = no death logged) |
| New: storm state | storm edge position or phase per match, every 10 s | Draw the storm on the replay; who it catches and why |
| New: `MatchStart` | humans and bots in the match, spawn point, mode, party size | Matchmaking analysis; spawn heatmaps; first-match filter |
| Every row | wall-clock UTC time; `ts` stored in its real unit (seconds today, typed as ms) | Order a player's matches, sessions, retention by match number |
| `Loot` | item id, rarity or value, container id | Loot value heatmaps: where the rich loot is, not just the count |
| Bots | every bot logged in every match, with an archetype or difficulty tier | Bot placement and tuning per area |
| Ids | test accounts flagged (user 1429 plays like a human with a bot-style id) | Clean data without guesswork |

The tool is ready for each of these: the pipeline maps any (x, z) to the minimap, and a new event is a new
heatmap layer or replay marker.
