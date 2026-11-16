#!/usr/bin/env python3
"""
دریافت متن کامل قرآن (رسم عثمانی) همراه با شماره‌ی جزء و صفحه‌ی مصحف
و ذخیره در app/src/main/assets/quran.json تا اپ کاملاً آفلاین باشد.

اجرا (روی کامپیوتر شما، با اینترنت):
    python3 tools/fetch_quran.py

منبع: https://api.alquran.cloud  (ویرایش quran-uthmani)

برای آزمایش با فایل محلی:
    python3 tools/fetch_quran.py --input my_quran.json
"""
import argparse
import json
import os
import sys
import urllib.request

URL = "https://api.alquran.cloud/v1/quran/quran-uthmani"

# تعداد آیات هر سوره (برای اعتبارسنجی داده‌ی دریافتی)
AYAH_COUNTS = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
    54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
    14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
    29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
    11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
]


def validate(raw):
    surahs = (raw.get("data") or {}).get("surahs") or raw.get("surahs")
    if not surahs:
        raise ValueError("ساختار JSON نامعتبر است (surahs پیدا نشد)")
    if len(surahs) != 114:
        raise ValueError(f"تعداد سوره‌ها {len(surahs)} است، باید ۱۱۴ باشد")
    total = 0
    pages = set()
    juzs = set()
    for idx, s in enumerate(surahs):
        ayahs = s.get("ayahs") or []
        if len(ayahs) != AYAH_COUNTS[idx]:
            raise ValueError(
                f"سوره‌ی {idx + 1}: {len(ayahs)} آیه، انتظار {AYAH_COUNTS[idx]}"
            )
        for a in ayahs:
            if not a.get("text") or "page" not in a or "juz" not in a:
                raise ValueError(f"آیه‌ی ناقص در سوره‌ی {idx + 1}")
            pages.add(a["page"])
            juzs.add(a["juz"])
        total += len(ayahs)
    if total != 6236:
        raise ValueError(f"مجموع آیات {total} است، باید ۶۲۳۶ باشد")
    if pages != set(range(1, 605)):
        raise ValueError("صفحه‌ها باید دقیقاً ۱ تا ۶۰۴ باشند")
    if juzs != set(range(1, 31)):
        raise ValueError("جزءها باید دقیقاً ۱ تا ۳۰ باشند")
    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", help="به‌جای دانلود، از این فایل JSON بخوان")
    ap.add_argument("--output", help="مسیر فایل خروجی")
    args = ap.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = args.output or os.path.join(root, "app", "src", "main", "assets", "quran.json")

    if args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            raw = json.load(f)
    else:
        print("در حال دریافت از", URL)
        req = urllib.request.Request(URL, headers={"User-Agent": "QuranApp-fetch/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = json.loads(r.read().decode("utf-8"))

    total = validate(raw)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False, separators=(",", ":"))
    print(f"✔ {total} آیه، ۱۱۴ سوره، ۶۰۴ صفحه، ۳۰ جزء ذخیره شد: {out}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print("خطا:", e, file=sys.stderr)
        sys.exit(1)
