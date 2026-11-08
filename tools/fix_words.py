"""清理 OCR 产生的少量坏词形，不重新 OCR。"""
import json
import re
from pathlib import Path

path = Path(r'G:\newwork\blog\content\words.json')
data = json.loads(path.read_text(encoding='utf-8'))
changed = []

for item in data:
    old_word = item['word']
    old_meaning = item['meaning']
    word = old_word
    meaning = old_meaning

    word = re.sub(r'\s+t$', '', word)
    word = re.sub(r'\s+v\($', '', word)

    fixes = {
        'spill(': ('spill', '（' + meaning if meaning.startswith('使)') else meaning),
        'bulk(': ('bulk', '（' + meaning if meaning.startswith('巨大)') else meaning),
        'intensify v(': ('intensify', '（' + meaning if meaning.startswith('使)') else meaning),
        'backward(s': ('backward(s)', meaning.lstrip('）)')),
        'fulfil(i': ('fulfil(l)', meaning.lstrip('）)')),
        'catalog(ue': ('catalog(ue)', meaning.lstrip('）)')),
        'marvel(i)ous': ('marvel(l)ous', meaning),
    }
    if word in fixes:
        word, meaning = fixes[word]

    if word == 'up' and re.match(r'^[（(]?[－-]?to[－-]?date', meaning):
        word = 'up-to-date'
        meaning = '现代化的，最新的；跟上时代的'

    if word.endswith('(') and word.count('(') > word.count(')'):
        word = word[:-1]
    if word.count('(') > word.count(')'):
        word += ')'
    meaning = meaning.lstrip('）)').strip()
    if meaning.startswith('使)') or meaning.startswith('巨大)'):
        meaning = '（' + meaning
    meaning = re.sub(r'[；;]{2,}', '；', meaning)
    meaning = re.sub(r'\s+', ' ', meaning).strip()

    item['word'] = word
    item['meaning'] = meaning
    if word != old_word or meaning != old_meaning:
        changed.append((old_word, word, old_meaning, meaning))

path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
print('words', len(data), 'changed', len(changed))
for row in changed[:30]:
    print(row[0], '->', row[1])
