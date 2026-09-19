"""Post-processes the generated art into public/art.

Portraits: zero faint haze alpha, stretch the model's modal body alpha (254)
to 255, crop to the alpha bounding box padded by six percent, anchor above the
head, and write 256 and 128 pixel WebP files. Key art: write a JPEG at 1536x640.

    python scripts/art.py            everything in scripts/raw/art
    python scripts/art.py ilya       one portrait
"""

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "scripts" / "raw" / "art"
OUT = ROOT / "public" / "art"
PORTRAITS = ["ilya", "chen", "vale", "orlov"]
HAZE = 24


def portrait(name: str) -> None:
    src = RAW / f"{name}.png"
    if not src.exists():
        print(f"skip {name}: no raw file")
        return
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    # Haze below HAZE is cleared; the band up to 2*HAZE is scaled down; the body's 254 becomes 255.
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < HAZE:
                px[x, y] = (r, g, b, 0)
            elif a < 2 * HAZE:
                px[x, y] = (r, g, b, int((a - HAZE) * 255 / (2 * HAZE - HAZE) * 0.5))
            elif a >= 250:
                px[x, y] = (r, g, b, 255)
    bbox = im.getchannel("A").getbbox()
    if not bbox:
        print(f"skip {name}: empty alpha")
        return
    l, t, r, b = bbox
    bw, bh = r - l, b - t
    side = int(max(bw, bh) * 1.12)
    cx = (l + r) // 2
    top = max(0, t - int(side * 0.06))
    left = max(0, min(w - side, cx - side // 2))
    top = max(0, min(h - side, top))
    crop = im.crop((left, top, left + side, top + side))
    OUT.mkdir(parents=True, exist_ok=True)
    for size, suffix in ((256, ""), (128, "-128")):
        small = crop.resize((size, size), Image.LANCZOS)
        small.save(OUT / f"{name}{suffix}.webp", "WEBP", quality=92, method=6)
    print(f"{name}: bbox {bbox} side {side} -> 256 and 128")


def keyart() -> None:
    src = RAW / "keyart.png"
    if not src.exists():
        print("skip keyart: no raw file")
        return
    im = Image.open(src).convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    im.save(OUT / "keyart.jpg", "JPEG", quality=86, optimize=True, progressive=True)
    im.resize((768, 320), Image.LANCZOS).save(OUT / "keyart-768.jpg", "JPEG", quality=84, optimize=True)
    print(f"keyart: {im.size} -> keyart.jpg, keyart-768.jpg")


if __name__ == "__main__":
    targets = sys.argv[1:] or PORTRAITS + ["keyart"]
    for t in targets:
        if t == "keyart":
            keyart()
        else:
            portrait(t)
