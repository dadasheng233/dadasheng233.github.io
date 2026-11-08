"""把《四级高频词汇》PDF 转成 content/words.json。

用法：
    python tools/ocr_vocab.py
    LIMIT=3 python tools/ocr_vocab.py     # 只跑前 3 页，调试用

依赖：pymupdf、rapidocr_onnxruntime、numpy。
这是导入工具，不参与网站构建。
"""
import json
import os
import re
import sys
import tempfile
from pathlib import Path

import pymupdf
from rapidocr_onnxruntime import RapidOCR

ROOT = Path(__file__).resolve().parent.parent
PDF = Path(r"D:\games\四级高频词汇（33页）.pdf")
OUT = Path(os.environ.get("OUT", ROOT / "content" / "words.json"))
REPORT = ROOT / "words_ocr_report.txt"
LIMIT = int(os.environ.get("LIMIT", "0") or 0)
SCALE = float(os.environ.get("SCALE", "3"))
ROW_TOLERANCE = 14

CJK = r"\u3400-\u9fff"
HEADER_RE = re.compile(r"^(第[一二三四五六七八九十百0-9]+章|英语四级|大学英语四级高频词汇)")
DAY_RE = re.compile(r"^DAY\s*(\d+)", re.I)
WORD_RE = re.compile(r"^([A-Za-z][A-Za-z'’./()\-]*(?:\s+[A-Za-z][A-Za-z'’./()\-]*){0,2})(.*)$")
LOW_CONF = []


def normalize(text):
    text = text.replace("\u00a0", " ").replace("\u3000", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def clean_word(word):
    word = word.strip().strip(".,;:，。；：")
    word = word.replace("’", "'")
    word = re.sub(r"\s+", " ", word)
    return word.lower()


def clean_meaning(meaning):
    meaning = meaning.strip()
    meaning = re.sub(r"^[0-9]+\s*", "", meaning)
    meaning = re.sub(r"\.{2,}[-·]?", "…", meaning)
    meaning = meaning.replace("‧", "；")
    meaning = meaning.replace("（使)", "（使）").replace("(使)", "（使）").replace("(使）", "（使）")
    meaning = meaning.replace("(上)", "（上）").replace("(to)", "（to）")
    meaning = meaning.replace("室息", "窒息")
    meaning = meaning.replace("收人", "收入")
    meaning = meaning.replace("揽绳", "缆绳")
    meaning = meaning.replace("挤人", "挤入")
    meaning = meaning.replace("图象", "图像")
    meaning = meaning.replace("」", "；").replace("「", "")
    meaning = re.sub(r"[；;]{2,}", "；", meaning)
    meaning = re.sub(r"\s+", " ", meaning)
    return meaning.strip(" ,;；")


def page_lines(result, width, height):
    lines = []
    for box, text, confidence in result or []:
        text = normalize(text)
        if not text:
            continue
        x = float(box[0][0])
        y = (float(box[0][1]) + float(box[2][1])) / 2
        if y > height * 0.92:
            continue
        if text.isdigit():
            continue
        if y < height * 0.12 and (HEADER_RE.search(text) or text in ("英语四级",)):
            continue
        if HEADER_RE.search(text):
            continue
        lines.append({"x": x, "y": y, "text": text, "confidence": float(confidence)})
        if confidence < 0.8:
            LOW_CONF.append((text, round(float(confidence), 3)))
    return lines


def rows_for_column(lines, width, column):
    middle = width / 2
    subset = [line for line in lines if (line["x"] < middle) == (column == 0)]
    subset.sort(key=lambda item: (item["y"], item["x"]))
    rows = []
    for line in subset:
        if rows and abs(line["y"] - rows[-1]["y"]) <= ROW_TOLERANCE:
            rows[-1]["parts"].append(line)
            rows[-1]["y"] = (rows[-1]["y"] * (len(rows[-1]["parts"]) - 1) + line["y"]) / len(rows[-1]["parts"])
        else:
            rows.append({"y": line["y"], "parts": [line]})
    for row in rows:
        row["parts"].sort(key=lambda item: item["x"])
        text = ""
        for part in row["parts"]:
            if text and re.search(r"[A-Za-z]$", text) and re.match(r"[A-Za-z]", part["text"]):
                text += " " + part["text"]
            else:
                text += part["text"]
        row["text"] = normalize(text)
    return sorted(rows, key=lambda item: item["y"])


def parse_pdf():
    document = pymupdf.open(PDF)
    engine = RapidOCR()
    entries = []
    seen = {}
    current_day = "DAY 1"
    current_chapter = "第一章"
    pages = min(document.page_count, LIMIT) if LIMIT else document.page_count

    with tempfile.TemporaryDirectory(prefix="vocab-ocr-") as temp:
        for page_index in range(pages):
            page = document[page_index]
            pix = page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE))
            image_path = Path(temp) / f"page-{page_index + 1}.png"
            pix.save(str(image_path))
            result, _ = engine(str(image_path))
            width, height = pix.width, pix.height
            lines = page_lines(result, width, height)

            for column in (0, 1):
                current = None
                for row in rows_for_column(lines, width, column):
                    text = row["text"]
                    if not text:
                        continue
                    day_match = DAY_RE.match(text)
                    if day_match:
                        current_day = f"DAY {day_match.group(1)}"
                        continue
                    chapter = re.search(r"第[一二三四五六七八九十百0-9]+章", text)
                    if chapter:
                        current_chapter = chapter.group(0)
                        continue
                    if HEADER_RE.search(text) or text == "英语四级":
                        continue
                    match = WORD_RE.match(text)
                    is_entry = False
                    word = ""
                    meaning = ""
                    if match:
                        word = clean_word(match.group(1))
                        meaning = clean_meaning(match.group(2))
                        is_entry = len(word) >= 2 and not DAY_RE.match(word)
                    if is_entry:
                        if word == "glimpse":
                            meaning = "一瞥"
                        if current and current["word"]:
                            entries.append(current)
                        current = {
                            "word": word,
                            "phonetic": "",
                            "pos": "",
                            "meaning": meaning,
                            "example": "",
                            "translation": "",
                            "tags": [current_day, current_chapter, "高频"],
                            "page": page_index + 1,
                        }
                    elif current:
                        current["meaning"] = clean_meaning(current["meaning"] + text)
                if current and current["word"]:
                    entries.append(current)

    for entry in entries:
        key = entry["word"]
        if key in seen:
            existing = seen[key]
            if entry["meaning"] and entry["meaning"] not in existing["meaning"]:
                existing["meaning"] = clean_meaning(existing["meaning"] + "；" + entry["meaning"])
            continue
        seen[key] = entry

    return list(seen.values())


def main():
    if not PDF.exists():
        raise SystemExit(f"PDF not found: {PDF}")
    words = parse_pdf()
    OUT.write_text(json.dumps(words, ensure_ascii=False, indent=2), encoding="utf-8")

    suspicious = []
    for item in words:
        if len(item["word"]) <= 2 and item["word"] not in ("ad", "AI", "ID"):
            suspicious.append(item["word"])
        if re.search(r"(.)\1$", item["word"]) and item["word"][-1] in "tlsn":
            suspicious.append(item["word"])

    report = [
        f"pages: {LIMIT or 33}",
        f"words: {len(words)}",
        f"low confidence lines: {len(LOW_CONF)}",
        f"suspicious words: {', '.join(sorted(set(suspicious)))}",
        "",
        "low confidence sample:",
        *[f"  {text} ({conf})" for text, conf in LOW_CONF[:80]],
        "",
        "first 20:",
        *[f"  {item['word']}  {item['meaning']}" for item in words[:20]],
    ]
    REPORT.write_text("\n".join(report), encoding="utf-8")
    print(f"wrote {len(words)} words to {OUT}")
    print(f"report: {REPORT}")


if __name__ == "__main__":
    main()
