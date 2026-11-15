/* 晚风小筑 · 真题出处检索
   把 /papers-text.json 里的真题全文在浏览器端做词频统计，
   返回「出现次数 + 试卷 + 部分 + 页码 + 上下文」，点击跳到 PDF 对应页。 */
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
  let currentWord = '';

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

  function contextAt(paper, offset, word) {
    const start = Math.max(0, offset - 80);
    const end = Math.min(paper.text.length, offset + word.length + 110);
    const before = paper.text.slice(start, offset);
    const hit = paper.text.slice(offset, offset + word.length);
    const after = paper.text.slice(offset + word.length, end);
    return `${start > 0 ? '…' : ''}${escapeHtml(before)}<mark>${escapeHtml(hit)}</mark>`
      + `${escapeHtml(after)}${end < paper.text.length ? '…' : ''}`;
  }

  function paperLink(paper, page) {
    const params = new URLSearchParams({
      file: paper.file || '',
      page: String(page || 1),
      title: paper.label || paper.id || '真题'
    });
    return '/paper.html?' + params.toString();
  }

  function search(raw) {
    const word = String(raw || '').trim();
    currentWord = word;
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
    const matcher = new RegExp('\\b' + escaped + '\\b', 'gi');
    const groups = [];
    let total = 0;
    let papersHit = 0;
    const byYear = new Map();

    for (const paper of papers) {
      const count = (paper.text.match(matcher) || []).length;
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
        return `
          <li class="exam-occurrence">
            <a href="${paperLink(group.paper, where.page)}" target="_blank" rel="noopener">
              <span class="exam-loc">
                <span class="exam-dot" aria-hidden="true"></span>
                ${escapeHtml(where.section || '真题')} · 第 ${where.page} 页
                <span class="exam-open">打开 PDF →</span>
              </span>
              <span class="exam-snippet">${contextAt(group.paper, offset, word)}</span>
            </a>
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
      <div class="exam-papers">${groupsHtml}</div>
      ${remaining > 0 ? `<p class="exam-note">页面只列出前 ${shown} 处，其余 ${remaining} 处只计入次数。</p>` : ''}`;
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
    }
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
