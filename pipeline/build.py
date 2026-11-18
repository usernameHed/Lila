"""Turn LILA BLACK's raw parquet telemetry into small static JSON files for the web tool.

Input : data/raw/player_data/February_*/<user_id>_<match_id>.nakama-0  (one parquet file per player per match)
Output: public/data/index.json            maps, days and one summary row per match
        public/data/matches/<match>.json  one file per match: players' paths and events, in map UV
        public/minimaps/<map>.jpg         the minimaps, 2048 x 2048 JPEG

Coordinates are stored as map UV (0-1, see MAPS) times 10,000, rounded: 1 unit = 0.1 m on the largest map,
far below what a minimap pixel shows, and integers keep the JSON small. Time is ms since the match's first event
(the source clock has 1 s resolution, see _Claude/DATA.md).

Run: .venv/bin/python pipeline/build.py   (or npm run data)
"""

from __future__ import annotations

import json
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
DAY_DIR = re.compile(r"^February_(\d+)$")
BOT_ID = re.compile(r"^\d+$")


def to_uv(map_id: str, x: float, z: float) -> tuple[int, int]:
    """World (x, z) to map UV in UV_UNITS. v grows northward (z); the app flips it for the image."""
    m = MAPS[map_id]
    u = (x - m["originX"]) / m["scale"]
    v = (z - m["originZ"]) / m["scale"]
    return round(u * UV_UNITS), round(v * UV_UNITS)


def decode(event) -> str:
    return event.decode("utf-8") if isinstance(event, (bytes, bytearray)) else str(event)


def read_files():
    """Yield (day, rows) per parquet file, rows as dicts with the event decoded and ts in ms."""
    for day_dir in sorted(RAW.iterdir()):
        match = DAY_DIR.match(day_dir.name)
        if not day_dir.is_dir() or not match:
            continue
        day = f"2026-02-{int(match.group(1)):02d}"
        for path in sorted(day_dir.iterdir()):
            if path.name.startswith("."):
                continue
            table = pq.read_table(path)
            cols = table.to_pydict()
            rows = [
                {
                    "user": cols["user_id"][i],
                    "match": cols["match_id"][i],
                    "map": cols["map_id"][i],
                    "x": cols["x"][i],
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

    (OUT / "matches").mkdir(parents=True, exist_ok=True)
    for old in (OUT / "matches").glob("*.json"):
        old.unlink()

    summaries = []
    for match_id, m in sorted(matches.items()):
        summary = write_match(match_id, m)
        summaries.append(summary)

    days = sorted({s["day"] for s in summaries})
    index = {
        "maps": [{"id": k, **v} for k, v in MAPS.items()],
        "days": days,
        "uvUnits": UV_UNITS,
        "matches": sorted(summaries, key=lambda s: (s["day"], s["map"], s["id"])),
    }
    write_json(OUT / "index.json", index)
    build_minimaps()
    print(f"{len(summaries)} matches, {sum(s['rows'] for s in summaries)} rows -> {OUT}")


def write_match(match_id: str, m: dict) -> dict:
    rows = sorted(m["rows"], key=lambda r: (r["sec"], r["user"]))
    t0 = rows[0]["sec"]
    players: dict[str, dict] = {}
    events = []
    counts: dict[str, int] = defaultdict(int)

    for r in rows:
        p = players.get(r["user"])
        if p is None:
            p = players[r["user"]] = {
                "index": len(players),
                "id": r["user"],
                "bot": bool(BOT_ID.match(r["user"])),
                "path": [],
            }
        u, v = to_uv(r["map"], r["x"], r["z"])
        t = (r["sec"] - t0) * 1000
        counts[r["event"]] += 1
        if r["event"] in POSITION_EVENTS:
            p["path"].extend((t, u, v))
        else:
            events.append([t, r["event"], u, v, p["index"]])

    short_id = match_id.removesuffix(".nakama-0")
    # A match lives in one day folder; if it ever spans two, the earliest day wins.
    day = sorted(m["days"])[0]
    player_list = [{k: v for k, v in p.items() if k != "index"} for p in players.values()]
    write_json(
        OUT / "matches" / f"{short_id}.json",
        {"id": short_id, "map": m["map"], "day": day, "players": player_list, "events": events},
    )
    return {
        "id": short_id,
        "map": m["map"],
        "day": day,
        "durationMs": (rows[-1]["sec"] - t0) * 1000,
        "humans": sum(not p["bot"] for p in player_list),
        "bots": sum(p["bot"] for p in player_list),
        "rows": len(rows),
        "events": {k: v for k, v in sorted(counts.items()) if k not in POSITION_EVENTS},
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


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    build()
