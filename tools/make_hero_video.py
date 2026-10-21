"""Сборка фонового видео hero из папки «Нарезка видео».

Запуск из папки site/:  python tools/make_hero_video.py
Нужен ffmpeg с zscale/tonemap (берётся из пакета imageio-ffmpeg).
Результат: assets/video/hero-1080.mp4, hero-720.mp4, hero-poster.webp, hero-poster-720.webp.
Промежуточные файлы — в ../video_hero/build/ (оригиналы не трогаются).
"""
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
SITE = Path(__file__).resolve().parent.parent
SRC = SITE.parent / "Нарезка видео"
BUILD = SITE.parent / "video_hero" / "build"
OUT = SITE / "assets" / "video"

# HDR HLG (iPhone) -> SDR bt709
TONEMAP = ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,"
           "tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p")

# Планы: файл, начало, конец (сек исходника), скорость (<1 — замедление), HDR,
# кадр (crop "w:h:x:y" в исходных пикселях после автоповорота или None), зеркало.
# m — устаревший параметр (центр вертикального кадра), не используется.
SHOTS = [
    # старт: присед на тумбе и прыжок (замедление), пловец сдвинут вправо
    dict(f="IMG_0222.MOV", ss=3.0, to=4.2, speed=1.0, hdr=True, crop="2400:1350:0:405", m=0.70),
    dict(f="IMG_0222.MOV", ss=4.2, to=5.8, speed=0.5, hdr=True, crop="2880:1620:450:270", m=0.70),
    # подводное скольжение (лёгкое приближение со сдвигом пловца вправо)
    dict(f="20220525_120523.mp4", ss=12.8, to=15.0, speed=0.6, crop="1670:940:0:70", m=0.42),
    # сверху под водой, тело целиком, руки в стороны; пловец в правой половине
    dict(f="IMG_0238.MOV", ss=75.5, to=79.5, speed=1.0, m=0.62),
    # подводный кроль сбоку
    dict(f="20220525_120821.mp4", ss=13.0, to=15.2, speed=0.7, crop="1670:940:0:70", m=0.55),
    # брасс сверху под водой (зеркально, чтобы пловец был справа)
    dict(f="IMG_0238.MOV", ss=27.0, to=30.0, speed=1.0, flip=True, m=0.62),
    # подплыв на камеру под водой (зеркально)
    dict(f="IMG_0257.MOV", ss=77.0, to=79.8, speed=1.0, flip=True, m=0.57),
]

X264 = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-color_primaries", "bt709",
        "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv"]


def run(args):
    subprocess.run([FF, "-v", "error", "-y", *args], check=True)


def shot_filter(s):
    parts = []
    if s.get("hdr"):
        parts.append(TONEMAP)
    if s.get("crop"):
        parts.append("crop=" + s["crop"])
    if s.get("flip"):
        parts.append("hflip")
    parts.append("scale=1920:1080:flags=lanczos")
    parts.append(f"setpts=PTS/{s['speed']}")
    parts.append("fps=30")
    return ",".join(parts)


def main():
    BUILD.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    desk = []
    # --concat-only: планы не перекодируются, берутся готовые из build/
    only_concat = "--concat-only" in sys.argv
    for i, s in enumerate(SHOTS):
        src = str(SRC / s["f"])
        d = BUILD / f"shot{i}.mp4"
        if only_concat and d.exists():
            desk.append(d)
            continue
        run(["-ss", str(s["ss"]), "-to", str(s["to"]), "-i", src, "-an",
             "-vf", shot_filter(s), *X264, "-preset", "slow", "-crf", "12", str(d)])
        desk.append(d)
        print("shot", i, "ok")

    lst = BUILD / "list.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in desk), encoding="utf-8")
    # компьютер 1920×1080 и телефон/планшет 1280×720 (горизонтальная, работает в обеих ориентациях).
    # Два прохода x264 veryslow с целевым битрейтом: при том же качестве на глаз файл на ~25 % меньше,
    # чем однопроходный CRF (проверено по SSIM и покадрово, 21.10.2026).
    for name, scale, kbps in (("hero-1080.mp4", None, 5500), ("hero-720.mp4", "1280:720", 1800)):
        vf = ["-vf", f"scale={scale}:flags=lanczos"] if scale else []
        log = str(BUILD / (name + ".2pass"))
        base = ["-f", "concat", "-safe", "0", "-i", str(lst), "-an", *vf, *X264, "-preset", "veryslow",
                "-b:v", f"{kbps}k", "-maxrate", f"{int(kbps * 1.6)}k", "-bufsize", f"{kbps * 3}k",
                "-profile:v", "high", "-x264-params", "aq-mode=3:aq-strength=0.9", "-passlogfile", log]
        run([*base, "-pass", "1", "-f", "null", "NUL" if sys.platform == "win32" else "/dev/null"])
        run([*base, "-pass", "2", "-movflags", "+faststart", str(OUT / name)])
        print(name, (OUT / name).stat().st_size // 1024, "KB")

    # Постеры — первый кадр, WebP (легче JPG в 2–2,5 раза)
    run(["-i", str(OUT / "hero-1080.mp4"), "-frames:v", "1", "-c:v", "libwebp", "-quality", "70", str(OUT / "hero-poster.webp")])
    run(["-i", str(OUT / "hero-720.mp4"), "-frames:v", "1", "-c:v", "libwebp", "-quality", "70", str(OUT / "hero-poster-720.webp")])
    print("Готово. Запустите python tools/build.py, чтобы обновить версии файлов в index.html")


if __name__ == "__main__":
    main()
