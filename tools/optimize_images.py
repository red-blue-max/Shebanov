"""Оптимизация фото для сайта: webp + jpg, ширины 480/800/1200/1600 (не больше исходной).

Запуск из папки site/:  python tools/optimize_images.py
Исходники читаются из родительской папки, оригиналы не изменяются.
"""
import json
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

SITE = Path(__file__).resolve().parent.parent
SRC = SITE.parent
EDITED = SRC / "photos_edited"
OUT = SITE / "assets" / "img"
WIDTHS = [480, 800, 1200, 1600]

# key: (исходник, кроп (l, t, r, b) или None, зоны размытия [(l, t, r, b)])
IMAGES = {
    "hero-coach": (EDITED / "Generated Image October 17, 2026 - 3_13AM (1).jpg", None, []),
    "coach-team": (EDITED / "Generated Image October 17, 2026 - 3_19AM.jpg", None, []),
    # портреты на стене размыты, кадр обрезан выше обуви
    "coach-award": (
        EDITED / "Generated Image October 17, 2026 - 3_41AM.jpg",
        (0, 0, 896, 820),
        [(290, 160, 398, 320), (660, 168, 798, 342)],
    ),
    "result-1": (EDITED / "Generated Image October 17, 2026 - 2_43AM.jpg", None, []),
    "result-2": (EDITED / "Generated Image October 16, 2026 - 6_10PM.jpg", None, []),
    "result-3": (EDITED / "Generated Image October 17, 2026 - 3_08AM.jpg", None, []),
    "result-4": (SRC / "photo_5368336124025182929_y.jpg", None, []),
    "result-5": (SRC / "photo_5368336124025182931_y.jpg", None, []),
    "gallery-team": (EDITED / "Generated Image October 16, 2026 - 6_08PM.jpg", None, []),
    "gallery-girls": (EDITED / "Generated Image October 16, 2026 - 6_03PM.jpg", None, []),
    "gallery-group": (SRC / "photo_5368336124025182910_w.jpg", None, []),
    "gallery-medal": (SRC / "photo_5368336124025182933_y.jpg", None, []),
}


def load(path, crop, blurs):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    for box in blurs:
        region = im.crop(box).filter(ImageFilter.GaussianBlur(18))
        im.paste(region, box)
    if crop:
        im = im.crop(crop)
    return im


def save_set(key, im):
    sizes = [w for w in WIDTHS if w < im.width] + [im.width]
    sizes = sorted(set(min(w, 1600) for w in sizes))
    out = []
    for w in sizes:
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        r.save(OUT / f"{key}-{w}.webp", "WEBP", quality=76, method=6)
        r.save(OUT / f"{key}-{w}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
        out.append({"w": w, "h": h})
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for key, (path, crop, blurs) in IMAGES.items():
        manifest[key] = save_set(key, load(path, crop, blurs))

    # Обложка Open Graph 1200×630 из группового фото
    team = load(EDITED / "Generated Image October 16, 2026 - 6_08PM.jpg", (0, 200, 1195, 827), [])
    team.resize((1200, 630), Image.LANCZOS).save(OUT / "og-cover.jpg", "JPEG", quality=82, optimize=True)

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    for f in sorted(OUT.glob("*")):
        print(f"{f.name:32} {f.stat().st_size // 1024:5} KB")


if __name__ == "__main__":
    main()
