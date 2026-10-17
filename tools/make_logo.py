"""Логотип из assets/img/src/logo-source.jpg: вырезает белый фон снаружи знака и сохраняет размеры.

Запуск из папки site/:  python tools/make_logo.py
"""
from PIL import Image, ImageChops, ImageDraw, ImageFilter

SRC = "assets/img/src/logo-source.jpg"
OUT = "assets/img/"


def cutout():
    im = Image.open(SRC).convert("RGB")
    w, h = im.size
    fill = im.convert("L").point(lambda v: 255 if v >= 236 else 0)
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(fill, xy, 128)
    outer = fill.point(lambda v: 255 if v == 128 else 0)
    alpha = ImageChops.invert(outer).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(alpha)
    l, t, r, b = alpha.point(lambda v: 255 if v > 40 else 0).getbbox()
    return im.crop((max(0, l - 4), max(0, t - 4), min(w, r + 4), min(h, b + 4)))


def square(logo, size, bg=(0, 0, 0, 0)):
    c = Image.new("RGBA", (size, size), bg)
    lh = int(size * 0.94)
    lw = round(logo.width * lh / logo.height)
    c.alpha_composite(logo.resize((lw, lh), Image.LANCZOS), ((size - lw) // 2, (size - lh) // 2))
    return c


def main():
    logo = cutout()
    logo.save(OUT + "src/logo-full.png")
    for h in (96, 192, 400):
        x = logo.resize((round(logo.width * h / logo.height), h), Image.LANCZOS)
        x.save(f"{OUT}logo-{h}.png", optimize=True)
        x.save(f"{OUT}logo-{h}.webp", quality=90, method=6)
    square(logo, 32).save(OUT + "favicon-32.png")
    square(logo, 48).save(OUT + "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    square(logo, 180, (255, 251, 242, 255)).convert("RGB").save(OUT + "apple-touch-icon.png")
    square(logo, 512).save(OUT + "logo-512.png", optimize=True)
    print("logo", logo.size)


if __name__ == "__main__":
    main()
