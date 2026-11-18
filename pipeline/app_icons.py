"""App icons for the installable app (public/app/): the kill icon (a skull over crossed bones) on the tool's dark
background. Run once: .venv/bin/python pipeline/app_icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "app"
BG = (14, 15, 18)
RED = (229, 72, 77)
INK = (17, 17, 17)


def icon(size: int, maskable: bool) -> Image.Image:
    k = 4  # drawn 4x larger, then downscaled: smooth edges
    s = size * k
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)
    r = s * (0.24 if maskable else 0.29)  # maskable icons keep their art inside the middle 80%
    c = s / 2
    a = r * 1.05
    w = int(r * 0.34)
    kr = w * 0.62
    for x0, y0, x1, y1 in ((c - a, c - a, c + a, c + a), (c + a, c - a, c - a, c + a)):
        d.line((x0, y0, x1, y1), fill=RED, width=w)
    for x, y in ((c - a, c - a), (c + a, c + a), (c + a, c - a), (c - a, c + a)):
        nx = -0.7 if (x - c) * (y - c) > 0 else 0.7
        for sgn in (1, -1):
            px, py = x + sgn * nx * kr, y + sgn * 0.7 * kr
            d.ellipse((px - kr, py - kr, px + kr, py + kr), fill=RED)
    sr = r * 0.72
    d.ellipse((c - sr, c - sr, c + sr, c + sr), fill=RED, outline=INK, width=max(2, int(s / 120)))
    er = sr / 3.6
    for ex in (c - sr / 2.6, c + sr / 2.6):
        ey = c - sr / 6
        d.ellipse((ex - er, ey - er, ex + er, ey + er), fill=INK)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        icon(size, False).save(OUT / f"icon-{size}.png", optimize=True)
        icon(size, True).save(OUT / f"maskable-{size}.png", optimize=True)
    icon(180, False).save(OUT / "apple-touch-icon.png", optimize=True)
    icon(32, False).save(OUT / "favicon-32.png", optimize=True)
    print("wrote", sorted(p.name for p in OUT.iterdir()))
