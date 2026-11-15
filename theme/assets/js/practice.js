/* 晚风小筑 · 408 练习
   题库来自后端 /api/questions；登录后答题记录、错题本和统计按账号保存。 */
(() => {
  'use strict';

  const app = document.getElementById('practice-app');
  if (!app) return;

  const $ = (selector) => app.querySelector(selector);
  const $$ = (selector) => Array.from(app.querySelectorAll(selector));
  const esc = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const auth = window.BlogAuth;
  const state = {
    tab: 'sets',
    sets: [],
    set: null,
    index: 0,
    answers: new Map(),
    finished: false,
    selected: new Set(),
    loading: false,
    error: '',
    wrong: [],
    stats: null,
    recent: []
  };

  function api(path, options) {
    if (!auth) return Promise.reject(new Error('账号脚本没有加载'));
    return auth.api(path, options);
  }

  function setTab(tab) {
    state.tab = tab;
    $$('[data-practice-tab]').forEach((button) => {
      const active = button.dataset.practiceTab === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $$('[data-practice-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.practicePanel !== tab;
    });
    if (tab === 'sets') renderSets();
    if (tab === 'wrong') loadWrong();
    if (tab === 'stats') loadStats();
  }

  function loginBlock(message) {
    return `
      <div class="practice-empty">
        <p class="practice-empty-kicker">NEED ACCOUNT</p>
        <h2>${esc(message)}</h2>
        <p>登录后，答题记录会按账号保存，换设备也能接着刷，错题本和正确率统计才会工作。</p>
        <button class="btn-read" type="button" data-account-open>登录 / 注册</button>
      </div>`;
  }

  function loadingBlock(text) {
    return `<div class="practice-empty"><p class="practice-empty-kicker">LOADING</p><h2>${esc(text || '正在加载…')}</h2></div>`;
  }

  function errorBlock(message, retry) {
    return `
      <div class="practice-empty">
        <p class="practice-empty-kicker">ERROR</p>
        <h2>${esc(message)}</h2>
        <p>后端是否已经在 <code>server</code> 目录启动？默认地址是 <code>http://127.0.0.1:8080</code>。</p>
        <button class="btn-read" type="button" ${retry ? 'data-practice-retry' : ''}>再试一次</button>
      </div>`;
  }

  /* ---------------- 题库列表 ---------------- */

  async function loadSets(force) {
    if (state.sets.length && !force) {
      renderSets();
      return;
    }
    state.loading = true;
    state.error = '';
    renderSets();
    try {
      const sets = await api('/api/questions/sets');
      state.sets = Array.isArray(sets) ? sets : [];
    } catch (error) {
      state.error = error.message || '题库加载失败';
    } finally {
      state.loading = false;
      renderSets();
    }
  }

  function renderSets() {
    const panel = $('[data-practice-panel="sets"]');
    if (!panel) return;
    if (state.set) {
      renderRunner();
      return;
    }
    if (state.loading) {
      panel.innerHTML = loadingBlock('正在加载题库…');
      return;
    }
    if (state.error) {
      panel.innerHTML = errorBlock(state.error, true);
      return;
    }
    if (!state.sets.length) {
      panel.innerHTML = `
        <div class="practice-empty">
          <p class="practice-empty-kicker">EMPTY</p>
          <h2>还没有题库</h2>
          <p>用管理员账号登录后，在<a href="/admin.html">后台管理 → 408 题库</a>里粘贴 JSON 导入，或直接放一份题库文件。</p>
        </div>`;
      return;
    }

    const cards = state.sets.map((set) => `
      <article class="practice-set-card" data-practice-set="${set.id}">
        <div class="practice-set-top">
          <span class="practice-subject">${esc(set.subjectLabel || set.subject)}</span>
          ${set.year ? `<span class="practice-year">${set.year}</span>` : ''}
        </div>
        <h3>${esc(set.title)}</h3>
        <p>${esc(set.description || set.source || '点开开始练习')}</p>
        <div class="practice-set-foot">
          <span>${set.questionCount} 道题</span>
          <span class="practice-set-go">开始练习 →</span>
        </div>
      </article>`).join('');

    const loginTip = auth && auth.user
      ? `<p class="practice-note">当前账号：${esc(auth.displayName(auth.user))} · 答题会自动记录</p>`
      : `<p class="practice-note">未登录也可以答题，但不会保存记录。<button type="button" class="practice-inline-link" data-account-open>登录后保存进度</button></p>`;

    panel.innerHTML = `
      <div class="practice-sets-head">
        <h2>选择题库</h2>
        ${loginTip}
      </div>
      <div class="practice-set-grid">${cards}</div>`;
  }

  /* ---------------- 练习 ---------------- */

  async function openSet(id) {
    const panel = $('[data-practice-panel="sets"]');
    panel.innerHTML = loadingBlock('正在打开题库…');
    try {
      const detail = await api('/api/questions/sets/' + id);
      state.set = detail;
      state.index = 0;
      state.answers = new Map();
      state.finished = false;
      state.selected = new Set();
      renderRunner();
    } catch (error) {
      panel.innerHTML = errorBlock(error.message || '题库打开失败', false);
    }
  }

  function currentQuestion() {
    return state.set && state.set.questions[state.index];
  }

  function renderRunner() {
    const panel = $('[data-practice-panel="sets"]');
    const set = state.set;
    if (!panel || !set) return;

    if (state.finished) {
      renderResult();
      return;
    }
    const question = currentQuestion();
    if (!question) {
      state.finished = true;
      renderResult();
      return;
    }
    const answered = state.answers.get(question.id);
    const percent = Math.round((state.index / set.questions.length) * 100);
    const typeLabel = question.type === 'multiple' ? '多选题' : question.type === 'judge' ? '判断题' : '单选题';
    const options = question.options.map((option) => {
      let className = 'practice-option';
      if (answered) {
        if (option.key === answered.answer) className += ' is-correct';
        else if (option.key === answered.chosen && !answered.correct) className += ' is-wrong';
        className += ' is-locked';
      } else if (state.selected.has(option.key)) {
        className += ' is-selected';
      }
      return `
        <button class="${className}" type="button" data-practice-option="${esc(option.key)}" ${answered ? 'disabled' : ''}>
          <span class="practice-option-key">${esc(option.key)}</span>
          <span class="practice-option-text">${esc(option.text)}</span>
        </button>`;
    }).join('');

    const feedback = answered ? `
      <div class="practice-feedback ${answered.correct ? 'is-correct' : 'is-wrong'}">
        <p class="practice-feedback-title">${answered.correct ? '答对了' : '答错了'} · 正确答案 ${esc(answered.answer)}</p>
        ${answered.analysis ? `<p class="practice-analysis">${esc(answered.analysis)}</p>` : ''}
        ${question.knowledge ? `<p class="practice-knowledge">知识点：${esc(question.knowledge)}</p>` : ''}
      </div>` : '';

    const multipleSubmit = question.type === 'multiple' && !answered
      ? `<button class="btn-read practice-submit" type="button" data-practice-submit ${state.selected.size ? '' : 'disabled'}>提交答案</button>`
      : '';
    const nextButton = answered
      ? `<button class="btn-read practice-next" type="button" data-practice-next>${state.index + 1 >= set.questions.length ? '看结果' : '下一题'}</button>`
      : '';

    panel.innerHTML = `
      <div class="practice-runner">
        <div class="practice-runner-head">
          <button class="practice-back" type="button" data-practice-back>← 返回题库</button>
          <span class="practice-runner-title">${esc(set.title)}</span>
          <span class="practice-count">${state.index + 1} / ${set.questions.length}</span>
        </div>
        <div class="practice-progress"><span style="width:${percent}%"></span></div>
        <article class="practice-question">
          <p class="practice-qmeta">${typeLabel}${question.knowledge ? ' · ' + esc(question.knowledge) : ''} · 第 ${question.seq} 题</p>
          <div class="practice-stem">${esc(question.stem)}</div>
          <div class="practice-options">${options}</div>
          ${multipleSubmit}
          ${feedback}
          <div class="practice-actions">${nextButton}</div>
        </article>
      </div>`;
  }

  async function submitAnswer(chosen) {
    const question = currentQuestion();
    if (!question || state.answers.has(question.id)) return;
    const buttons = $$('[data-practice-option]');
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const result = await api('/api/questions/' + question.id + '/answer', {
        method: 'POST',
        body: JSON.stringify({ chosen })
      });
      state.answers.set(question.id, {
        chosen: result.chosen,
        correct: result.correct,
        answer: result.answer,
        analysis: result.analysis
      });
      renderRunner();
    } catch (error) {
      buttons.forEach((button) => { button.disabled = false; });
      auth.toast(error.message || '提交失败，请稍后再试');
    }
  }

  function nextQuestion() {
    if (!state.set) return;
    if (state.index + 1 >= state.set.questions.length) {
      state.finished = true;
      renderRunner();
      return;
    }
    state.index += 1;
    state.selected = new Set();
    renderRunner();
  }

  function renderResult() {
    const panel = $('[data-practice-panel="sets"]');
    const set = state.set;
    const total = set.questions.length;
    const correct = [...state.answers.values()].filter((item) => item.correct).length;
    const answered = state.answers.size;
    const percent = total ? Math.round((correct / total) * 100) : 0;
    const wrong = answered - correct;
    const saveHint = auth && auth.user
      ? `<p class="practice-note">本次记录已按账号保存，可在错题本和统计里查看。</p>`
      : `<p class="practice-note">本次没有保存：<button type="button" class="practice-inline-link" data-account-open>登录</button> 后重做一次即可记录。</p>`;

    panel.innerHTML = `
      <div class="practice-result">
        <p class="practice-empty-kicker">RESULT</p>
        <h2>${esc(set.title)}</h2>
        <div class="practice-score">
          <strong>${correct}</strong><span>/ ${total}</span>
          <em>${percent}%</em>
        </div>
        <p class="practice-result-line">答对 ${correct} 题，答错 ${wrong} 题，未作答 ${total - answered} 题。</p>
        ${saveHint}
        <div class="practice-result-actions">
          <button class="btn-read" type="button" data-practice-retry-set>再做一次</button>
          <button class="practice-back" type="button" data-practice-back>返回题库</button>
          <button class="practice-back" type="button" data-practice-goto-wrong>看错题本</button>
        </div>
      </div>`;
  }

  /* ---------------- 错题本 ---------------- */

  async function loadWrong() {
    const panel = $('[data-practice-panel="wrong"]');
    if (!auth || !auth.user) {
      panel.innerHTML = loginBlock('登录后才有错题本');
      return;
    }
    panel.innerHTML = loadingBlock('正在加载错题…');
    try {
      const items = await api('/api/practice/wrong-book');
      state.wrong = Array.isArray(items) ? items : [];
      renderWrong();
    } catch (error) {
      if (error.status === 401) {
        panel.innerHTML = loginBlock('登录后才有错题本');
        return;
      }
      panel.innerHTML = errorBlock(error.message || '错题本加载失败', false);
    }
  }

  function renderWrong() {
    const panel = $('[data-practice-panel="wrong"]');
    if (!state.wrong.length) {
      panel.innerHTML = `
        <div class="practice-empty">
          <p class="practice-empty-kicker">CLEAR</p>
          <h2>错题本是空的</h2>
          <p>去题库做几道题，答错的题会自动出现在这里。</p>
          <button class="btn-read" type="button" data-practice-goto-sets>去练习</button>
        </div>`;
      return;
    }
    const items = state.wrong.map((item, index) => `
      <article class="wrong-item">
        <header>
          <span class="practice-subject">${esc(item.subjectLabel || item.subject)}</span>
          <span class="wrong-index">#${index + 1}</span>
          <span class="wrong-count">错 ${item.wrongCount} 次</span>
        </header>
        <div class="wrong-stem">${esc(item.stem)}</div>
        <div class="wrong-options">
          ${item.options.map((option) => `
            <div class="wrong-option ${option.key === item.answer ? 'is-correct' : ''} ${option.key === item.chosen && item.chosen !== item.answer ? 'is-chosen' : ''}">
              <span>${esc(option.key)}</span>${esc(option.text)}
            </div>`).join('')}
        </div>
        <p class="wrong-answer">你选了 <b>${esc(item.chosen || '—')}</b>，正确答案 <b>${esc(item.answer)}</b>${
          item.setTitle ? ` · ${esc(item.setTitle)}` : ''}</p>
        ${item.analysis ? `<details class="wrong-analysis"><summary>看解析</summary><p>${esc(item.analysis)}</p></details>` : ''}
      </article>`).join('');

    panel.innerHTML = `
      <div class="practice-sets-head">
        <h2>错题本 · ${state.wrong.length} 题</h2>
        <p class="practice-note">显示每道题最近一次作答结果；重新答对后会自动移出错题本。</p>
      </div>
      <div class="wrong-list">${items}</div>`;
  }

  /* ---------------- 统计 ---------------- */

  async function loadStats() {
    const panel = $('[data-practice-panel="stats"]');
    if (!auth || !auth.user) {
      panel.innerHTML = loginBlock('登录后才能看练习统计');
      return;
    }
    panel.innerHTML = loadingBlock('正在统计…');
    try {
      const [stats, recent] = await Promise.all([
        api('/api/practice/stats'),
        api('/api/practice/recent?limit=12')
      ]);
      state.stats = stats;
      state.recent = Array.isArray(recent) ? recent : [];
      renderStats();
    } catch (error) {
      if (error.status === 401) {
        panel.innerHTML = loginBlock('登录后才能看练习统计');
        return;
      }
      panel.innerHTML = errorBlock(error.message || '统计加载失败', false);
    }
  }

  function renderStats() {
    const panel = $('[data-practice-panel="stats"]');
    const stats = state.stats;
    if (!stats) return;
    const subjects = (stats.subjects || []).map((item) => {
      const rate = item.total ? Math.round((item.correct / item.total) * 100) : 0;
      return `
        <div class="stat-subject">
          <div class="stat-subject-head">
            <span>${esc(item.subjectLabel || item.subject)}</span>
            <span>${item.correct} / ${item.total} · ${rate}%</span>
          </div>
          <div class="stat-bar"><span style="width:${rate}%"></span></div>
        </div>`;
    }).join('') || '<p class="practice-note">还没有分科数据。</p>';

    const recent = state.recent.length
      ? state.recent.map((item) => `
          <li class="stat-recent-item ${item.correct ? 'is-correct' : 'is-wrong'}">
            <span class="stat-recent-mark">${item.correct ? '✓' : '✗'}</span>
            <span class="stat-recent-stem">${esc(item.stem)}</span>
            <span class="stat-recent-set">${esc(item.setTitle || '')}</span>
          </li>`).join('')
      : '<li class="practice-note">还没有作答记录。</li>';

    panel.innerHTML = `
      <div class="practice-stats">
        <div class="stat-grid">
          <div class="stat-card"><strong>${stats.total}</strong><span>总答题</span></div>
          <div class="stat-card"><strong>${stats.correct}</strong><span>答对</span></div>
          <div class="stat-card"><strong>${stats.accuracy}%</strong><span>正确率</span></div>
          <div class="stat-card"><strong>${stats.wrongQuestions}</strong><span>错题</span></div>
        </div>
        <section class="stat-block">
          <h3>分科正确率</h3>
          <div class="stat-subjects">${subjects}</div>
        </section>
        <section class="stat-block">
          <h3>最近作答</h3>
          <ul class="stat-recent">${recent}</ul>
        </section>
      </div>`;
  }

  /* ---------------- 事件 ---------------- */

  app.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-practice-tab]');
    if (tab) {
      setTab(tab.dataset.practiceTab);
      return;
    }
    const setCard = event.target.closest('[data-practice-set]');
    if (setCard) {
      openSet(setCard.dataset.practiceSet);
      return;
    }
    if (event.target.closest('[data-practice-back]')) {
      state.set = null;
      state.finished = false;
      renderSets();
      return;
    }
    if (event.target.closest('[data-practice-retry]')) {
      loadSets(true);
      return;
    }
    if (event.target.closest('[data-practice-retry-set]')) {
      state.index = 0;
      state.answers = new Map();
      state.finished = false;
      state.selected = new Set();
      renderRunner();
      return;
    }
    if (event.target.closest('[data-practice-next]')) {
      nextQuestion();
      return;
    }
    if (event.target.closest('[data-practice-goto-wrong]')) {
      setTab('wrong');
      return;
    }
    if (event.target.closest('[data-practice-goto-sets]')) {
      state.set = null;
      setTab('sets');
      return;
    }
    if (event.target.closest('[data-practice-submit]')) {
      if (state.selected.size) submitAnswer([...state.selected].sort().join(''));
      return;
    }
    const option = event.target.closest('[data-practice-option]');
    if (option && !option.disabled) {
      const question = currentQuestion();
      if (!question) return;
      if (question.type === 'multiple') {
        const key = option.dataset.practiceOption;
        if (state.selected.has(key)) state.selected.delete(key);
        else state.selected.add(key);
        renderRunner();
        return;
      }
      submitAnswer(option.dataset.practiceOption);
    }
  });

  if (auth) {
    auth.onChange(() => {
      if (state.tab === 'wrong') loadWrong();
      if (state.tab === 'stats') loadStats();
      if (state.tab === 'sets' && !state.set) renderSets();
    });
  }

  loadSets(true);
})();
