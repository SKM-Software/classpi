#!/usr/bin/env python3
"""Generate the ClassPi boot splash PNG."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

W, H = 1920, 1080
BG, BG2 = (14, 19, 32), (27, 36, 57)
ACCENT, ACCENT2, MUTED = (79, 209, 165), (91, 157, 255), (154, 167, 194)
OUT = Path(__file__).resolve().parent / "splash.png"


def font(size, bold=True):
    for name in (
        "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# soft radial-ish glow top-left
for r in range(700, 0, -8):
    a = r / 700
    col = tuple(int(BG[i] + (BG2[i] - BG[i]) * (1 - a) * 0.7) for i in range(3))
    d.ellipse([W * 0.15 - r, -120 - r, W * 0.15 + r, -120 + r], fill=col)

cx, cy = W // 2, H // 2

# logo tile with </>
tile = 150
tx0, ty0 = cx - tile // 2, cy - 190
d.rounded_rectangle([tx0, ty0, tx0 + tile, ty0 + tile], radius=34, fill=ACCENT)
lf = font(84)
d.text((tx0 + tile / 2, ty0 + tile / 2), "</>", font=lf, fill=(11, 26, 42), anchor="mm")

# wordmark
d.text((cx, cy + 40), "ClassPi", font=font(120), fill=(238, 242, 250), anchor="mm")
d.text((cx, cy + 140), "Computing Science", font=font(44, bold=False), fill=MUTED, anchor="mm")

# accent underline
d.rounded_rectangle([cx - 140, cy + 200, cx + 140, cy + 208], radius=4, fill=ACCENT2)

img.save(OUT)
print("wrote", OUT, img.size)
