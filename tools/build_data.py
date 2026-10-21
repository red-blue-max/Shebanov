"""Устаревшее имя. Всё делает tools/build.py (данные, CSS, JS). Оставлено для совместимости."""
import runpy
from pathlib import Path

runpy.run_path(str(Path(__file__).with_name("build.py")), run_name="__main__")
