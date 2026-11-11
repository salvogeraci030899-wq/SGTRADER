#!/usr/bin/env python3
"""Aggiorna in un colpo solo la versione dell'app in index.html.

Uso:  python3 tools/bump_version.py          -> versione attuale + 1
      python3 tools/bump_version.py 50       -> imposta la versione 50

Aggiorna:
- <meta name="app-version"> (mostrata nella Home, card Stato Sistema)
- style.css?v=N e src/main.js?v=N
- la import map tra i marcatori importmap:start / importmap:end, rigenerata con TUTTI i moduli
  in src/, ognuno con ?v=N. Così a ogni rilascio il browser (e la PWA su iOS) scarica di nuovo
  ogni modulo, non solo main.js: senza versione i moduli importati restano in cache.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"

html = INDEX.read_text(encoding="utf-8")
current = int(re.search(r'<meta name="app-version" content="(\d+)">', html).group(1))
version = int(sys.argv[1]) if len(sys.argv) > 1 else current + 1

# Tutti i moduli dell'app più la logica dei comandi condivisa con il server (api/_core.js)
modules = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / "src").rglob("*.js")) + ["api/_core.js"]
imports = {f"./{m}": f"./{m}?v={version}" for m in modules}
block = (
    "<!-- importmap:start (generata da tools/bump_version.py, non modificare a mano) -->\n"
    '    <script type="importmap">\n'
    + "\n".join("    " + line for line in json.dumps({"imports": imports}, indent=4).splitlines())
    + "\n    </script>\n"
    "    <!-- importmap:end -->"
)

html, n = re.subn(r"<!-- importmap:start.*?<!-- importmap:end -->", block, html, flags=re.S)
assert n == 1, "marcatori della import map non trovati"
html = re.sub(r'<meta name="app-version" content="\d+">', f'<meta name="app-version" content="{version}">', html)
html = re.sub(r"style\.css\?v=\d+", f"style.css?v={version}", html)
html = re.sub(r"src/main\.js\?v=\d+", f"src/main.js?v={version}", html)
INDEX.write_text(html, encoding="utf-8")
print(f"Versione {current} -> {version} ({len(modules)} moduli nella import map)")
