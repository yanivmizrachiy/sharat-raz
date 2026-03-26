# sharat-raz

אפליקציית שליטה בעברית RTL לנייד, מבוססת PWA, מחוברת ל־GitHub ולמנוע ה־Termux הקיים.

## תפקידים
- `sharat-raz` = ממשק שליטה נייד
- `my-assistant` = תור פקודות וסנכרון
- `server-core` = מנוע ביצוע
- `n8n` = שכבת אינטגרציה ואוטומציה

## זרימה
אפליקציה → API מקומי ב־Termux → my-assistant/STATE/NEXT_COMMAND.json → listener → ביצוע → LAST_RESULT.json → אפליקציה

## עקרונות
- בלי לגעת במנוע הקיים
- בלי למחוק שום דבר
- RTL מלא
- כפתורים גדולים בעברית
- אייקון צהוב קבוע ל־PWA
