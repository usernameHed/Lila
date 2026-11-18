# DATA: what the telemetry is, and what we found in it

Source: `player_data.zip` (local only, unzip to `data/raw/`), with its own `README.md`.

## Shape

- 1,243 parquet files (no extension), one per player per match: `{user_id}_{match_id}.nakama-0`.
- Columns: `user_id` string, `match_id` string (ends in `.nakama-0`), `map_id` string, `x` `y` `z` float32,
  `ts` timestamp[ms], `event` **binary** (decode as UTF-8).
- Human `user_id` = UUID; bot `user_id` = short number.

## Verified on 2026-11-18 (full scan)

- 1,243 files read, 0 unreadable; 89,104 rows; 796 matches (285 / 201 / 162 / 112 / 37 from Feb 10 to Feb 14,
  Feb 14 is partial); each match is on a single map.
- Rows per map: AmbroseValley 61,013, Lockdown 21,238, GrandRift 6,853.
- Events: Position 51,347, BotPosition 21,712, Loot 12,885, BotKill 2,415, BotKilled 700, KilledByStorm 39,
  Kill 3, Killed 3. Human vs human fights are almost absent: most combat is humans vs bots.
- Every (x, z) falls inside its map's UV square [0, 1] with the README's scale and origin: the config is right.

## Coordinate mapping

```
u = (x - originX) / scale        v = (z - originZ) / scale
px = u * imageWidth              py = (1 - v) * imageHeight     (image origin top-left, so v is flipped)
```

| Map | Scale | Origin X | Origin Z | Source image |
|---|---|---|---|---|
| AmbroseValley | 900 | -370 | -473 | PNG 4320 x 4320 |
| GrandRift | 581 | -290 | -290 | PNG 2160 x 2158 |
| Lockdown | 1000 | -500 | -500 | JPG 9000 x 9000 |

`y` is elevation, not used for the 2D map.

## Nuances and assumptions (copy into ARCHITECTURE.md)

- **The images are not 1024 px** as the README says: 4320, 2160 x 2158 and 9000. We map in UV (0-1) and scale
  to whatever size the image is shown at, so the README's 1024 only matters as an example. All three are
  downscaled to 2048 x 2048 JPEG for the web; GrandRift is stretched by 2 px (0.1%), invisible.
- **`ts` is typed milliseconds but counts seconds.** Read as ms, every match lasts 0.01 to 0.9 s; read as
  seconds, 13 s to 15 min (median 6.4 min), which fits an extraction shooter. It is not wall clock either: as
  Unix seconds it lands on late Dec 2025, not Feb 2026. So the match clock is `(ts - first ts of the match)`
  in seconds, with a 1 s resolution. The day of a match is its folder.
- **Bot or human: the movement event wins over the id.** 17 files have a numeric (bot-like) id but emit
  `Position`, `Loot` and human-style `BotKill`, never `BotPosition`: mostly user `1429`, in 13 matches over all
  5 days (also `1379`, `1402`), very likely a test or internal account. Classified as humans. Rule in the
  pipeline: `BotPosition` = bot, `Position` = human, the id only when a user has no movement. No user emits both.
  With this rule every match has a human, and bots never loot.
- **The same event means different things by emitter.** A human's `BotKill` = "I killed a bot"; a bot's
  `BotKill` = "this bot killed someone". Events are stored as categories from the emitter's point of view:
  `killBot`, `killPlayer`, `diedToBot`, `diedToPlayer`, `storm`, `loot` (humans), `botKill`, `botDeath` (bots).
  Heatmaps use the human point of view only (kills = killBot + killPlayer, deaths = diedTo* + storm).
- **Matches are one human's journey.** 794 of 796 matches have exactly one human, 2 have two. Only 52 matches
  carry bot files. So a match replay shows one human plus, sometimes, the bots around them; most bots are only
  seen through the human's kill and death events.
- **Sampling**: positions every 5 s (median), 10 s at p90, 1 s clock resolution. Playback interpolates linearly
  between samples. 175 position samples come after the player's death (out of 51k): kept, harmless.

- **One duplicated journey.** Match `ac049b28` crosses midnight: its human file is in both `February_10` and
  `February_11`, identical row for row (its bots are only in `February_11`). The pipeline reads each file name
  once (first day wins), so the match is dated Feb 10 and its 88 rows are not counted twice. Raw rows 89,104,
  rows used 89,016.
- **Killer-victim pairs are rare.** A kill row stores only the emitter's position and time: no victim id, no
  victim position, no aim or facing. A pair exists only when the other side's file exists too (bot files: 52
  matches). Rule: same match, kill and death categories that match, within 1 s and 60 m, never a player with themself: 36 fights.
  Without the 60 m cap 3 false pairs appeared (88, 199, 389 m). Estimating victims from the nearest recorded bot
  was tested and rejected: nearest bot a median 105 m away, only 22 more within 40 m.
- **Deeper pairing (asked by Ugo)**: in matches with bot files, a bot alive within 40 m when a player dies to a
  bot, or a bot whose path ends within 10 s and 40 m of a player's bot kill: 6 more pairs, flagged inferred.
  Ceiling: 2,119 of 2,240 kills and 381 of 403 deaths are in matches with no bot recorded at all.
- **PvP**: 3 matches (2 Ambrose Valley, 1 Grand Rift). In each, the only human recorded has `Kill` and `Killed`
  at the same second and spot, at the end of the match: a trade or a self-kill; the other human's file is missing.
- **Raised kills**: player kills more than 3 m above the estimated ground: Ambrose 162, Grand Rift 37, Lockdown 33.
- **Power positions**: computed in the browser, blurred kills / blurred time spent vs the map average (cells with
  little time left out). Nearly all kills are against bots: it shows where fights are won, i.e. bot placement today.
- **Terrain**: estimated per map on a 96 grid (10th percentile height per cell, 21-36% of cells walked, the rest
  filled from the nearest walked cells by a ring-by-ring flood fill, 2 smoothing passes; the first version filled
  from the map's lowest point and sank unwalked areas into bowls). Not lowered in 3D: a height offset gets
  multiplied by the exaggeration (2 m showed as 16 m at x8); the ground uses a depth (polygon) offset instead..
- **Height (`y`)**: meters, about 40 m of range per map with clusters (ground, upper floors, hills): Ambrose Valley
  100-163 m, Lockdown 33-71 m, Grand Rift 8-47 m. Index keeps each map's 1st-99th percentile as `hMin` / `hMax`.
- **No storm data**: no storm event or edge position. Inference tested and rejected (late-match drift 55-67% one
  way; storm death time vs position correlation 0.5 at best on 17 points).
- Checked: no match is on two maps; 210 duplicate position samples (same t, u, v), harmless.
