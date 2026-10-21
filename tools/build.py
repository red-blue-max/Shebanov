"""Сборка сайта для быстрой загрузки. Запускать после любой правки CSS, JS или data/coach.json.

Запуск из папки site/:  python tools/build.py
Нужен Node.js (минификатор esbuild скачивается через npx при первом запуске).

Что делает:
1. CSS: assets/css/fonts.css + style.css -> сжатый assets/css/site.min.css (для privacy.html)
   и тот же CSS встраивается прямо в index.html (без лишнего запроса до первого показа).
2. JS: assets/js/main.js -> сжатый assets/js/main.min.js; в index.html ставится ?v=<хэш>,
   чтобы после правок браузеры брали новую версию, а до правок — из кэша.
3. Данные: data/coach.json встраивается в index.html (<script id="coach-data">), отдельного запроса нет.
4. Разметка FAQPage (schema.org) в index.html обновляется из coach.json.
5. К ссылкам на видео и обложки в index.html дописывается ?v=<хэш файла> (долгий кэш без устаревших версий).
"""
import hashlib
import json
import re
import subprocess
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
ESBUILD = ["npx", "--yes", "esbuild@0.24.0"]


def esbuild(src: str, loader: str) -> str:
    res = subprocess.run([*ESBUILD, f"--loader={loader}", "--minify", "--charset=utf8", "--log-level=warning"],
                         input=src.encode("utf-8"), capture_output=True, check=True, shell=True)
    return res.stdout.decode("utf-8").strip()


def short_hash(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]


def replace_block(html: str, name: str, content: str) -> str:
    pattern = re.compile(rf"(<!-- {name}_START[^>]*-->).*?(<!-- {name}_END -->)", re.S)
    if not pattern.search(html):
        raise SystemExit(f"В index.html нет маркеров {name}_START / {name}_END")
    return pattern.sub(lambda m: m.group(1) + "\n" + content + "\n" + m.group(2), html)


def main():
    css_src = (SITE / "assets/css/fonts.css").read_text(encoding="utf-8") + "\n" + \
              (SITE / "assets/css/style.css").read_text(encoding="utf-8")
    css_min = esbuild(css_src, "css")
    (SITE / "assets/css/site.min.css").write_text(css_min, encoding="utf-8")
    css_inline = css_min.replace("url(../", "url(assets/").replace('url("../', 'url("assets/')

    js_min = esbuild((SITE / "assets/js/main.js").read_text(encoding="utf-8"), "js")
    (SITE / "assets/js/main.min.js").write_text(js_min, encoding="utf-8")

    data = json.loads((SITE / "data/coach.json").read_text(encoding="utf-8"))
    data_json = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}}
            for f in data["faq"] if f.get("a")
        ],
    }

    index = SITE / "index.html"
    html = index.read_text(encoding="utf-8")
    html = replace_block(html, "CSS", f"<style>{css_inline}</style>")
    html = replace_block(html, "DATA", f'<script type="application/json" id="coach-data">{data_json}</script>')
    html = replace_block(html, "JS", f'<script src="assets/js/main.min.js?v={short_hash(js_min)}" defer></script>')
    html = re.sub(r"<!-- FAQ_JSONLD_START -->.*?<!-- FAQ_JSONLD_END -->",
                  lambda _: "<!-- FAQ_JSONLD_START -->\n<script type=\"application/ld+json\">\n"
                            + json.dumps(faq, ensure_ascii=False, indent=1) + "\n</script>\n<!-- FAQ_JSONLD_END -->",
                  html, flags=re.S)
    # Видео и обложки: ?v=<хэш файла>, чтобы их можно было кэшировать надолго (см. vercel.json)
    def version_asset(m):
        path = SITE / m.group(1)
        if not path.exists():
            return m.group(0)
        return m.group(1) + "?v=" + hashlib.sha1(path.read_bytes()).hexdigest()[:8]
    html = re.sub(r"(assets/video/[\w.-]+\.(?:mp4|webp|jpg))(?:\?v=[0-9a-f]+)?", version_asset, html)
    index.write_text(html, encoding="utf-8")

    # privacy.html и 404.html подключают общий site.min.css — с версией по хэшу
    for name in ("privacy.html", "404.html"):
        page = SITE / name
        if not page.exists():
            continue
        p = page.read_text(encoding="utf-8")
        p = re.sub(r'<link rel="stylesheet" href="(/?)assets/css/site\.min\.css[^"]*">',
                   lambda m: f'<link rel="stylesheet" href="{m.group(1)}assets/css/site.min.css?v={short_hash(css_min)}">', p)
        page.write_text(p, encoding="utf-8")

    print(f"CSS {len(css_src) // 1024} КБ -> {len(css_min) // 1024} КБ (встроен в index.html)")
    print(f"JS  {len((SITE / 'assets/js/main.js').read_text(encoding='utf-8')) // 1024} КБ -> {len(js_min) // 1024} КБ")
    print(f"index.html: {len(html.encode('utf-8')) // 1024} КБ")


if __name__ == "__main__":
    main()
