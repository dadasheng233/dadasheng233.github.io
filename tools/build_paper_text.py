"""把真题 PDF 抽成可检索文本，生成 content/papers-text.json 和逐词坐标。

用法：
    python tools/build_paper_text.py            # 扫描 PDF、补 papers.json、重新抽取
    python tools/build_paper_text.py --no-scan  # 只按现有 papers.json 抽取

输出：
    content/papers-text.json                全文 + 页码 / 段落位置
    content/paper-boxes/<月份>/<卷名>.json   每页每个词的归一化坐标（PDF 高亮标注用）

目录约定（推荐）：
    theme/assets/papers/2023-06/set1-paper.pdf
    theme/assets/papers/2023-06/set1-answer.pdf   # 答案文件会被忽略
    文件名里的 2023-06 / set1 会自动写进 content/papers.json。

依赖：pymupdf（pip install pymupdf）。扫描件没有文字层时会给出提示。
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import pymupdf
except ImportError:  # 兼容老版本的 import 名
    import fitz as pymupdf

ROOT = Path(__file__).resolve().parent.parent
PAPERS_DIR = ROOT / "theme" / "assets" / "papers"
PAPERS_JSON = ROOT / "content" / "papers.json"
OUT_JSON = ROOT / "content" / "papers-text.json"
BOXES_DIR = ROOT / "content" / "paper-boxes"

PART_NAMES = {"I": "Writing", "II": "Listening", "III": "Reading", "IV": "Translation"}
PART_LABELS = {
    "Writing": "Writing 写作",
    "Listening": "Listening 听力",
    "Reading": "Reading 阅读",
    "Translation": "Translation 翻译",
}

ROMAN = {
    "Ⅰ": "I", "Ⅱ": "II", "Ⅲ": "III", "Ⅳ": "IV", "Ⅴ": "V",
    "ⅰ": "I", "ⅱ": "II", "ⅲ": "III", "ⅳ": "IV",
}

PART_RE = re.compile(r"Part\s*(Ⅰ|Ⅱ|Ⅲ|Ⅳ|Ⅴ|I{1,3}|IV|V)\b", re.I)
SECTION_RE = re.compile(r"Section\s*([ABC])\b", re.I)
PASSAGE_RE = re.compile(r"Passage\s+(One|Two|Three|Four)\b", re.I)


def normalize(text: str) -> str:
    text = text.replace("\u00a0", " ").replace("\u3000", " ")
    text = text.replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = text.replace("–", "-").replace("—", "-")
    for source, target in ROMAN.items():
        text = text.replace(source, target)
    # PDF 断行把单词拆开：exam-\nple -> example
    text = re.sub(r"([A-Za-z])-\s*\n\s*([a-z])", r"\1\2", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def pdf_size_label(path: Path) -> str:
    size = path.stat().st_size
    if size >= 1024 * 1024:
        return f"{size / (1024 * 1024):.1f} MB"
    return f"{max(1, round(size / 1024))} KB"


def scan_pdfs() -> list[dict]:
    """扫描 theme/assets/papers/YYYY-MM/setN-paper.pdf。"""
    found = []
    if not PAPERS_DIR.is_dir():
        return found
    for folder in sorted(PAPERS_DIR.iterdir()):
        if not folder.is_dir():
            continue
        match = re.match(r"^(\d{4})-(\d{2})$", folder.name)
        if not match:
            continue
        year, month = int(match.group(1)), int(match.group(2))
        for pdf in sorted(folder.glob("*.pdf")):
            name = pdf.name.lower()
            if "answer" in name or "解析" in name:
                continue
            set_match = re.search(r"set\s*([0-9]+)", name)
            if not set_match:
                set_match = re.search(r"第\s*([0-9]+)\s*套", pdf.name)
            if not set_match:
                continue
            number = int(set_match.group(1))
            found.append({
                "id": f"{year}-{month:02d}-{number}",
                "year": year,
                "month": month,
                "set": number,
                "label": f"{year}年{month}月第{number}套",
                "paper": f"/assets/papers/{folder.name}/{pdf.name}",
                "paperSize": pdf_size_label(pdf),
            })
    return found


def merge_papers(existing: list[dict], found: list[dict]) -> tuple[list[dict], int]:
    by_id = {item.get("id"): item for item in existing if item.get("id")}
    added = 0
    for item in found:
        if item["id"] in by_id:
            # 保留人工写的 label / answer / paperSize 等，只补缺失字段
            for key, value in item.items():
                by_id[item["id"]].setdefault(key, value)
        else:
            by_id[item["id"]] = item
            added += 1
    papers = list(by_id.values())
    papers.sort(key=lambda item: (item.get("year", 0), item.get("month", 0), item.get("set", 0)))
    return papers, added


def resolve_pdf(paper: dict) -> Path | None:
    paper_path = paper.get("paper") or ""
    if not paper_path:
        return None
    return ROOT / "theme" / paper_path.lstrip("/")


PART_ORDER = ["Writing", "Listening", "Reading", "Translation"]


def find_part_anchors(text: str) -> dict[str, int]:
    """先找 Part I/II/III/IV，缺的用 Writing/Listening/Reading/Translation 关键字补。"""
    anchors: dict[str, int] = {}
    for match in PART_RE.finditer(text):
        numeral = match.group(1).upper()
        numeral = ROMAN.get(numeral, numeral)
        part = PART_NAMES.get(numeral)
        if part and part not in anchors:
            anchors[part] = match.start()

    for index, part in enumerate(PART_ORDER):
        if part in anchors:
            continue
        lower = max([anchors[item] for item in PART_ORDER[:index] if item in anchors] or [-1])
        upper = min([anchors[item] for item in PART_ORDER[index + 1:] if item in anchors] or [len(text)])
        if upper <= lower + 1:
            continue
        keyword = re.search(r"\b" + part + r"\b", text[lower + 1:upper], re.I)
        if keyword:
            anchors[part] = lower + 1 + keyword.start()
    return anchors


def build_sections(text: str) -> list[dict]:
    anchors = find_part_anchors(text)
    parts = sorted(
        ({"o": offset, "part": part} for part, offset in anchors.items()),
        key=lambda item: item["o"],
    )
    if not parts:
        parts = [{"o": 0, "part": "All"}]

    def part_at(offset: int) -> str:
        current = parts[0]["part"]
        for item in parts:
            if item["o"] <= offset:
                current = item["part"]
            else:
                break
        return current

    sections = [
        {
            "o": item["o"],
            "kind": "part",
            "part": item["part"],
            "n": PART_LABELS.get(item["part"], item["part"]),
        }
        for item in parts
    ]

    # 阅读里的 Section A/B/C 和 Passage 作为更细的位置
    for match in SECTION_RE.finditer(text):
        part = part_at(match.start())
        sections.append({
            "o": match.start(),
            "kind": "section",
            "part": part,
            "n": f"{PART_LABELS.get(part, part)} · Section {match.group(1).upper()}",
        })

    for match in PASSAGE_RE.finditer(text):
        part = part_at(match.start())
        sections.append({
            "o": match.start(),
            "kind": "passage",
            "part": part,
            "n": f"{PART_LABELS.get(part, part)} · Passage {match.group(1).title()}",
        })

    sections.sort(key=lambda item: item["o"])
    return sections


def boxes_path_for(paper: dict) -> Path | None:
    """content/paper-boxes/2024-06/set1-paper.json，与 PDF 目录结构一致。"""
    paper_path = paper.get("paper") or ""
    match = re.match(r"^/assets/papers/(.+?)\.pdf$", paper_path, re.I)
    if not match:
        return None
    return BOXES_DIR / (match.group(1) + ".json")


def extract(paper: dict, warnings: list[str]) -> dict | None:
    pdf = resolve_pdf(paper)
    if pdf is None or not pdf.is_file():
        warnings.append(f"找不到 PDF：{paper.get('id')} -> {pdf}")
        return None

    try:
        document = pymupdf.open(pdf)
    except Exception as error:  # noqa: BLE001
        warnings.append(f"打不开 {pdf.name}：{error}")
        return None

    chunks = []
    page_offsets = []
    box_pages = []
    offset = 0
    empty_pages = 0
    for page in document:
        text = normalize(page.get_text("text"))
        if not text:
            empty_pages += 1
        page_offsets.append(offset)
        chunks.append(text)
        offset += len(text) + 1

        # 记录每个词的归一化坐标，供 PDF 阅读器做高亮标注
        width = page.rect.width or 1
        height = page.rect.height or 1
        words = []
        for item in page.get_text("words"):
            token = str(item[4]).strip()
            if not token:
                continue
            words.append([
                token,
                round(float(item[0]) / width, 4),
                round(float(item[1]) / height, 4),
                round(float(item[2]) / width, 4),
                round(float(item[3]) / height, 4),
            ])
        box_pages.append({"w": round(width, 1), "h": round(height, 1), "words": words})
    document.close()

    full_text = "\n".join(chunks)
    if len(full_text) < 300:
        warnings.append(
            f"{paper.get('id')} 只有 {len(full_text)} 字，可能是扫描版（无文字层），"
            "需要先 OCR 再抽。"
        )
        if empty_pages:
            warnings.append(f"  {empty_pages} 页没有抽出文字")
        return None

    target = boxes_path_for(paper)
    if target is not None:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(
            json.dumps({"id": paper.get("id"), "pages": box_pages}, ensure_ascii=False,
                       separators=(",", ":")),
            encoding="utf-8",
        )

    return {
        "id": paper.get("id"),
        "label": paper.get("label") or paper.get("id"),
        "year": paper.get("year"),
        "month": paper.get("month"),
        "set": paper.get("set"),
        "file": paper.get("paper"),
        "pages": page_offsets,
        "sections": build_sections(full_text),
        "text": full_text,
    }


def main() -> int:
    scan = "--no-scan" not in sys.argv
    existing = []
    if PAPERS_JSON.is_file():
        existing = json.loads(PAPERS_JSON.read_text(encoding="utf-8"))

    if scan:
        found = scan_pdfs()
        papers, added = merge_papers(existing, found)
        if added:
            PAPERS_JSON.write_text(
                json.dumps(papers, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
        print(f"扫描到 {len(found)} 套 PDF，papers.json 新增 {added} 套")
    else:
        papers = existing

    warnings: list[str] = []
    results = []
    for paper in papers:
        item = extract(paper, warnings)
        if item:
            results.append(item)
            print(f"  {item['id']:<12} {len(item['text']):>7} 字  {len(item['sections'])} 个位置标记")
    payload = {
        "generatedAt": __import__("datetime").date.today().isoformat(),
        "papers": results,
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    total = sum(len(item["text"]) for item in results)
    print(f"写入 {OUT_JSON.relative_to(ROOT)}：{len(results)} 套 / {total} 字符")

    if warnings:
        print("\n提示：")
        for warning in warnings:
            print("  - " + warning)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
