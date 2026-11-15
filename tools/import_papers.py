"""把下载来的四级真题 PDF 归档进 theme/assets/papers/<YYYY-MM>/setN-paper.pdf。

用法：
    python tools/import_papers.py "C:\\Users\\...\\四级真题+答案+听力（2025.06-2015.06）"
    python tools/import_papers.py <源目录> --dry-run

规则：
- 只收「真题」PDF，跳过解析 / 答案 / 听力音频目录
- 年份、月份优先从文件名读，读不到用最上层文件夹
- 第几套支持「第1套 / 第一套 / set1」
- 同一套有多份副本时，优先选有文字层、非「详解」、路径更浅的那份
- 已存在且能抽出文字的 set 不覆盖

之后运行 python tools/build_paper_text.py 生成文本和坐标。
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "theme" / "assets" / "papers"
REPORT = ROOT / "content" / "papers-import-report.json"

EXCLUDE_PARTS = {"解析PDF", "解析", "答案", "听力音频", "真题word版"}
CN_NUMBERS = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}


def parse_year_month(text: str) -> tuple[int, int] | None:
    match = re.search(r"(20\d{2})\s*年\s*(\d{1,2})\s*月", text)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2))


def parse_set(name: str) -> int | None:
    match = re.search(r"第\s*([0-9]+|[一二三四五六七八九十]+)\s*套", name)
    if match:
        value = match.group(1)
        if value.isdigit():
            return int(value)
        return CN_NUMBERS.get(value[0])
    match = re.search(r"set\s*([0-9]+)", name, re.I)
    return int(match.group(1)) if match else None


def text_chars(path: Path, pages: int = 3) -> int:
    try:
        doc = pymupdf.open(path)
        total = sum(len(doc[i].get_text("text").strip()) for i in range(min(pages, doc.page_count)))
        doc.close()
        return total
    except Exception:
        return 0


def score(path: Path) -> tuple:
    return (
        0 if text_chars(path) >= 300 else 1,
        1 if "详解" in path.name else 0,
        0 if "可复制" in path.name else 1,
        len(path.parts),
        -path.stat().st_size,
    )


def collect(source: Path) -> dict[tuple[int, int, int], Path]:
    groups: dict[tuple[int, int, int], list[Path]] = {}
    for path in source.rglob("*.pdf"):
        rel = path.relative_to(source)
        if any(part in EXCLUDE_PARTS for part in rel.parts[:-1]):
            continue
        if "解析" in path.name or "答案" in path.name:
            continue
        if "真题" not in path.name and not any("真题" in part for part in rel.parts):
            continue

        year_month = parse_year_month(path.name) or parse_year_month(rel.parts[0])
        if not year_month:
            continue
        number = parse_set(path.name)

        # 2020-07 只有 1 套，文件名没写第几套
        if number is None and year_month == (2020, 7) and "真题" in path.name:
            number = 1
        if number is None:
            continue

        groups.setdefault((year_month[0], year_month[1], number), []).append(path)

    return {key: sorted(paths, key=score)[0] for key, paths in groups.items()}


def convert_docx(docx: Path, target: Path) -> bool:
    """用 LibreOffice 把 Word 版试卷转成 PDF（带文字层和坐标）。"""
    soffice = Path(r"C:\Program Files\LibreOffice\program\soffice.com")
    if not soffice.is_file():
        return False
    profile = ROOT / "tools" / "_lo_profile"
    with tempfile.TemporaryDirectory(prefix="paper-docx-") as temp:
        result = subprocess.run(
            [str(soffice), f"-env:UserInstallation=file:///{profile.as_posix()}",
             "--headless", "--norestore", "--convert-to", "pdf", "--outdir", temp, str(docx)],
            capture_output=True, text=True, timeout=180,
        )
        produced = Path(temp) / (docx.stem + ".pdf")
        if not produced.is_file():
            print("  转换失败:", (result.stderr or "").strip()[:200])
            return False
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(produced.read_bytes())
        return True


def split_pdf(source: Path, page_indexes: list[int], target: Path) -> None:
    doc = pymupdf.open(source)
    out = pymupdf.open()
    for index in page_indexes:
        out.insert_pdf(doc, from_page=index, to_page=index)
    target.parent.mkdir(parents=True, exist_ok=True)
    out.save(target)
    out.close()
    doc.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", help="下载目录")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    source = Path(args.source)
    if not source.is_dir():
        raise SystemExit(f"目录不存在: {source}")

    chosen = collect(source)
    print(f"识别到 {len(chosen)} 套 PDF")

    imported, skipped, missing = [], [], []
    for (year, month, number) in sorted(chosen):
        if (year, month) == (2023, 3) and number in (2, 3):
            missing.append({"year": year, "month": month, "set": number,
                            "reason": "源文件只有第二/三套的写作和听力说明页，不完整"})
            continue

        target = DEST / f"{year}-{month:02d}" / f"set{number}-paper.pdf"
        if target.exists() and text_chars(target) >= 300:
            skipped.append(str(target.relative_to(ROOT)))
            continue

        item = {"year": year, "month": month, "set": number,
                "source": str(chosen[(year, month, number)]),
                "target": str(target.relative_to(ROOT))}

        if args.dry_run:
            imported.append(item)
            continue

        if (year, month, number) == (2019, 6, 1):
            docx = list(source.glob("2019年06月*/真题word版/*第1套*.docx"))
            if docx and convert_docx(docx[0], target):
                item["note"] = "由 Word 版转换（原 PDF 是扫描件）"
                imported.append(item)
                print("  2019-06 set1 用 Word 转换")
                continue

        source_pdf = chosen[(year, month, number)]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(source_pdf.read_bytes())
        if text_chars(target) < 300:
            item["note"] = "扫描件/无文字层，暂时无法做词频索引"
            missing.append(item)
        else:
            imported.append(item)

    # 2023-03：从合并 PDF 里拆出第 1 套（第 2、3 套源文件不完整）
    combined = sorted(source.rglob("*2023年3月*3套*.pdf"))
    target = DEST / "2023-03" / "set1-paper.pdf"
    if combined and not (target.exists() and text_chars(target) >= 300):
        if args.dry_run:
            imported.append({"year": 2023, "month": 3, "set": 1,
                             "source": str(combined[0]), "target": str(target.relative_to(ROOT)),
                             "note": "从合并 PDF 拆出第 1 套"})
        else:
            split_pdf(combined[0], list(range(0, 11)), target)
            imported.append({"year": 2023, "month": 3, "set": 1,
                             "source": str(combined[0]), "target": str(target.relative_to(ROOT)),
                             "note": "从合并 PDF 拆出第 1 套"})

    print(f"导入 {len(imported)} 套，已有跳过 {len(skipped)} 套，缺失/扫描 {len(missing)} 套")
    for item in imported:
        print(f"  + {item['year']}-{item['month']:02d} set{item['set']}"
              + (f"  ({item['note']})" if item.get("note") else ""))
    for item in missing:
        print(f"  ! {item.get('year')}-{item.get('month', 0):02d} set{item.get('set')}"
              f"  {item.get('reason') or item.get('note', '')}")

    if not args.dry_run:
        REPORT.write_text(json.dumps({"imported": imported, "skipped": skipped, "missing": missing},
                                     ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"报告: {REPORT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
