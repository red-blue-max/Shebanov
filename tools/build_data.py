"""Синхронизация данных после правки data/coach.json.

Запуск из папки site/:  python tools/build_data.py
1. Пишет assets/js/data.js (копия JSON, чтобы сайт открывался по file:// без сервера).
2. Обновляет микроразметку FAQPage в index.html (только вопросы с готовыми ответами).
"""
import json
import re
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent


def main():
    data = json.loads((SITE / "data" / "coach.json").read_text(encoding="utf-8"))

    js = "window.COACH_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
    (SITE / "assets" / "js" / "data.js").write_text(js, encoding="utf-8")

    faq = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}}
            for f in data["faq"]
            if f.get("a")
        ],
    }
    block = (
        "<!-- FAQ_JSONLD_START -->\n"
        '<script type="application/ld+json">\n'
        + json.dumps(faq, ensure_ascii=False, indent=1)
        + "\n</script>\n<!-- FAQ_JSONLD_END -->"
    )
    index = SITE / "index.html"
    html = index.read_text(encoding="utf-8")
    html, n = re.subn(r"<!-- FAQ_JSONLD_START -->.*?<!-- FAQ_JSONLD_END -->", lambda _: block, html, flags=re.S)
    index.write_text(html, encoding="utf-8")
    print(f"data.js обновлён; FAQ-разметка: {'обновлена' if n else 'маркеры не найдены'}")


if __name__ == "__main__":
    main()
