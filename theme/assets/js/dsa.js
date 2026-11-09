/* 数据结构最小闭环：知识图谱 + 练习 + 错题 + 复习 */
(() => {
  'use strict';

  const app = document.getElementById('dsa-app');
  if (!app) return;

  const $ = (sel) => app.querySelector(sel);
  const PROGRESS_KEY = 'wanfeng:dsa:progress';
  const WRONG_KEY = 'wanfeng:dsa:wrong';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let data = null;
  let selected = '';
  let progress = {};
  let wrong = new Set();
  let quiz = null;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  };

  const saveState = () => {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      localStorage.setItem(WRONG_KEY, JSON.stringify([...wrong]));
    } catch (error) {
      /* 隐私模式下不阻塞页面 */
    }
  };

  const getProgress = (id) => progress[id] || { correct: 0, total: 0 };
  const ratio = (id) => {
    const p = getProgress(id);
    return p.total ? p.correct / p.total : 0;
  };
  const mastery = (id) => {
    const p = getProgress(id);
    if (!p.total) return 'none';
    return p.total >= 3 && p.correct / p.total >= 0.8 ? 'strong' : 'learning';
  };
  const masteryLabel = (id) => ({ none: '未开始', learning: '学习中', strong: '已掌握' }[mastery(id)]);
  const nodeById = (id) => data.nodes.find((node) => node.id === id);

  function renderStats() {
    const mastered = data.nodes.filter((node) => mastery(node.id) === 'strong').length;
    const answered = Object.values(progress).reduce((sum, item) => sum + (item.total || 0), 0);
    $('#dsa-mastered').textContent = mastered;
    $('#dsa-answered').textContent = answered;
    $('#dsa-wrong').textContent = wrong.size;
  }

  function renderGraph() {
    const svg = $('#dsa-graph');
    svg.innerHTML = '';
    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = '<marker id="dsa-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#cec3b5"/></marker>';
    svg.appendChild(defs);

    const byId = new Map(data.nodes.map((node) => [node.id, node]));
    data.edges.forEach(([from, to]) => {
      const a = byId.get(from);
      const b = byId.get(to);
      if (!a || !b) return;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', a.x);
      line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x);
      line.setAttribute('y2', b.y);
      line.setAttribute('stroke', '#d8cec0');
      line.setAttribute('stroke-width', '1.3');
      line.setAttribute('marker-end', 'url(#dsa-arrow)');
      svg.appendChild(line);
    });

    data.nodes.forEach((node) => {
      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('data-id', node.id);
      group.setAttribute('class', `dsa-node is-${mastery(node.id)}${selected === node.id ? ' is-selected' : ''}`);
      group.setAttribute('transform', `translate(${node.x} ${node.y})`);
      group.innerHTML = `
        <circle r="29"></circle>
        <text text-anchor="middle" dominant-baseline="middle">${escapeHtml(node.name)}</text>
        <title>${escapeHtml(node.name)} · ${masteryLabel(node.id)}</title>`;
      svg.appendChild(group);
    });
    $('#dsa-map-count').textContent = `${data.nodes.length} 个知识点`;
  }

  function renderDaily() {
    const box = $('#dsa-daily');
    const weak = data.nodes.find((node) => {
      const p = getProgress(node.id);
      return !p.total || p.correct / p.total < 0.8;
    }) || data.nodes[0];
    const p = getProgress(weak.id);
    box.innerHTML = `
      <div>
        <span class="dsa-daily-kicker">今日任务 · 约 10 分钟</span>
        <strong>${p.total ? '复习' : '开始'}「${escapeHtml(weak.name)}」</strong>
        <span class="dsa-daily-note">${p.total ? `当前正确率 ${Math.round((p.correct / p.total) * 100)}%` : '先做一组 4 题，看看哪里卡住'}</span>
      </div>
      <button class="dsa-btn is-primary" type="button" data-daily-start="${escapeHtml(weak.id)}">开始</button>`;
  }

  function renderConcept() {
    const node = nodeById(selected);
    const box = $('#dsa-concept');
    if (!node) {
      box.innerHTML = '<p class="dsa-empty">选择一个知识点开始。</p>';
      return;
    }
    const p = getProgress(node.id);
    const state = mastery(node.id);
    box.innerHTML = `
      <div class="dsa-concept-head">
        <span class="dsa-chapter">${escapeHtml(node.chapter)}</span>
        <span class="dsa-mastery is-${state}">${masteryLabel(node.id)}${p.total ? ` · ${p.correct}/${p.total}` : ''}</span>
      </div>
      <h2>${escapeHtml(node.name)}</h2>
      <p class="dsa-summary">${escapeHtml(node.summary)}</p>
      <div class="dsa-points">
        <strong>关键点</strong>
        <ul>${node.points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
      </div>
      <div class="dsa-complexity"><span>复杂度</span>${escapeHtml(node.complexity)}</div>
      <div class="dsa-traps"><strong>常见坑</strong>${node.traps.map((trap) => `<span>${escapeHtml(trap)}</span>`).join('')}</div>
      <div class="dsa-actions">
        <button class="dsa-btn is-primary" type="button" data-start-quiz="${escapeHtml(node.id)}">练 4 题</button>
        <button class="dsa-btn" type="button" data-review-quiz="${escapeHtml(node.id)}" ${wrong.size ? '' : 'disabled'}>复习错题</button>
      </div>`;
  }

  function selectNode(id) {
    selected = id;
    quiz = null;
    renderGraph();
    renderConcept();
    renderDaily();
    $('#dsa-quiz').innerHTML = '';
    document.querySelectorAll('.dsa-node').forEach((node) => {
      node.classList.toggle('is-selected', node.dataset.id === id);
    });
  }

  function startQuiz(conceptId, reviewOnly = false) {
    let questions = data.questions.filter((question) => question.concept === conceptId);
    if (reviewOnly) questions = questions.filter((question) => wrong.has(question.id));
    if (!questions.length) {
      $('#dsa-quiz').innerHTML = `<div class="dsa-quiz-empty">这个知识点暂时没有${reviewOnly ? '错题' : '题目'}。</div>`;
      return;
    }
    quiz = {
      conceptId,
      questions,
      index: 0,
      correct: 0,
      answered: false,
      selectedAnswer: null,
      reviewOnly
    };
    renderQuiz();
    $('#dsa-quiz').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function recordAnswer(question, isCorrect) {
    const p = getProgress(question.concept);
    p.total += 1;
    if (isCorrect) p.correct += 1;
    progress[question.concept] = p;
    if (isCorrect) wrong.delete(question.id);
    else wrong.add(question.id);
    saveState();
    renderStats();
    renderDaily();
  }

  function renderQuiz() {
    const box = $('#dsa-quiz');
    if (!quiz) {
      box.innerHTML = '';
      return;
    }
    const question = quiz.questions[quiz.index];
    const answered = quiz.answered;
    const options = question.options.map((option, index) => {
      let cls = 'dsa-option';
      if (answered && index === question.answer) cls += ' is-correct';
      if (answered && index === quiz.selectedAnswer && index !== question.answer) cls += ' is-wrong';
      return `<button class="${cls}" type="button" data-answer="${index}" ${answered ? 'disabled' : ''}>${String.fromCharCode(65 + index)}. ${escapeHtml(option)}</button>`;
    }).join('');

    const last = quiz.index === quiz.questions.length - 1;
    box.innerHTML = `
      <div class="dsa-quiz-head">
        <div><span class="dsa-quiz-kicker">随学随测</span><strong>${escapeHtml(nodeById(quiz.conceptId).name)}</strong></div>
        <span>${quiz.index + 1} / ${quiz.questions.length}</span>
      </div>
      <div class="dsa-quiz-progress"><span style="width:${((quiz.index + 1) / quiz.questions.length) * 100}%"></span></div>
      <h3>${escapeHtml(question.question)}</h3>
      <div class="dsa-options">${options}</div>
      ${answered ? `<div class="dsa-explain is-${quiz.selectedAnswer === question.answer ? 'correct' : 'wrong'}">
        <strong>${quiz.selectedAnswer === question.answer ? '答对了' : '答错了'}</strong>
        <p>${escapeHtml(question.explain)}</p>
      </div>` : ''}
      ${answered ? `<div class="dsa-quiz-actions">
        <button class="dsa-btn is-primary" type="button" data-quiz-next>${last ? '完成练习' : '下一题'}</button>
      </div>` : ''}`;

    if (!answered) {
      box.querySelectorAll('[data-answer]').forEach((button) => {
        button.addEventListener('click', () => {
          if (quiz.answered) return;
          const index = Number(button.dataset.answer);
          quiz.selectedAnswer = index;
          quiz.answered = true;
          const isCorrect = index === question.answer;
          if (isCorrect) quiz.correct += 1;
          recordAnswer(question, isCorrect);
          renderQuiz();
        });
      });
    } else {
      box.querySelector('[data-quiz-next]').addEventListener('click', () => {
        if (quiz.index < quiz.questions.length - 1) {
          quiz.index += 1;
          quiz.answered = false;
          quiz.selectedAnswer = null;
          renderQuiz();
        } else {
          showResult();
        }
      });
    }
  }

  function showResult() {
    const total = quiz.questions.length;
    const correct = quiz.correct;
    const box = $('#dsa-quiz');
    box.innerHTML = `
      <div class="dsa-result">
        <span class="dsa-quiz-kicker">练习完成</span>
        <strong>${correct} / ${total}</strong>
        <p>${correct === total ? '这一组全对，可以换下一个知识点了。' : '错题已经进入错题本，建议明天再复习一次。'}</p>
        <div class="dsa-actions">
          <button class="dsa-btn is-primary" type="button" data-quiz-again>再练一组</button>
          <button class="dsa-btn" type="button" data-quiz-close>回到图谱</button>
        </div>
      </div>`;
    box.querySelector('[data-quiz-again]').addEventListener('click', () => startQuiz(quiz.conceptId, quiz.reviewOnly));
    box.querySelector('[data-quiz-close]').addEventListener('click', () => {
      quiz = null;
      box.innerHTML = '';
      renderGraph();
      renderConcept();
    });
    renderGraph();
    renderConcept();
  }

  app.addEventListener('click', (event) => {
    const node = event.target.closest('.dsa-node');
    if (node) {
      selectNode(node.dataset.id);
      return;
    }
    const daily = event.target.closest('[data-daily-start]');
    if (daily) {
      selectNode(daily.dataset.dailyStart);
      startQuiz(daily.dataset.dailyStart);
      return;
    }
    const start = event.target.closest('[data-start-quiz]');
    if (start) {
      startQuiz(start.dataset.startQuiz);
      return;
    }
    const review = event.target.closest('[data-review-quiz]');
    if (review) {
      startQuiz(review.dataset.reviewQuiz, true);
    }
  });

  (async () => {
    try {
      progress = readJson(PROGRESS_KEY, {});
      wrong = new Set(readJson(WRONG_KEY, []));
      data = await fetch('/dsa.json').then((response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      });
      const params = new URLSearchParams(location.search);
      const requested = params.get('concept');
      selected = data.nodes.some((node) => node.id === requested) ? requested : data.nodes[0].id;
      renderGraph();
      renderStats();
      renderConcept();
      renderDaily();
      if (params.get('start') === '1') startQuiz(selected);
    } catch (error) {
      console.error(error);
      $('#dsa-concept').innerHTML = '<p class="dsa-empty">学习数据加载失败，请刷新页面。</p>';
    }
  })();
})();
