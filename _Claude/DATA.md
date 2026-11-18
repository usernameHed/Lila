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
- **Matches are mostly one human's journey.** 779 of 796 matches have exactly one human file, 16 have none
  (bots only), 1 has two. Only 52 matches carry bot files at all (744 have none). So "watching a match" mostly
  means one human plus, sometimes, the bots around them; most bots are only seen through the humans'
  `BotKill` / `BotKilled` events.

- To check next: duplicate rows, a match split across two day folders, players with events after death,
  `Loot` and `KilledByStorm` emitted by bots or not, how often positions are sampled.
