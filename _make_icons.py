#!/usr/bin/env python3
# Generates the PWA icon set for DSNYBoy from dsnylogo.jpg (1400x781, landscape).
# Produces square PNGs on the game's theme background (#0a0d12):
#   - "any" icons: the logo contained inside ~90% of the canvas (fill most of the tile)
#   - "maskable" icons: the logo contained inside the safe zone (center ~55%) so the
#     browser's maskable circle never clips the artwork
#   - apple-touch-icon.png (180) for the iOS home screen
import os
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'dsnylogo.jpg')
BG = (10, 13, 18)          # #0a0d12 - matches the game background / theme_color

logo = Image.open(SRC).convert('RGB')
lw, lh = logo.size


def fit_into(box):
    """Resize the logo so it fits inside a box (pixels) preserving aspect, LANCZOS."""
    s = min(box / lw, box / lh)
    w = max(1, int(round(lw * s)))
    h = max(1, int(round(lh * s)))
    return logo.resize((w, h), Image.LANCZOS)


def make(size, content_frac):
    """Square tile of `size` px with the logo contained inside content_frac*size, centered."""
    canvas = Image.new('RGB', (size, size), BG)
    fitted = fit_into(int(round(size * content_frac)))
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.paste(fitted, (x, y))
    return canvas


def save(img, name):
    p = os.path.join(ROOT, name)
    img.save(p, 'PNG')
    kb = os.path.getsize(p) // 1024
    print('wrote %-22s %dx%d  %d KB' % (name, img.width, img.height, kb))


# "any" purpose: fill most of the tile (content ~90%)
for sz in (192, 512, 1024):
    save(make(sz, 0.90), 'icon-%d.png' % sz)

# "maskable" purpose: keep the artwork inside the safe zone (center ~55%)
for sz in (512, 1024):
    save(make(sz, 0.55), 'icon-maskable-%d.png' % sz)

# iOS home screen icon
save(make(180, 0.90), 'apple-touch-icon.png')

print('done')
