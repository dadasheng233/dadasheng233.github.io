"""复制 2024-2025 四级真题/解析 PDF，生成 content/papers.json。"""
import json
import shutil
from pathlib import Path

SRC = Path(r'C:\Users\lenovo\Downloads\四级真题+答案+听力（2025.06-2015.06）')
ROOT = Path(r'G:\newwork\blog')
DST = ROOT / 'theme' / 'assets' / 'papers'
OUT = ROOT / 'content' / 'papers.json'

FILES = {
    '2024-06': {
        'papers': [
            ('大学英语四级考试2024年6月真题【第一套】.pdf', 1),
            ('大学英语四级考试2024年6月真题【第二套】.pdf', 2),
            ('大学英语四级考试2024年6月真题【第三套】.pdf', 3),
        ],
        'answers': [
            ('2024年6月四级真题解析【第一套】.pdf', 1),
            ('2024年6月四级真题解析【第二套】.pdf', 2),
            ('2024年6月四级真题解析【第三套】.pdf', 3),
        ],
        'dir': '2024年6月CET4真题+解析+听力音频全3套',
        'paper_dir': '2024年6月四级真题-原题',
        'answer_dir': '2024年6月四级真题-答案解析',
    },
    '2024-12': {
        'papers': [
            ('2024.12四级真题第1套.pdf', 1),
            ('2024.12四级真题第2套.pdf', 2),
            ('2024.12四级真题第3套.pdf', 3),
        ],
        'answers': [
            ('2024.12英语四级解析第1套.pdf', 1),
            ('2024.12英语四级解析第2套.pdf', 2),
            ('2024.12英语四级解析第3套.pdf', 3),
        ],
        'dir': '2024年12月CET4真题+解析+听力音频全3套',
        'paper_dir': '2024年12月四级真题',
        'answer_dir': '2024年12月四级答案解析',
    },
    '2025-06': {
        'papers': [
            ('2025.06四级真题第1套.pdf', 1),
            ('2025.06四级真题第2套.pdf', 2),
            ('2025.06四级真题第3套.pdf', 3),
        ],
        'answers': [
            ('2025.06英语四级解析第1套.pdf', 1),
            ('2025.06英语四级解析第2套.pdf', 2),
            ('2025.06英语四级解析第3套.pdf', 3),
        ],
        'dir': '2025年6月四级真题原卷（全3套）',
        'paper_dir': '.',
        'answer_dir': '.',
    },
}


def size_label(path):
    mb = path.stat().st_size / 1024 / 1024
    return f'{mb:.1f} MB' if mb >= 1 else f'{path.stat().st_size / 1024:.0f} KB'


def main():
    DST.mkdir(parents=True, exist_ok=True)
    manifest = []
    total = 0
    for exam_id, config in FILES.items():
        year, month = exam_id.split('-')
        base = SRC / config['dir']
        paper_dir = base / config['paper_dir']
        answer_dir = base / config['answer_dir']
        target_dir = DST / exam_id
        target_dir.mkdir(parents=True, exist_ok=True)
        by_set = {}
        for filename, set_number in config['papers']:
            source = paper_dir / filename
            target = target_dir / f'set{set_number}-paper.pdf'
            if not source.exists():
                raise SystemExit(f'missing: {source}')
            shutil.copy2(source, target)
            total += target.stat().st_size
            by_set.setdefault(set_number, {})['paper'] = target
        for filename, set_number in config['answers']:
            source = answer_dir / filename
            target = target_dir / f'set{set_number}-answer.pdf'
            if not source.exists():
                raise SystemExit(f'missing: {source}')
            shutil.copy2(source, target)
            total += target.stat().st_size
            by_set.setdefault(set_number, {})['answer'] = target
        for set_number in sorted(by_set):
            item = by_set[set_number]
            manifest.append({
                'id': f'{exam_id}-{set_number}',
                'year': int(year),
                'month': int(month),
                'set': set_number,
                'label': f'{year}年{int(month)}月 第{set_number}套',
                'paper': f'/assets/papers/{exam_id}/set{set_number}-paper.pdf',
                'paperSize': size_label(item['paper']),
                'answer': f'/assets/papers/{exam_id}/set{set_number}-answer.pdf',
                'answerSize': size_label(item['answer']),
            })
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print('sets', len(manifest), 'pdfs', len(manifest) * 2, 'total MB', round(total / 1024 / 1024, 1))


if __name__ == '__main__':
    main()
