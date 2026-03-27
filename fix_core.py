from pathlib import Path
import re

root = Path.home() / "sharat-raz"

# ===== FIX app.js =====
app = root / "app.js"
js = app.read_text(encoding="utf-8")

js = js.replace("\\n", "\n")

# הסרת כפילויות קריאות
js = re.sub(r'refreshStatus\(\);\s*refreshStatus\(\);', 'refreshStatus();', js)

# ===== FIX index.html =====
html_file = root / "index.html"
html = html_file.read_text(encoding="utf-8")

html = html.replace("\\n", "\n")

# תיקון textarea
html = re.sub(r'placeholder=\{.*?\}', 'placeholder="הכנס JSON תקין"', html)

html_file.write_text(html, encoding="utf-8")

# ===== CLEAN RULES =====
rules = root / "RULES.md"
t = rules.read_text(encoding="utf-8")

t = re.sub(r'58%|99%', '88%', t)

rules.write_text(t, encoding="utf-8")

print("CORE_FIXED")
