"""Готовит чистую копию сайта для загрузки на хостинг (Timeweb).

Запуск из папки site/:  python tools/package.py
1. Запускает сборку (tools/build.py).
2. Копирует в ../deploy/shebanov-swim.ru/ только то, что нужно сайту:
   страницы, .htaccess, robots.txt, sitemap.xml, favicon.ico, сжатые CSS/JS, шрифты,
   картинки и видео, на которые есть ссылки. Исходники, инструменты, заметки, скриншоты — не попадают.
3. Упаковывает это в ../deploy/shebanov-swim-site.zip — его и загружать на хостинг.
"""
import re
import runpy
import shutil
import zipfile
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
DEPLOY = SITE.parent / "deploy"
OUT = DEPLOY / "shebanov-swim.ru"
ZIP = DEPLOY / "shebanov-swim-site.zip"

PAGES = ["index.html", "privacy.html", "404.html", ".htaccess", "robots.txt", "sitemap.xml"]


def main():
    runpy.run_path(str(SITE / "tools" / "build.py"), run_name="__main__")

    # очищаем содержимое (саму папку не удаляем — она может быть открыта в проводнике)
    OUT.mkdir(parents=True, exist_ok=True)
    for p in OUT.iterdir():
        shutil.rmtree(p) if p.is_dir() else p.unlink()

    files = set(PAGES)
    files |= {"assets/css/site.min.css", "assets/js/main.min.js"}
    files |= {f"assets/fonts/{p.name}" for p in (SITE / "assets/fonts").glob("*.woff2")}

    # Картинки и видео — только те, на которые ссылаются страницы, CSS и данные
    text = "".join((SITE / f).read_text(encoding="utf-8") for f in ("index.html", "privacy.html", "404.html",
                                                                   "assets/css/site.min.css"))
    for folder in ("assets/img", "assets/video"):
        for p in (SITE / folder).glob("*"):
            if p.is_file() and p.name in text:
                files.add(f"{folder}/{p.name}")

    for rel in sorted(files):
        src = SITE / rel
        dst = OUT / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    # браузеры сами запрашивают /favicon.ico — кладём копию в корень, чтобы не было 404
    shutil.copy2(SITE / "assets/img/favicon.ico", OUT / "favicon.ico")

    # Проверка: все локальные ссылки из страниц ведут на существующие файлы
    missing = []
    for page in ("index.html", "privacy.html", "404.html"):
        html = (OUT / page).read_text(encoding="utf-8")
        for ref in re.findall(r'(?:href|src|srcset|data-[\w-]+)="([^"]+)"', html):
            for part in ref.split(","):
                url = part.strip().split(" ")[0].split("?")[0].split("#")[0]
                if not url or url.startswith(("http", "mailto:", "tel:", "data:")) or url in ("/", "index.html"):
                    continue
                if not re.search(r"\.(html|css|js|webp|jpg|jpeg|png|ico|svg|mp4|woff2|xml|txt)$", url):
                    continue  # не файл (data-bind, data-goal, размеры и т. п.)
                if not (OUT / url.lstrip("/")).exists():
                    missing.append(f"{page}: {url}")
    css = (OUT / "assets/css/site.min.css").read_text(encoding="utf-8")
    for url in re.findall(r'url\("?\.\./([^")]+)', css):
        if not (OUT / "assets" / url.split("?")[0]).exists():
            missing.append(f"site.min.css: ../{url}")

    if ZIP.exists():
        ZIP.unlink()
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(OUT.rglob("*")):
            if p.is_file():
                z.write(p, p.relative_to(OUT).as_posix())

    size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    print(f"Файлов: {sum(1 for p in OUT.rglob('*') if p.is_file())}, всего {size / 1024 / 1024:.1f} МБ")
    print(f"Папка: {OUT}")
    print(f"Архив: {ZIP} ({ZIP.stat().st_size / 1024 / 1024:.1f} МБ)")
    print("Битые ссылки:", missing or "нет")


if __name__ == "__main__":
    main()
