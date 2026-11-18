"""Charts and maps behind INSIGHTS.md and PRODUCT.md, from the processed files in public/data (no raw data needed).

Run: .venv/bin/python pipeline/figures.py   -> docs/figures/*.png
Colors: the first three categorical slots of a colorblind-validated palette (blue, orange, aqua), light surface.
Every chart sits next to a table of its numbers in the docs.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from matplotlib.colors import LinearSegmentedColormap  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
MINIMAPS = ROOT / "public" / "minimaps"
OUT = ROOT / "docs" / "figures"

SURFACE, INK, INK_2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3df"
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
DEATHS = {"diedToBot", "diedToPlayer", "storm"}
MAP_LABEL = {"AmbroseValley": "Ambrose Valley", "GrandRift": "Grand Rift", "Lockdown": "Lockdown"}

plt.rcParams.update({
    "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
    "axes.edgecolor": GRID, "axes.labelcolor": INK_2, "xtick.color": INK_2, "ytick.color": INK_2,
    "text.color": INK, "font.size": 11, "axes.titlesize": 13, "axes.titleweight": "bold", "axes.titlelocation": "left",
    "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8,
    "axes.axisbelow": True, "legend.frameon": False,
})


def load():
    index = json.loads((DATA / "index.json").read_text())
    matches = {m["id"]: json.loads((DATA / "matches" / f"{m['id']}.json").read_text()) for m in index["matches"]}
    return index, matches


def save(fig, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUT / f"{name}.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("wrote", OUT / f"{name}.png")


def bar_labels(ax, bars, fmt="{:,.0f}"):
    for b in bars:
        w = b.get_width()
        ax.annotate(fmt.format(w), (w, b.get_y() + b.get_height() / 2), xytext=(4, 0), textcoords="offset points",
                    va="center", color=INK_2, fontsize=10)


def human_events(matches):
    """(map, minute, category, u, v) for every event emitted by a human."""
    for m in matches.values():
        for t, cat, u, v, i in m["events"]:
            if not m["players"][i]["bot"]:
                yield m["map"], t / 60000, cat, u, v


# --- Insight 1: the storm is a clock -------------------------------------------------------------------------------

def storm_timing(index, matches):
    by_min = {"diedToBot": Counter(), "storm": Counter()}
    for _, minute, cat, *_ in human_events(matches):
        if cat in by_min:
            by_min[cat][int(minute)] += 1
    minutes = list(range(16))
    fig, ax = plt.subplots(figsize=(9, 3.6))
    bots = [by_min["diedToBot"][m] for m in minutes]
    storm = [by_min["storm"][m] for m in minutes]
    ax.bar([m + 0.5 for m in minutes], bots, width=0.8, color=BLUE, label="Killed by a bot", edgecolor=SURFACE, linewidth=1)
    ax.bar([m + 0.5 for m in minutes], storm, width=0.8, bottom=bots, color=ORANGE, label="Died to the storm", edgecolor=SURFACE, linewidth=1)
    ax.set_xlim(0, 16)
    ax.set_xticks(range(0, 17, 2))
    ax.set_xlabel("Minute of the match")
    ax.set_ylabel("Player deaths")
    ax.set_title("When players die: the storm only kills after minute 10.9")
    ax.legend(loc="upper right")
    ax.grid(axis="x", visible=False)
    save(fig, "storm_timing")


def minimap(map_id, ax):
    img = Image.open(MINIMAPS / f"{map_id}.jpg").convert("RGB").resize((768, 768))
    ax.imshow(img, extent=(0, 1, 0, 1))
    ax.imshow([[0]], extent=(0, 1, 0, 1), cmap=LinearSegmentedColormap.from_list("d", ["#000000", "#000000"]), alpha=0.35)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")


def storm_map(index, matches):
    fig, axes = plt.subplots(1, 3, figsize=(12, 4.4))
    pts = defaultdict(list)
    for map_id, _, cat, u, v in human_events(matches):
        if cat == "storm":
            pts[map_id].append((u / 1e4, v / 1e4))
    for ax, map_id in zip(axes, MAP_LABEL):
        minimap(map_id, ax)
        xs, ys = zip(*pts[map_id]) if pts[map_id] else ([], [])
        ax.scatter(xs, ys, s=70, color=ORANGE, edgecolor="white", linewidth=1.5, zorder=3)
        ax.set_title(f"{MAP_LABEL[map_id]}: {len(pts[map_id])} storm deaths", fontsize=12)
    fig.suptitle("Storm deaths are spread across each map, not piled at one edge", x=0.01, ha="left", fontweight="bold")
    save(fig, "storm_map")


# --- Insight 2: bots make every fight ------------------------------------------------------------------------------

def combat(index, matches):
    ev = Counter()
    for m in index["matches"]:
        ev.update(m["events"])
    fig, (a, b) = plt.subplots(1, 2, figsize=(11, 2.8))
    bars = a.barh(["Other players", "Bots"], [ev["killPlayer"], ev["killBot"]], color=BLUE, height=0.55)
    bar_labels(a, bars)
    a.set_title("Who players kill")
    a.set_xlim(0, ev["killBot"] * 1.18)
    bars = b.barh(["Other players", "The storm", "Bots"], [ev["diedToPlayer"], ev["storm"], ev["diedToBot"]], color=BLUE, height=0.55)
    bar_labels(b, bars)
    b.set_title("What kills players")
    b.set_xlim(0, ev["diedToBot"] * 1.18)
    for ax in (a, b):
        ax.grid(axis="y", visible=False)
    save(fig, "combat")


# --- Insight 3: Ambrose Valley risk and reward ---------------------------------------------------------------------

def ambrose_regions(index, matches):
    units = index["uvUnits"]
    region = lambda u, v: (min(2, (units - v) * 3 // units), min(2, u * 3 // units))  # noqa: E731
    traffic, loot, deaths = Counter(), Counter(), Counter()
    for m in matches.values():
        if m["map"] != "AmbroseValley":
            continue
        for p in m["players"]:
            if not p["bot"]:
                for i in range(0, len(p["path"]), 3):
                    traffic[region(p["path"][i + 1], p["path"][i + 2])] += 1
        for t, cat, u, v, i in m["events"]:
            if m["players"][i]["bot"]:
                continue
            if cat == "loot":
                loot[region(u, v)] += 1
            elif cat in DEATHS:
                deaths[region(u, v)] += 1
    share = lambda c, k: 100 * c[k] / sum(c.values())  # noqa: E731
    picked = [("Center", (1, 1)), ("South-center", (2, 1)), ("West-center", (1, 0))]
    fig, (m_ax, ax) = plt.subplots(1, 2, figsize=(12, 5), gridspec_kw={"width_ratios": [1, 1.3]})
    minimap("AmbroseValley", m_ax)
    for k in (1 / 3, 2 / 3):
        m_ax.axhline(k, color="white", lw=1.2, alpha=0.8)
        m_ax.axvline(k, color="white", lw=1.2, alpha=0.8)
    for name, (row, col) in picked:
        m_ax.text((col + 0.5) / 3, 1 - (row + 0.5) / 3, name, ha="center", va="center", color="white", fontsize=11,
                  fontweight="bold", bbox={"boxstyle": "round,pad=0.3", "fc": "#000000", "ec": "none", "alpha": 0.55})
    m_ax.set_title("Ambrose Valley in 3 x 3 regions")
    names = [n for n, _ in picked]
    x = range(len(picked))
    w = 0.26
    series = [("Time spent", traffic, BLUE), ("Loot picked up", loot, ORANGE), ("Deaths", deaths, AQUA)]
    for j, (label, c, color) in enumerate(series):
        vals = [share(c, k) for _, k in picked]
        bars = ax.bar([i + (j - 1) * w for i in x], vals, width=w - 0.02, color=color, label=label)
        for b_, v in zip(bars, vals):
            ax.annotate(f"{v:.0f}%", (b_.get_x() + b_.get_width() / 2, v), xytext=(0, 3), textcoords="offset points",
                        ha="center", color=INK_2, fontsize=9)
    ax.set_xticks(list(x), names)
    ax.set_ylabel("Share of the map's total (%)")
    ax.set_title(f"The center takes {share(deaths, (1, 1)):.0f}% of deaths for {share(traffic, (1, 1)):.0f}% of the time")
    ax.legend(loc="upper right")
    ax.grid(axis="x", visible=False)
    save(fig, "ambrose_regions")


def heat_grid(map_id, layers):
    heat = json.loads((DATA / "heat" / f"{map_id}.json").read_text())
    g = heat["grid"]
    grid = [[0.0] * g for _ in range(g)]
    for layer in layers:
        for flat in heat["layers"][layer].values():
            for i in range(0, len(flat), 2):
                grid[flat[i] // g][flat[i] % g] += flat[i + 1]
    return grid


def ambrose_heat(index, matches):
    import numpy as np

    def smooth(grid):
        a = np.array(grid, dtype=float)
        k = np.array([1, 4, 6, 4, 1], dtype=float)
        k /= k.sum()
        for axis in (0, 1):
            a = np.apply_along_axis(lambda r: np.convolve(r, k, mode="same"), axis, a)
        top = np.percentile(a[a > 0], 98)
        return np.sqrt(np.clip(a / top, 0, 1))

    fig, axes = plt.subplots(1, 2, figsize=(11, 5.6))
    for ax, (title, layers, color) in zip(axes, [("Where players kill", ["killsBot", "killsPlayer"], "#e34948"), ("Where players loot", ["loot"], "#eda100")]):
        minimap("AmbroseValley", ax)
        a = smooth(heat_grid("AmbroseValley", layers))
        # Upsample 8x with the same smooth kernel, then color with opacity = intensity: no visible cells.
        a = np.kron(a, np.ones((8, 8)))
        k = np.ones(9) / 9
        for axis in (0, 1):
            a = np.apply_along_axis(lambda r: np.convolve(r, k, mode="same"), axis, a)
        rgb = matplotlib.colors.to_rgb(color)
        rgba = np.zeros((*a.shape, 4))
        rgba[..., :3] = rgb
        rgba[..., 3] = np.clip((a - 0.12) / 0.88, 0, 1) * 0.95
        ax.imshow(rgba, extent=(0, 1, 0, 1), interpolation="bilinear")
        ax.set_title(title)
    fig.suptitle("Ambrose Valley: fights pile into the center, loot is spread out", x=0.01, ha="left", fontweight="bold")
    save(fig, "ambrose_heat")


# --- Players: who comes back ---------------------------------------------------------------------------------------

def player_plays(index, matches):
    by_id = {s["id"]: s for s in index["matches"]}
    plays = defaultdict(list)
    for m in matches.values():
        for i, p in enumerate(m["players"]):
            if p["bot"]:
                continue
            cats = Counter(e[1] for e in m["events"] if e[4] == i)
            plays[p["id"]].append((by_id[m["id"]]["day"], "bot" if cats["diedToBot"] else "other"))
    return plays


def players(index, matches):
    plays = player_plays(index, matches)
    buckets = [("1", 1, 1), ("2", 2, 2), ("3-5", 3, 5), ("6-10", 6, 10), ("11+", 11, 10**6)]
    counts = [sum(1 for v in plays.values() if lo <= len(v) <= hi) for _, lo, hi in buckets]
    once = [v[0] for v in plays.values() if len(v) == 1]
    repeat = [x for v in plays.values() if len(v) > 1 for x in v]
    bot_once = 100 * sum(1 for x in once if x[1] == "bot") / len(once)
    bot_repeat = 100 * sum(1 for x in repeat if x[1] == "bot") / len(repeat)

    fig, (a, b) = plt.subplots(1, 2, figsize=(12, 3.8), gridspec_kw={"width_ratios": [1.2, 1], "wspace": 0.45})
    bars = a.bar([n for n, *_ in buckets], counts, color=BLUE, width=0.6)
    for b_, c in zip(bars, counts):
        a.annotate(str(c), (b_.get_x() + b_.get_width() / 2, c), xytext=(0, 3), textcoords="offset points", ha="center", color=INK_2)
    a.set_ylim(0, max(counts) * 1.15)
    a.set_xlabel("Matches played in 5 days")
    a.set_ylabel("Players")
    a.set_title(f"{counts[0]} of {len(plays)} players ({100 * counts[0] / len(plays):.0f}%) played once")
    a.grid(axis="x", visible=False)

    bars = b.barh(["Came back\n(all matches)", "Played once\n(only match)"], [bot_repeat, bot_once], color=BLUE, height=0.5)
    bar_labels(b, bars, "{:.1f}%")
    b.set_xlim(0, 80)
    b.set_xlabel("Matches ending in a death to a bot (%)")
    b.set_title("Died to a bot")
    b.grid(axis="y", visible=False)
    save(fig, "players")

    days = sorted({d for v in plays.values() for d, _ in v})
    new, back = [], []
    for d0, d1 in zip(days, days[1:]):
        cohort = [u for u, v in plays.items() if min(d for d, _ in v) == d0]
        new.append(len(cohort))
        back.append(sum(1 for u in cohort if any(d == d1 for d, _ in plays[u])))
    labels = [f"Feb {int(d[-2:])}" for d in days[:-1]]
    fig, ax = plt.subplots(figsize=(9, 3.4))
    bars = ax.bar(labels, new, color=GRID, width=0.6, label="New players that day")
    ax.bar(labels, back, color=BLUE, width=0.6, label="Of them, back the next day")
    for b_, n, k in zip(bars, new, back):
        ax.annotate(f"{100 * k / n:.0f}% back", (b_.get_x() + b_.get_width() / 2, n), xytext=(0, 3), textcoords="offset points", ha="center", color=INK_2, fontsize=10)
    ax.set_ylim(0, max(new) * 1.18)
    ax.set_ylabel("Players")
    ax.set_title("New players each day, and how many came back the next day")
    ax.legend(loc="upper right")
    ax.grid(axis="x", visible=False)
    save(fig, "return")


if __name__ == "__main__":
    idx, ms = load()
    storm_timing(idx, ms)
    storm_map(idx, ms)
    combat(idx, ms)
    ambrose_regions(idx, ms)
    ambrose_heat(idx, ms)
    players(idx, ms)
