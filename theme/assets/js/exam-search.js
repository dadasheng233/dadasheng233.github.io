/* 晚风小筑 · 真题出处检索
   统计单词在真题库中的出现次数与位置，给出词义、所在句子和中文翻译，
   并可跳到 PDF 对应页做高亮标注。 */
(() => {
  'use strict';

  const root = document.getElementById('words-app');
  const input = document.getElementById('exam-input');
  const results = document.getElementById('exam-results');
  if (!root || !input || !results) return;

  let index = null;
  let indexPromise = null;
  let timer = null;
  let token = 0;
  const occurrences = new Map();
  let occurrenceSeq = 0;

  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch('/papers-text.json')
        .then((response) => {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then((data) => {
          index = data;
          return data;
        });
    }
    return indexPromise;
  }

  function papersOf(data) {
    return (data && Array.isArray(data.papers) ? data.papers : [])
      .filter((paper) => paper && paper.text)
      .slice()
      .sort((a, b) => (b.year - a.year) || (b.month - a.month) || (b.set - a.set));
  }

  function localeOf(paper, offset) {
    let page = 1;
    const pages = Array.isArray(paper.pages) ? paper.pages : [];
    for (let i = 0; i < pages.length; i++) {
      if (pages[i] <= offset) page = i + 1;
      else break;
    }
    let section = '';
    const sections = Array.isArray(paper.sections) ? paper.sections : [];
    for (const item of sections) {
      if (item.o <= offset) section = item.n;
      else break;
    }
    return { page, section };
  }

  function sentenceAt(text, offset, wordLength) {
    const beforeLimit = Math.max(0, offset - 360);
    let start = beforeLimit;
    for (let i = offset - 1; i >= beforeLimit; i--) {
      const ch = text[i];
      if (ch === '\n') { start = i + 1; break; }
      if ((ch === '.' || ch === '!' || ch === '?') && /\s/.test(text[i + 1] || ' ')) {
        start = i + 1;
        break;
      }
    }
    const afterLimit = Math.min(text.length, offset + wordLength + 360);
    let end = afterLimit;
    for (let i = offset + wordLength; i < afterLimit; i++) {
      const ch = text[i];
      if (ch === '\n') { end = i; break; }
      if ((ch === '.' || ch === '!' || ch === '?') && /\s/.test(text[i + 1] || ' ')) {
        end = i + 1;
        break;
      }
    }
    return text.slice(start, end).replace(/\s+/g, ' ').trim();
  }

  function clipSentence(sentence, word, max = 300) {
    if (sentence.length <= max) return sentence;
    const index = sentence.toLowerCase().indexOf(word.toLowerCase());
    if (index < 0) return sentence.slice(0, max) + '…';
    const start = Math.max(0, index - Math.floor(max * 0.45));
    const end = Math.min(sentence.length, start + max);
    return `${start > 0 ? '…' : ''}${sentence.slice(start, end)}${end < sentence.length ? '…' : ''}`;
  }

  function highlightSentence(sentence, word) {
    const splitter = new RegExp('(' + escapeRegExp(word) + ')', 'gi');
    return sentence.split(splitter)
      .map((part, index) => (index % 2 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
      .join('');
  }

  function paperLink(paper, page, word) {
    const params = new URLSearchParams({
      file: paper.file || '',
      page: String(page || 1),
      title: paper.label || paper.id || '真题'
    });
    if (word) params.set('word', word);
    return '/paper.html?' + params.toString();
  }

  function search(raw) {
    const word = String(raw || '').trim();
    const query = word.toLowerCase();
    if (query.length < 2) {
      results.innerHTML = '<div class="exam-empty">至少输入 2 个字母，例如 abandon。</div>';
      return;
    }

    const current = ++token;
    results.innerHTML = '<div class="exam-empty">正在加载真题索引…</div>';
    loadIndex()
      .then((data) => {
        if (current !== token) return;
        const papers = papersOf(data);
        if (!papers.length) {
          results.innerHTML = `
            <div class="exam-empty">
              还没有真题索引。先运行 <code>python tools/build_paper_text.py</code>，再 <code>npm run build</code>。
            </div>`;
          return;
        }
        render(papers, query, word, current);
      })
      .catch((error) => {
        if (current !== token) return;
        console.warn('[exam] index load failed', error);
        results.innerHTML = `
          <div class="exam-empty">
            真题索引加载失败（${escapeHtml(error.message || '网络错误')}）。
            确认 <code>public/papers-text.json</code> 存在，并刷新页面。
          </div>`;
      });
  }

  function render(papers, query, word, current) {
    const escaped = escapeRegExp(query);
    const groups = [];
    let total = 0;
    let papersHit = 0;
    const byYear = new Map();
    occurrenceSeq = 0;
    occurrences.clear();

    for (const paper of papers) {
      const count = (paper.text.match(new RegExp('\\b' + escaped + '\\b', 'gi')) || []).length;
      if (!count) continue;
      total += count;
      papersHit += 1;
      byYear.set(paper.year, (byYear.get(paper.year) || 0) + count);

      const offsets = [];
      const finder = new RegExp('\\b' + escaped + '\\b', 'gi');
      let match;
      while ((match = finder.exec(paper.text)) && offsets.length < 3) {
        offsets.push(match.index);
        finder.lastIndex = match.index + Math.max(1, word.length);
      }
      groups.push({ paper, count, offsets });
    }

    if (current !== token) return;
    if (!total) {
      results.innerHTML = `
        <div class="exam-empty">
          <p class="exam-empty-title">没有找到 “${escapeHtml(word)}”</p>
          <p>可能拼写不同，或这个词只出现在 2015 年以前的卷子里。试试：</p>
          <div class="exam-suggest">
            ${['abandon', 'sustainable', 'campus', 'convenient'].map((item) =>
              `<button type="button" data-exam-suggest="${item}">${item}</button>`).join('')}
          </div>
        </div>`;
      return;
    }

    const years = [...byYear.keys()].sort((a, b) => b - a);
    const yearRange = years.length > 1 ? `${Math.min(...years)}–${Math.max(...years)}` : String(years[0]);
    const yearChips = years.map((year) =>
      `<span class="exam-year-chip">${year}<b>${byYear.get(year)}</b></span>`).join('');

    let shown = 0;
    const limit = 36;
    const groupsHtml = groups.map((group) => {
      const items = group.offsets.map((offset) => {
        if (shown >= limit) return '';
        shown += 1;
        const where = localeOf(group.paper, offset);
        const sentence = clipSentence(sentenceAt(group.paper.text, offset, word.length), word);
        const id = 'occ-' + (++occurrenceSeq);
        occurrences.set(id, { sentence, word });
        return `
          <li class="exam-occurrence" data-occ="${id}">
            <div class="exam-loc">
              <span class="exam-dot" aria-hidden="true"></span>
              ${escapeHtml(where.section || '真题')} · 第 ${where.page} 页
              <a class="exam-open" href="${paperLink(group.paper, where.page, word)}" target="_blank" rel="noopener">卷面标注 →</a>
            </div>
            <p class="exam-sentence">${highlightSentence(sentence, word)}</p>
            <div class="exam-trans-row">
              <button class="exam-translate" type="button" data-exam-translate="${id}">翻译这句</button>
              <span class="exam-trans" id="trans-${id}" hidden></span>
            </div>
          </li>`;
      }).join('');
      return `
        <section class="exam-paper">
          <header class="exam-paper-head">
            <span class="exam-paper-label">${escapeHtml(group.paper.label || group.paper.id)}</span>
            <span class="exam-paper-count">${group.count} 次</span>
          </header>
          <ul class="exam-list">${items}</ul>
          ${group.count > group.offsets.length ? `<p class="exam-more">还有 ${group.count - group.offsets.length} 处未展开</p>` : ''}
        </section>`;
    }).join('');

    const remaining = total - shown;
    results.innerHTML = `
      <div class="exam-summary">
        <p class="exam-summary-main"><b>${total}</b> 次 · <b>${papersHit}</b> 套卷 · ${yearRange}</p>
        <div class="exam-years">${yearChips}</div>
      </div>
      <div class="exam-word-card" id="exam-word-card">
        <div class="exam-word-head">
          <strong class="exam-word-itself">${escapeHtml(word)}</strong>
          <span class="exam-word-phonetic"></span>
          <span class="exam-word-source">正在查词义…</span>
        </div>
        <p class="exam-word-meaning">…</p>
      </div>
      <div class="exam-papers">${groupsHtml}</div>
      ${remaining > 0 ? `<p class="exam-note">页面只列出前 ${shown} 处，其余 ${remaining} 处只计入次数。</p>` : ''}`;

    fillWordCard(word);
    const firstOccurrence = occurrences.keys().next().value;
    if (firstOccurrence) translateOccurrence(firstOccurrence);
  }

  async function fillWordCard(word) {
    const card = document.getElementById('exam-word-card');
    if (!card) return;
    const meaning = card.querySelector('.exam-word-meaning');
    const source = card.querySelector('.exam-word-source');
    const phonetic = card.querySelector('.exam-word-phonetic');
    if (!window.BlogTranslate) {
      meaning.textContent = '翻译脚本没有加载';
      source.textContent = '';
      return;
    }
    try {
      const info = await window.BlogTranslate.meaningOf(word);
      if (!document.body.contains(card)) return;
      meaning.textContent = info.meaning || '暂无释义';
      source.textContent = info.source || '';
      if (info.phonetic) phonetic.textContent = '/' + info.phonetic.replace(/^\/|\/$/g, '') + '/';
    } catch (error) {
      if (!document.body.contains(card)) return;
      meaning.textContent = error.message || '释义获取失败';
      source.textContent = '翻译服务不可用';
    }
  }

  async function translateOccurrence(id) {
    const item = occurrences.get(id);
    const output = document.getElementById('trans-' + id);
    const button = document.querySelector(`[data-exam-translate="${id}"]`);
    if (!item || !output) return;
    if (output.hidden === false) {
      output.hidden = true;
      if (button) button.textContent = '翻译这句';
      return;
    }
    if (output.dataset.done === '1') {
      output.hidden = false;
      if (button) button.textContent = '收起译文';
      return;
    }
    if (button) {
      button.disabled = true;
      button.textContent = '翻译中…';
    }
    output.hidden = false;
    output.textContent = '正在翻译…';
    try {
      if (!window.BlogTranslate) throw new Error('翻译脚本没有加载');
      const translated = await window.BlogTranslate.translate(item.sentence);
      output.textContent = translated;
      output.dataset.done = '1';
      if (button) button.textContent = '收起译文';
    } catch (error) {
      output.textContent = error.message || '翻译失败，稍后再试';
      if (button) button.textContent = '重试';
    } finally {
      if (button) button.disabled = false;
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const value = input.value.trim();
    if (value.length < 2) {
      results.innerHTML = '<div class="exam-empty">至少输入 2 个字母，例如 abandon。</div>';
      return;
    }
    timer = setTimeout(() => search(value), 280);
  });

  const form = document.getElementById('exam-form');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearTimeout(timer);
      search(input.value);
    });
  }

  results.addEventListener('click', (event) => {
    const suggest = event.target.closest('[data-exam-suggest]');
    if (suggest) {
      input.value = suggest.dataset.examSuggest;
      search(input.value);
      input.focus();
      return;
    }
    const translateButton = event.target.closest('[data-exam-translate]');
    if (translateButton) translateOccurrence(translateButton.dataset.examTranslate);
  });

  document.querySelectorAll('[data-word-tab="exam"]').forEach((tab) => {
    tab.addEventListener('click', () => {
      setTimeout(() => input.focus(), 30);
    });
  });

  function open(word) {
    const value = String(word || '').trim();
    if (!value) return;
    const tab = document.querySelector('[data-word-tab="exam"]');
    if (tab) tab.click();
    input.value = value;
    search(value);
    input.focus();
  }

  window.ExamSearch = { open, search };
})();
