"""Turn LILA BLACK's raw parquet telemetry into small static JSON files for the web tool.

Input : data/raw/player_data/February_*/<user_id>_<match_id>.nakama-0  (one parquet file per player per match)
Output: public/data/index.json            maps, days and one summary row per match
        public/data/matches/<match>.json  one file per match: players' paths and events, in map UV
        public/data/heat/<map>.json       per-day heatmap grids (traffic, kills, deaths, storm, loot)
        public/data/bundles/<map>_<day>.json  every match of one map and day, for multi-match replay
        public/minimaps/<map>.jpg         the minimaps, 2048 x 2048 JPEG (and thumbs/<map>.jpg, 96 px)

Coordinates are stored as map UV (0-1, see MAPS) times 10,000, rounded: 1 unit = 0.1 m on the largest map,
far below what a minimap pixel shows, and integers keep the JSON small. Time is ms since the match's first event
(the source clock has 1 s resolution, see _Claude/DATA.md).

Run: .venv/bin/python pipeline/build.py   (or npm run data)
"""

from __future__ import annotations

import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

import pyarrow.parquet as pq
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "player_data"
OUT = ROOT / "public" / "data"
MINIMAPS_OUT = ROOT / "public" / "minimaps"
MINIMAP_SIZE = 2048  # sources are 4320, 2160 x 2158 and 9000 px; 2048 keeps detail at a fraction of the weight

# From the dataset README. Verified: every (x, z) of the 89,104 rows falls inside [0, 1] with these.
MAPS = {
    "AmbroseValley": {"scale": 900, "originX": -370, "originZ": -473},
    "GrandRift": {"scale": 581, "originX": -290, "originZ": -290},
    "Lockdown": {"scale": 1000, "originX": -500, "originZ": -500},
}
UV_UNITS = 10_000
POSITION_EVENTS = {"Position", "BotPosition"}
HEAT_GRID = 128  # heatmap cells per side: 16 px on the 2048 px minimap, about 7 m on Ambrose Valley

# What an event means depends on whose file it is in: a human's BotKill is "I killed a bot", a bot's BotKill is
# "this bot killed someone". So events are stored as a category from the emitter's point of view.
CATEGORY = {
    (False, "Kill"): "killPlayer",
    (False, "BotKill"): "killBot",
    (False, "Killed"): "diedToPlayer",
    (False, "BotKilled"): "diedToBot",
    (False, "KilledByStorm"): "storm",
    (False, "Loot"): "loot",
    (True, "BotKill"): "botKill",
    (True, "BotKilled"): "botDeath",
}

# Heatmap layers (human point of view) and the categories feeding them. "traffic" = human position samples.
# Paired fights (see pair_fights) are too few (39) for a heat grid: they go to the heat file as lines. The app adds:
# kills = killsBot + killsPlayer, deaths = deathsBot + deathsPlayer (storm deaths are their own kind).
HEAT_LAYERS = {
    "traffic": set(),
    "loot": {"loot"},
    "killsBot": {"killBot"},
    "killsPlayer": {"killPlayer"},
    "deathsBot": {"diedToBot"},
    "deathsPlayer": {"diedToPlayer"},
    "storm": {"storm"},
    "killsRaised": set(),  # player kills made RAISED_METERS above the estimated ground (filled in build_match)
}
# A kill and its victim's death are two events in two files; same match, same second (the clock's resolution) = a pair.
PAIR_WITHIN_MS = 1000
# ... and close enough to be the same fight: before this rule 38 pairs lay within 39 m, then a gap (88, 199, 389 m: two unrelated
# events in the same second). Beyond this range a pair is dropped.
PAIR_MAX_METERS = 60
PAIRS = [("killBot", "botDeath"), ("botKill", "diedToBot"), ("killPlayer", "diedToPlayer")]
DAY_DIR = re.compile(r"^February_(\d+)$")
BOT_ID = re.compile(r"^\d+$")


def height_range(matches: dict, map_id: str) -> dict:
    """The map's height range in meters (1st to 99th percentile of every row), for the height colors and the 3D view."""
    ys = sorted(r["y"] for m in matches.values() if m["map"] == map_id for r in m["rows"])
    pick = lambda q: round(ys[int(q * (len(ys) - 1))], 1)  # noqa: E731
    return {"hMin": pick(0.01), "hMax": pick(0.99)}


def height(y: float) -> int:
    """Height (the README's y, elevation in meters) in decimeters, as an integer."""
    return round(y * 10)


def to_uv(map_id: str, x: float, z: float) -> tuple[int, int]:
    """World (x, z) to map UV in UV_UNITS. v grows northward (z); the app flips it for the image."""
    m = MAPS[map_id]
    u = (x - m["originX"]) / m["scale"]
    v = (z - m["originZ"]) / m["scale"]
    return round(u * UV_UNITS), round(v * UV_UNITS)


def decode(event) -> str:
    return event.decode("utf-8") if isinstance(event, (bytes, bytearray)) else str(event)


def read_files():
    """Yield (day, rows) per parquet file, rows as dicts with the event decoded and the clock in seconds.

    A file name (one player in one match) found again in a later day folder is skipped: the one case in the
    data (a match crossing midnight, Feb 10-11) is the same journey exported twice, row for row.
    """
    seen: set[str] = set()
    for day_dir in sorted(RAW.iterdir()):
        match = DAY_DIR.match(day_dir.name)
        if not day_dir.is_dir() or not match:
            continue
        day = f"2026-02-{int(match.group(1)):02d}"
        for path in sorted(day_dir.iterdir()):
            if path.name.startswith("."):
                continue
            if path.name in seen:
                print(f"Skipped duplicate file {day_dir.name}/{path.name}")
                continue
            seen.add(path.name)
            table = pq.read_table(path)
            cols = table.to_pydict()
            rows = [
                {
                    "user": cols["user_id"][i],
                    "match": cols["match_id"][i],
                    "map": cols["map_id"][i],
                    "x": cols["x"][i],
                    "y": cols["y"][i],  # height (elevation) in meters
                    "z": cols["z"][i],
                    # Typed timestamp[ms], but the number counts SECONDS: read as ms, matches last 0.01-0.9 s;
                    # as seconds, 13 s to 15 min. Not wall clock (as Unix seconds it lands on late Dec 2025),
                    # so only differences within a match are used. See _Claude/DATA.md.
                    "sec": round(cols["ts"][i].timestamp() * 1000),
                    "event": decode(cols["event"][i]),
                }
                for i in range(table.num_rows)
            ]
            yield day, rows


def build() -> None:
    if not RAW.exists():
        sys.exit(f"Missing {RAW}: unzip player_data.zip into data/raw/ first (see README).")

    matches: dict[str, dict] = {}
    for day, rows in read_files():
        for row in rows:
            m = matches.setdefault(row["match"], {"map": row["map"], "days": set(), "rows": []})
            if m["map"] != row["map"]:
                raise ValueError(f"Match {row['match']} is on two maps")
            m["days"].add(day)
            m["rows"].append(row)

    for folder in ("matches", "bundles"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
        for old in (OUT / folder).glob("*.json"):
            old.unlink()

    summaries = []
    bundles: dict[tuple[str, str], list] = defaultdict(list)
    heat: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int))))
    terrain = build_terrain(matches)  # first: "raised kills" are judged against the ground
    for match_id, m in sorted(matches.items()):
        data, summary = build_match(match_id, m, heat, terrain[m["map"]])
        write_json(OUT / "matches" / f"{data['id']}.json", data)
        bundles[(data["map"], data["day"])].append(data)
        summaries.append(summary)
    fights_by_map: dict[str, list] = defaultdict(list)
    for items in bundles.values():
        for d in items:
            for _, ku, kv, vu, vv, killer, _, kh, vh, inferred in d["fights"]:
                fights_by_map[d["map"]].append([d["day"], ku, kv, vu, vv, d["players"][killer]["bot"], kh, vh, inferred])
    write_heat(heat, fights_by_map)
    # One file per map and day with all its matches: replaying many matches at once costs a few requests,
    # not one per match. Single-match replay keeps using the small per-match files.
    for (map_id, day), items in bundles.items():
        write_json(OUT / "bundles" / f"{map_id}_{day}.json", items)

    # Players who played a single match in the 5 days: their only match is the one to study for churn (PRODUCT.md).
    human_matches: dict[str, int] = defaultdict(int)
    for data in (d for items in bundles.values() for d in items):
        for p in data["players"]:
            if not p["bot"]:
                human_matches[p["id"]] += 1
    for summary, data in zip(summaries, (d for _, d in sorted((d["id"], d) for items in bundles.values() for d in items))):
        assert summary["id"] == data["id"]
        summary["onlyMatch"] = any(not p["bot"] and human_matches[p["id"]] == 1 for p in data["players"])

    days = sorted({s["day"] for s in summaries})
    index = {
        "maps": [{"id": k, **v, **height_range(matches, k)} for k, v in MAPS.items()],
        "days": days,
        "uvUnits": UV_UNITS,
        "matches": sorted(summaries, key=lambda s: (s["day"], s["map"], s["id"])),
        "totals": {
            "rows": sum(s["rows"] for s in summaries),
            "humans": len(human_matches),
            "bots": len({p["id"] for items in bundles.values() for d in items for p in d["players"] if p["bot"]}),
        },
    }
    write_json(OUT / "index.json", index)
    build_minimaps()
    print(f"{len(summaries)} matches, {sum(s['rows'] for s in summaries)} rows -> {OUT}")


def heat_cell(u: int, v: int) -> int:
    """Grid cell of a UV point, row 0 at the top of the image (v flipped), clamped to the grid."""
    col = min(HEAT_GRID - 1, u * HEAT_GRID // UV_UNITS)
    row = min(HEAT_GRID - 1, (UV_UNITS - v) * HEAT_GRID // UV_UNITS)
    return row * HEAT_GRID + col


TERRAIN_GRID = 96  # ~9 m cells on Ambrose Valley: enough for hills and plateaus, coarse enough to be filled by data
TERRAIN_LOW = 0.1  # per cell, the 10th percentile of heights: the ground under players, not the upper floors


def build_terrain(matches: dict) -> dict[str, list[float]]:
    """Estimated ground height per cell (meters), from every position (players and bots); also written to
    public/data/terrain/<map>.json.

    The data has no terrain, but every path is walked ground (or a floor). Per cell: a low percentile of the heights
    seen there; cells nobody walked take the height of the nearest walked ones (flood fill), then light smoothing.
    File: {grid, h: [decimeters, row 0 at the top of the image], known: share of cells with data}.
    """
    g = TERRAIN_GRID
    terrain: dict[str, list[float]] = {}
    known_share: dict[str, float] = {}
    for map_id in MAPS:
        cells: dict[int, list[float]] = defaultdict(list)
        for m in matches.values():
            if m["map"] != map_id:
                continue
            for r in m["rows"]:
                u, v = to_uv(map_id, r["x"], r["z"])
                col = min(g - 1, max(0, u * g // UV_UNITS))
                row = min(g - 1, max(0, (UV_UNITS - v) * g // UV_UNITS))
                cells[row * g + col].append(r["y"])
        h = [0.0] * (g * g)
        known = [False] * (g * g)
        for i, ys in cells.items():
            ys.sort()
            h[i] = ys[int(TERRAIN_LOW * (len(ys) - 1))]
            known[i] = True
        # Fill unknown cells from the nearest walked cells: a flood fill outward, ring by ring, each new cell taking
        # the mean of its already-filled neighbors. (Starting them at the map's lowest point and averaging made the
        # unwalked areas sag into bowls under the paths.)
        filled = known[:]
        ring = [i for i in range(g * g) if known[i]]
        while ring:
            nxt_ring = []
            for i in ring:
                r, c = divmod(i, g)
                for j in (i - g if r else -1, i + g if r < g - 1 else -1, i - 1 if c else -1, i + 1 if c < g - 1 else -1):
                    if j >= 0 and not filled[j]:
                        filled[j] = True
                        nxt_ring.append(j)
            done = set(nxt_ring)  # a ring reads only the cells filled before it
            for j in nxt_ring:
                r, c = divmod(j, g)
                ns = [h[k] for k in (j - g if r else -1, j + g if r < g - 1 else -1, j - 1 if c else -1, j + 1 if c < g - 1 else -1) if k >= 0 and filled[k] and k not in done]
                h[j] = sum(ns) / len(ns)
            ring = nxt_ring
        # Light smoothing: per-cell noise (a few samples) would make spikes.
        for _ in range(2):
            nxt = h[:]
            for i in range(g * g):
                r, c = divmod(i, g)
                ns = [h[(rr) * g + cc] for rr in (r - 1, r, r + 1) for cc in (c - 1, c, c + 1) if 0 <= rr < g and 0 <= cc < g]
                nxt[i] = sum(ns) / len(ns)
            h = nxt
        terrain[map_id] = h
        known_share[map_id] = round(sum(known) / len(known), 3)
    (OUT / "terrain").mkdir(parents=True, exist_ok=True)
    for map_id, h in terrain.items():
        write_json(OUT / "terrain" / f"{map_id}.json", {"grid": g, "h": [round(x * 10) for x in h], "known": known_share[map_id]})
    return terrain


RAISED_METERS = 3  # a kill made this far above the estimated ground: rooftop, tower, ledge


def ground_at(terrain: list[float], u: int, v: int) -> float:
    """Estimated ground height (m) under a UV point."""
    g = TERRAIN_GRID
    col = min(g - 1, max(0, u * g // UV_UNITS))
    row = min(g - 1, max(0, (UV_UNITS - v) * g // UV_UNITS))
    return terrain[row * g + col]


def write_heat(heat, fights_by_map) -> None:
    """public/data/heat/<map>.json: {grid, layers: {layer: {day: [cell, count, ...]}}, fights: [[day, killer u, killer v,
    victim u, victim v, killer is a bot], ...]}."""
    (OUT / "heat").mkdir(parents=True, exist_ok=True)
    for map_id in MAPS:
        layers = {
            layer: {
                day: [n for cell, count in sorted(cells.items()) for n in (cell, count)]
                for day, cells in sorted(heat[map_id][layer].items())
            }
            for layer in HEAT_LAYERS
        }
        fights = sorted(fights_by_map.get(map_id, []))
        write_json(OUT / "heat" / f"{map_id}.json", {"grid": HEAT_GRID, "layers": layers, "fights": fights})


def classify_bots(rows: list[dict]) -> dict[str, bool]:
    """Bot or human, per user. The movement event decides: BotPosition = bot, Position = human. Only a user with
    no movement at all falls back to the README's rule (numeric id = bot). Why: 17 files with numeric ids
    (mostly user 1429, across all 5 days) emit Position and loot like humans and never BotPosition."""
    moves: dict[str, set] = defaultdict(set)
    for r in rows:
        moves[r["user"]].add(r["event"])
    result = {}
    for user, events in moves.items():
        if "BotPosition" in events and "Position" in events:
            raise ValueError(f"User {user} emits both Position and BotPosition")
        if "BotPosition" in events:
            result[user] = True
        elif "Position" in events:
            result[user] = False
        else:
            result[user] = bool(BOT_ID.match(user))
    return result


def pair_fights(events: list, scale: float) -> list:
    """[t, killer u, killer v, victim u, victim v, killer index, victim index, killer h, victim h, inferred=0] for each
    kill whose victim's death is also recorded. Only possible when both files exist: 36 fights (bot files: 52 matches)."""
    fights = []
    for kill_cat, death_cat in PAIRS:
        deaths = [e for e in events if e[1] == death_cat]
        used: set[int] = set()
        for t, cat, u, v, killer, h in events:
            if cat != kill_cat:
                continue
            max_uv = PAIR_MAX_METERS / scale * UV_UNITS
            near = [
                (abs(d[0] - t), i)
                for i, d in enumerate(deaths)
                if i not in used
                and d[4] != killer  # never a player with themself (the PvP Kill + Killed of one player, see DATA.md)
                and abs(d[0] - t) <= PAIR_WITHIN_MS
                and math.hypot(d[2] - u, d[3] - v) <= max_uv
            ]
            if not near:
                continue
            _, i = min(near)
            used.add(i)
            d = deaths[i]
            fights.append([t, u, v, d[2], d[3], killer, d[4], h, d[5], 0])
    return sorted(fights)


INFER_MAX_METERS = 40  # the recorded pairs all lie within 39 m
INFER_PATH_END_MS = 10_000  # a bot whose path stops within 10 s of a kill: it is the one that died


def infer_fights(events: list, players: list[dict], scale: float, recorded: list) -> list:
    """Pairs the data does not record but supports, flagged inferred (last field 1). Only where bot paths exist:
    - a player killed by a bot: the nearest bot alive at that moment, within INFER_MAX_METERS, is the killer;
    - a player's bot kill: the nearest bot whose path ends within INFER_PATH_END_MS, within range, is the victim.
    """
    bots = [p for p in players if p["bot"] and len(p["path"]) >= 3]
    if not bots:
        return []
    max_uv = INFER_MAX_METERS / scale * UV_UNITS
    done = {(f[0], f[5]) for f in recorded} | {(f[0], f[6]) for f in recorded}

    def sample(b: dict, t: int):
        ts = b["path"][0::3]
        k = min(range(len(ts)), key=lambda q: abs(ts[q] - t))
        return b["path"][k * 3 + 1], b["path"][k * 3 + 2], b["h"][k]

    out = []
    for t, cat, u, v, who, h in events:
        if players[who]["bot"] or (t, who) in done or cat not in ("diedToBot", "killBot"):
            continue
        best = None
        for b in bots:
            ts = b["path"][0::3]
            if cat == "diedToBot" and not ts[0] - 5000 <= t <= ts[-1] + 5000:
                continue
            if cat == "killBot" and abs(ts[-1] - t) > INFER_PATH_END_MS:
                continue
            bu, bv, bh = sample(b, t) if cat == "diedToBot" else (b["path"][-2], b["path"][-1], b["h"][-1])
            d = math.hypot(bu - u, bv - v)
            if d <= max_uv and (best is None or d < best[0]):
                best = (d, b["index"], bu, bv, bh)
        if best is None:
            continue
        _, bi, bu, bv, bh = best
        if cat == "diedToBot":  # the bot shot the player
            out.append([t, bu, bv, u, v, bi, who, bh, h, 1])
        else:  # the player shot the bot
            out.append([t, u, v, bu, bv, who, bi, h, bh, 1])
    return out


def build_match(match_id: str, m: dict, heat, terrain: list[float]) -> tuple[dict, dict]:
    """The match file's content and its summary row for the index; adds its points to the heat grids."""
    rows = sorted(m["rows"], key=lambda r: (r["sec"], r["user"]))
    t0 = rows[0]["sec"]
    players: dict[str, dict] = {}
    events = []
    counts: dict[str, int] = defaultdict(int)
    # A match lives in one day folder; if it ever spans two, the earliest day wins.
    day = sorted(m["days"])[0]
    map_heat = heat[m["map"]]

    bots = classify_bots(rows)
    for r in rows:
        p = players.get(r["user"])
        if p is None:
            p = players[r["user"]] = {"index": len(players), "id": r["user"], "bot": bots[r["user"]], "path": [], "h": []}
        u, v = to_uv(r["map"], r["x"], r["z"])
        t = (r["sec"] - t0) * 1000
        if r["event"] in POSITION_EVENTS:
            p["path"].extend((t, u, v))
            p["h"].append(height(r["y"]))
            if not p["bot"]:
                map_heat["traffic"][day][heat_cell(u, v)] += 1
            continue
        category = CATEGORY.get((p["bot"], r["event"]))
        if category is None:
            raise ValueError(f"Unexpected event {r['event']} from {'bot' if p['bot'] else 'human'} {r['user']}")
        counts[category] += 1
        events.append([t, category, u, v, p["index"], height(r["y"])])
        for layer, cats in HEAT_LAYERS.items():
            if category in cats:
                map_heat[layer][day][heat_cell(u, v)] += 1
        if category in ("killBot", "killPlayer") and r["y"] - ground_at(terrain, u, v) > RAISED_METERS:
            map_heat["killsRaised"][day][heat_cell(u, v)] += 1

    fights = pair_fights(events, MAPS[m["map"]]["scale"])
    fights = sorted(fights + infer_fights(events, list(players.values()), MAPS[m["map"]]["scale"], fights))

    short_id = match_id.removesuffix(".nakama-0")
    player_list = [{k: v for k, v in p.items() if k != "index"} for p in players.values()]
    data = {"id": short_id, "map": m["map"], "day": day, "players": player_list, "events": events, "fights": fights}
    return data, {
        "id": short_id,
        "map": m["map"],
        "day": day,
        "durationMs": (rows[-1]["sec"] - t0) * 1000,
        "humans": sum(not p["bot"] for p in player_list),
        "bots": sum(p["bot"] for p in player_list),
        "rows": len(rows),
        "fights": len(fights),
        "events": dict(sorted(counts.items())),
    }


def build_minimaps() -> None:
    """Square, downscaled JPEGs. GrandRift's 2160 x 2158 source is stretched by 2 px (0.1%): mapping is in UV."""
    MINIMAPS_OUT.mkdir(parents=True, exist_ok=True)
    for source in sorted((RAW / "minimaps").iterdir()):
        map_id = source.name.split("_Minimap")[0]
        if map_id not in MAPS:
            continue
        with Image.open(source) as img:
            img.convert("RGB").resize((MINIMAP_SIZE, MINIMAP_SIZE), Image.LANCZOS).save(
                MINIMAPS_OUT / f"{map_id}.jpg", quality=80, optimize=True, progressive=True
            )
    build_thumbs()


THUMB_SIZE = 96  # shown at 48 px (sharp on 2x screens), a few KB each


def build_thumbs() -> None:
    """Small map pictures for lists and labels (public/minimaps/thumbs/), cropped past the dark border."""
    out = MINIMAPS_OUT / "thumbs"
    out.mkdir(parents=True, exist_ok=True)
    for path in sorted(MINIMAPS_OUT.glob("*.jpg")):
        with Image.open(path) as img:
            w, h = img.size
            m = int(w * 0.08)
            img.crop((m, m, w - m, h - m)).resize((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS).save(
                out / path.name, quality=82, optimize=True
            )


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    build()
