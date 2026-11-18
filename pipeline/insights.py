"""Numbers behind INSIGHTS.md and PRODUCT.md, computed from the processed files in public/data (no raw data needed).

Run: python3 pipeline/insights.py
"""

from __future__ import annotations

import json
import statistics as st
from collections import Counter, defaultdict
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "public" / "data"
DEATHS = {"diedToBot", "diedToPlayer", "storm"}


def load():
    index = json.loads((DATA / "index.json").read_text())
    matches = {m["id"]: json.loads((DATA / "matches" / f"{m['id']}.json").read_text()) for m in index["matches"]}
    return index, matches


def pct(a, b):
    return f"{100 * a / b:.1f}%" if b else "n/a"


def per_map(index, matches):
    print("\n## Per map")
    by_map = defaultdict(list)
    for m in index["matches"]:
        by_map[m["map"]].append(m)
    total = len(index["matches"])
    for map_id, ms in sorted(by_map.items(), key=lambda kv: -len(kv[1])):
        ev = Counter()
        for m in ms:
            ev.update(m["events"])
        died = sum(1 for m in ms if any(m["events"].get(k) for k in DEATHS))
        kills = [m["events"].get("killBot", 0) + m["events"].get("killPlayer", 0) for m in ms]
        loot = [m["events"].get("loot", 0) for m in ms]
        dur = [m["durationMs"] / 60000 for m in ms]
        print(
            f"{map_id}: {len(ms)} matches ({pct(len(ms), total)}), median {st.median(dur):.1f} min, "
            f"died {pct(died, len(ms))} (bot {ev['diedToBot']}, player {ev['diedToPlayer']}, storm {ev['storm']}), "
            f"kills/match {st.mean(kills):.2f}, loot/match {st.mean(loot):.1f}"
        )


def combat(index):
    print("\n## Combat")
    ev = Counter()
    for m in index["matches"]:
        ev.update(m["events"])
    humans = Counter(m["humans"] for m in index["matches"])
    print(f"humans per match: {dict(humans)}")
    print(f"player kills {ev['killPlayer']}, bot kills {ev['killBot']}, deaths to bots {ev['diedToBot']}, to players {ev['diedToPlayer']}, storm {ev['storm']}")
    print(f"share of human kills that are bots: {pct(ev['killBot'], ev['killBot'] + ev['killPlayer'])}")
    d = ev["diedToBot"] + ev["diedToPlayer"] + ev["storm"]
    print(f"deaths: bots {pct(ev['diedToBot'], d)}, players {pct(ev['diedToPlayer'], d)}, storm {pct(ev['storm'], d)}")


def coverage(index):
    """How concentrated traffic is: share of samples in the busiest 10% of visited cells, and cells visited once."""
    print("\n## Traffic concentration (128 x 128 grid, humans)")
    for map_id in ("AmbroseValley", "Lockdown", "GrandRift"):
        heat = json.loads((DATA / "heat" / f"{map_id}.json").read_text())
        cells = Counter()
        for flat in heat["layers"]["traffic"].values():
            for i in range(0, len(flat), 2):
                cells[flat[i]] += flat[i + 1]
        counts = sorted(cells.values(), reverse=True)
        top = counts[: max(1, len(counts) // 10)]
        loot = Counter()
        for flat in heat["layers"]["loot"].values():
            for i in range(0, len(flat), 2):
                loot[flat[i]] += flat[i + 1]
        loot_in_top = sum(v for c, v in loot.items() if c in {c for c, _ in cells.most_common(len(top))})
        print(
            f"{map_id}: {len(counts)} cells visited, busiest 10% hold {pct(sum(top), sum(counts))} of traffic "
            f"and {pct(loot_in_top, sum(loot.values()))} of loot; cells with 1-2 samples: {sum(1 for c in counts if c <= 2)}"
        )


def quadrants(index, matches):
    """Where things happen by map region (thirds of the map), to spot ignored and over-used areas."""
    print("\n## Regions (3 x 3 grid of the map, row 0 = north)")
    for map_id in ("AmbroseValley", "Lockdown", "GrandRift"):
        traffic, loot, kills, deaths = Counter(), Counter(), Counter(), Counter()
        units = index["uvUnits"]

        def region(u, v):
            col = min(2, u * 3 // units)
            row = min(2, (units - v) * 3 // units)
            return int(row), int(col)

        for m in matches.values():
            if m["map"] != map_id:
                continue
            for p in m["players"]:
                if p["bot"]:
                    continue
                for i in range(0, len(p["path"]), 3):
                    traffic[region(p["path"][i + 1], p["path"][i + 2])] += 1
            for t, cat, u, v, _ in m["events"]:
                r = region(u, v)
                if cat == "loot":
                    loot[r] += 1
                elif cat in ("killBot", "killPlayer"):
                    kills[r] += 1
                elif cat in DEATHS:
                    deaths[r] += 1
        tt, tl, tk, td = (sum(c.values()) for c in (traffic, loot, kills, deaths))
        print(f"{map_id}: cell = traffic / loot / kills / deaths")
        for row in range(3):
            print("   " + " | ".join(f"{pct(traffic[(row, c)], tt):>6} {pct(loot[(row, c)], tl):>6} {pct(kills[(row, c)], tk):>6} {pct(deaths[(row, c)], td):>6}" for c in range(3)))


def storm(index, matches):
    print("\n## Storm deaths")
    for m in matches.values():
        dur = next(s["durationMs"] for s in index["matches"] if s["id"] == m["id"])
        for t, cat, u, v, _ in m["events"]:
            if cat == "storm":
                print(f"  {m['map']:13} t={t / 60000:4.1f} min of {dur / 60000:4.1f}  u={u / 100:5.1f}% v={v / 100:5.1f}%")


def timing(index, matches):
    print("\n## When players die and kill (minute of the match)")
    die, kill, loot_t = [], [], []
    for m in matches.values():
        for t, cat, *_ in m["events"]:
            if cat in DEATHS:
                die.append(t / 60000)
            elif cat in ("killBot", "killPlayer"):
                kill.append(t / 60000)
            elif cat == "loot":
                loot_t.append(t / 60000)
    for name, xs in (("deaths", die), ("kills", kill), ("loot", loot_t)):
        q = st.quantiles(xs, n=4)
        print(f"  {name}: n={len(xs)} quartiles {q[0]:.1f} / {q[1]:.1f} / {q[2]:.1f} min")
    surv = [s["durationMs"] / 60000 for s in index["matches"] if not any(s["events"].get(k) for k in DEATHS)]
    dead = [s["durationMs"] / 60000 for s in index["matches"] if any(s["events"].get(k) for k in DEATHS)]
    print(f"  match length: survived median {st.median(surv):.1f} min (n={len(surv)}), died median {st.median(dead):.1f} min (n={len(dead)})")


def days(index):
    print("\n## Matches per day")
    c = Counter(m["day"] for m in index["matches"])
    for d in sorted(c):
        maps = Counter(m["map"] for m in index["matches"] if m["day"] == d)
        print(f"  {d}: {c[d]} {dict(maps)}")


def players(index, matches):
    """Who plays, how often, and who comes back (PRODUCT.md). Days only: the data has no wall clock to order
    matches within a day."""
    print("\n## Players and return")
    by_id = {s["id"]: s for s in index["matches"]}
    plays = defaultdict(list)
    for m in matches.values():
        for i, p in enumerate(m["players"]):
            if p["bot"]:
                continue
            cats = Counter(e[1] for e in m["events"] if e[4] == i)
            end = "storm" if cats["storm"] else "bot" if cats["diedToBot"] else "player" if cats["diedToPlayer"] else "survived"
            plays[p["id"]].append((by_id[m["id"]]["day"], end))
    counts = [len(v) for v in plays.values()]
    once = [v[0] for v in plays.values() if len(v) == 1]
    repeat = [x for v in plays.values() if len(v) > 1 for x in v]
    print(f"humans {len(plays)}, matches per player median {st.median(counts)}, played once: {len(once)} ({pct(len(once), len(plays))})")
    print(f"died to a bot: in one-match players' only match {pct(sum(1 for x in once if x[1] == 'bot'), len(once))}, "
          f"in repeat players' matches {pct(sum(1 for x in repeat if x[1] == 'bot'), len(repeat))}")
    days = sorted({d for v in plays.values() for d, _ in v})
    for d0, d1 in zip(days, days[1:]):
        new = [u for u, v in plays.items() if min(d for d, _ in v) == d0]
        back = [u for u in new if any(d == d1 for d, _ in plays[u])]
        print(f"  {d0}: {len(new)} new players, back the next day {len(back)} ({pct(len(back), len(new))})")


if __name__ == "__main__":
    idx, ms = load()
    per_map(idx, ms)
    combat(idx)
    coverage(idx)
    quadrants(idx, ms)
    timing(idx, ms)
    days(idx)
    storm(idx, ms)
    players(idx, ms)
