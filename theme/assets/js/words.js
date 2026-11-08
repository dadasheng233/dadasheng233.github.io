/* 晚风小筑 · CET-4 单词本
   数据来自 /words.json；学习进度只存在当前浏览器。 */
(() => {
  'use strict';

  const app = document.getElementById('words-app');
  if (!app) return;

  const $ = (selector) => app.querySelector(selector);
  const $$ = (selector) => Array.from(app.querySelectorAll(selector));
  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const PROGRESS_KEY = 'wanfeng:words:progress';
  const WRONG_KEY = 'wanfeng:words:wrong';
  const PAGE_SIZE = 15;

  let allWords = [];
  const storedProgress = readJson(PROGRESS_KEY, {});
  let progress = storedProgress && !Array.isArray(storedProgress) ? storedProgress : {};
  const storedWrong = readJson(WRONG_KEY, []);
  let wrongWords = Array.isArray(storedWrong) ? storedWrong : [];
  let index = 0;
  let flipped = false;
  let currentTab = 'cards';
  let listPage = 1;
  let listQuery = '';
  let listLetter = 'all';
  let listStatus = 'all';
  let quiz = null;

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      const value = raw ? JSON.parse(raw) : fallback;
      return value && typeof value === 'object' ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (error) { /* noop */ }
  }

  function saveWrong() {
    try { localStorage.setItem(WRONG_KEY, JSON.stringify(wrongWords)); } catch (error) { /* noop */ }
  }

  function statusOf(word) {
    return progress[word.word] || 'new';
  }

  function statusLabel(status) {
    return { new: '未学', unknown: '不认识', fuzzy: '模糊', known: '已掌握' }[status] || '未学';
  }

  function setStatus(word, status) {
    progress[word.word] = status;
    saveProgress();
    updateStats();
  }

  function updateStats() {
    const total = allWords.length;
    const known = allWords.filter((word) => statusOf(word) === 'known').length;
    const review = allWords.filter((word) => ['unknown', 'fuzzy'].includes(statusOf(word))).length;
    const rate = total ? Math.round((known / total) * 100) : 0;
    const set = (selector, value) => {
      const element = $(selector);
      if (element) element.textContent = value;
    };
    set('#word-stat-total', total);
    set('#word-stat-known', known);
    set('#word-stat-review', review);
    set('#word-stat-rate', rate + '%');
    const bar = $('#word-progress');
    if (bar) bar.style.width = rate + '%';
  }

  function renderCard() {
    if (!allWords.length) {
      const front = $('#word-front');
      if (front) front.textContent = '暂无单词';
      return;
    }
    const word = allWords[index];
    const day = (word.tags || []).find((tag) => /^DAY/i.test(tag)) || 'DAY 1';
    flipped = false;
    const card = $('#word-card');
    if (card) card.classList.remove('is-flipped');

    const set = (selector, value) => {
      const element = $(selector);
      if (element) element.textContent = value;
    };
    set('#word-position', `${day} · ${String(index + 1).padStart(2, '0')} / ${allWords.length}`);
    set('#word-front', word.word);
    set('#word-phonetic', [word.pos, word.phonetic].filter(Boolean).join(' · '));
    set('#word-meaning', word.meaning || '暂无释义');

    const example = $('#word-example');
    if (example) {
      example.textContent = word.example
        ? `${word.example}${word.translation ? '\n' + word.translation : ''}`
        : '暂无例句，先记住释义。';
    }
  }

  function flipCard() {
    const card = $('#word-card');
    if (!card || !allWords.length) return;
    flipped = !flipped;
    card.classList.toggle('is-flipped', flipped);
  }

  function go(offset) {
    if (!allWords.length) return;
    index = (index + offset + allWords.length) % allWords.length;
    renderCard();
  }

  function mark(status) {
    if (!allWords.length) return;
    setStatus(allWords[index], status);
    window.setTimeout(() => go(1), 180);
  }

  function speak() {
    if (!allWords.length || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
    const word = allWords[index];
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  }

  function setTab(tab) {
    currentTab = tab;
    $$('[data-word-tab]').forEach((button) => {
      const active = button.dataset.wordTab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    $$('[data-word-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.wordPanel !== tab;
    });
    if (tab === 'list') renderList();
    if (tab === 'quiz' && !quiz) renderQuizStart();
  }

  function filteredWords() {
    const query = listQuery.trim().toLowerCase();
    return allWords.filter((word) => {
      if (listLetter !== 'all' && word.word.charAt(0).toUpperCase() !== listLetter) return false;
      if (listStatus !== 'all' && statusOf(word) !== listStatus) return false;
      if (query && !(word.word.toLowerCase().includes(query) || word.meaning.toLowerCase().includes(query))) return false;
      return true;
    });
  }

  function renderList() {
    const list = $('#word-list');
    const pager = $('#word-pager');
    if (!list || !pager) return;
    const filtered = filteredWords();
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    listPage = Math.min(listPage, pages);
    const start = (listPage - 1) * PAGE_SIZE;
    const visible = filtered.slice(start, start + PAGE_SIZE);

    const count = $('#word-list-count');
    if (count) count.textContent = `显示 ${visible.length} / ${filtered.length} 个词`;

    list.innerHTML = visible.length
      ? visible.map((word) => {
        const realIndex = allWords.indexOf(word);
        const status = statusOf(word);
        return `<button class="word-row" type="button" data-word-index="${realIndex}">
          <span class="word-row-word">${escapeHtml(word.word)}</span>
          <span class="word-row-meaning">${escapeHtml(word.meaning || '')}</span>
          <span class="word-status is-${status}">${statusLabel(status)}</span>
        </button>`;
      }).join('')
      : '<div class="word-empty">没有符合条件的单词。</div>';

    const pageButtons = [];
    if (pages > 1) {
      pageButtons.push(`<button type="button" data-word-page="${listPage - 1}" ${listPage === 1 ? 'disabled' : ''}>上一页</button>`);
      for (let page = 1; page <= pages; page++) {
        pageButtons.push(`<button type="button" data-word-page="${page}" class="${page === listPage ? 'is-current' : ''}">${page}</button>`);
      }
      pageButtons.push(`<button type="button" data-word-page="${listPage + 1}" ${listPage === pages ? 'disabled' : ''}>下一页</button>`);
    }
    pager.innerHTML = pageButtons.join('');
  }

  function quizStart() {
    const pool = [...allWords].sort(() => Math.random() - 0.5);
    const picked = pool.slice(0, Math.min(10, pool.length));
    const questions = picked.map((word) => {
      const distractors = pool
        .filter((item) => item.word !== word.word && item.meaning && item.meaning !== word.meaning)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((item) => item.meaning);
      return {
        word,
        options: [...distractors, word.meaning].sort(() => Math.random() - 0.5),
        answer: word.meaning
      };
    });
    quiz = { questions, index: 0, score: 0, wrong: [], answered: false };
    renderQuiz();
  }

  function renderQuizStart() {
    const box = $('#word-quiz');
    if (!box) return;
    box.innerHTML = `
      <div class="quiz-start">
        <p class="quiz-kicker">QUICK QUIZ</p>
        <h2>四选一 · 10 题</h2>
        <p>看英文，选中文。答错的词会进入错词本。</p>
        <button class="btn-read" type="button" id="quiz-start">开始测验 →</button>
      </div>`;
  }

  function renderQuiz() {
    const box = $('#word-quiz');
    if (!box || !quiz) return;
    if (quiz.index >= quiz.questions.length) {
      const uniqueWrong = [...new Set(quiz.wrong)];
      box.innerHTML = `
        <div class="quiz-result">
          <p class="quiz-kicker">DONE</p>
          <h2>${quiz.score} / ${quiz.questions.length}</h2>
          <p>${quiz.score === quiz.questions.length ? '全对，今天的单词状态不错。' : '答错的词已经记下来了，回去再翻一遍卡片。'}</p>
          ${uniqueWrong.length ? `<div class="quiz-wrong"><strong>错词</strong>${uniqueWrong.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
          <button class="btn-read" type="button" id="quiz-restart">再来一轮 →</button>
        </div>`;
      return;
    }

    const question = quiz.questions[quiz.index];
    box.innerHTML = `
      <div class="quiz-question">
        <div class="quiz-topline">
          <span>第 ${quiz.index + 1} / ${quiz.questions.length} 题</span>
          <span>得分 ${quiz.score}</span>
        </div>
        <div class="quiz-word">${escapeHtml(question.word.word)}</div>
        <div class="quiz-options">
          ${question.options.map((option, optionIndex) => `
            <button type="button" class="quiz-option" data-quiz-option="${escapeHtml(option)}">
              <span>${String.fromCharCode(65 + optionIndex)}</span>
              ${escapeHtml(option)}
            </button>`).join('')}
        </div>
        <div class="quiz-feedback" id="quiz-feedback"></div>
      </div>`;
  }

  function answerQuiz(button) {
    if (!quiz || quiz.answered) return;
    const question = quiz.questions[quiz.index];
    const choice = button.dataset.quizOption;
    const correct = choice === question.answer;
    quiz.answered = true;
    if (correct) quiz.score++;
    else {
      quiz.wrong.push(question.word.word);
      if (!wrongWords.includes(question.word.word)) wrongWords.push(question.word.word);
      saveWrong();
    }

    $$('.quiz-option', app).forEach((optionButton) => {
      const isCorrect = optionButton.dataset.quizOption === question.answer;
      optionButton.classList.toggle('is-correct', isCorrect);
      optionButton.classList.toggle('is-wrong', optionButton === button && !correct);
      optionButton.disabled = true;
    });
    const feedback = $('#quiz-feedback');
    if (feedback) {
      feedback.textContent = correct ? '答对了。' : `正确答案：${question.answer}`;
      feedback.className = 'quiz-feedback is-visible ' + (correct ? 'is-correct' : 'is-wrong');
    }

    window.setTimeout(() => {
      quiz.index++;
      quiz.answered = false;
      renderQuiz();
    }, correct ? 800 : 1400);
  }

  function bindEvents() {
    $('#word-card')?.addEventListener('click', flipCard);
    $('#word-audio')?.addEventListener('click', speak);
    $('#word-shuffle')?.addEventListener('click', () => {
      if (!allWords.length) return;
      let next = index;
      while (allWords.length > 1 && next === index) next = Math.floor(Math.random() * allWords.length);
      index = next;
      renderCard();
    });
    $('#word-prev')?.addEventListener('click', () => go(-1));
    $('#word-next')?.addEventListener('click', () => go(1));
    $$('[data-word-mark]').forEach((button) => button.addEventListener('click', () => mark(button.dataset.wordMark)));

    $$('[data-word-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.wordTab)));

    $('#word-search')?.addEventListener('input', (event) => {
      listQuery = event.target.value;
      listPage = 1;
      renderList();
    });
    $('#word-letter')?.addEventListener('change', (event) => {
      listLetter = event.target.value;
      listPage = 1;
      renderList();
    });
    $('#word-status')?.addEventListener('change', (event) => {
      listStatus = event.target.value;
      listPage = 1;
      renderList();
    });

    $('#word-list')?.addEventListener('click', (event) => {
      const row = event.target.closest('[data-word-index]');
      if (!row) return;
      index = Number(row.dataset.wordIndex);
      setTab('cards');
      renderCard();
      $('#word-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('#word-pager')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-word-page]');
      if (!button || button.disabled) return;
      listPage = Number(button.dataset.wordPage);
      renderList();
    });

    $('#word-quiz')?.addEventListener('click', (event) => {
      if (event.target.closest('#quiz-start') || event.target.closest('#quiz-restart')) {
        quizStart();
        return;
      }
      const option = event.target.closest('[data-quiz-option]');
      if (option) answerQuiz(option);
    });

    document.addEventListener('keydown', (event) => {
      if (currentTab !== 'cards' || !allWords.length) return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if (tag === 'BUTTON' && document.activeElement !== $('#word-card')) return;
      if (event.code === 'Space' && document.activeElement === $('#word-card')) return;
      if (document.body.classList.contains('edit-map-active')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        flipCard();
      } else if (event.key === '1') mark('unknown');
      else if (event.key === '2') mark('fuzzy');
      else if (event.key === '3') mark('known');
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'ArrowRight') go(1);
    });
  }

  fetch('/words.json', { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then((data) => {
      allWords = Array.isArray(data) ? data : [];
      if (!allWords.length) {
        const front = $('#word-front');
        if (front) front.textContent = '暂无单词';
        return;
      }
      bindEvents();
      updateStats();
      renderCard();
      renderList();
      renderQuizStart();

      const params = new URLSearchParams(location.search);
      const tab = params.get('tab');
      if (['cards', 'list', 'quiz'].includes(tab)) setTab(tab);
      if (params.get('flip') === '1') flipCard();
      if (tab === 'quiz' && params.get('start') === '1') quizStart();
    })
    .catch((error) => {
      const front = $('#word-front');
      if (front) front.textContent = '单词加载失败';
      const list = $('#word-list');
      if (list) list.innerHTML = '<div class="word-empty">/words.json 没有加载出来，请确认本地服务器还在运行。</div>';
      console.warn('[words] load failed', error);
    });
})();
