/* 数据结构知识图谱可视化诊断 Demo */
(() => {
  'use strict';

  const app = document.getElementById('dsa-app');
  if (!app) return;

  const $ = (sel) => app.querySelector(sel);
  const PROGRESS_KEY = 'wanfeng:dsa:progress';
  const WRONG_KEY = 'wanfeng:dsa:wrong';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ERROR_LABELS = {
    concept: '概念理解',
    calculation: '计算/复杂度',
    reading: '代码阅读',
    method: '方法选择'
  };

  let data = null;
  let selected = '';
  let progress = {};
  let wrong = new Set();
  let quiz = null;
  let demoMode = false;
  let demoProfile = null;
  let demoStudents = [];

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
  const actualRatio = (id) => {
    const p = getProgress(id);
    return p.total ? p.correct / p.total : 0;
  };
  const displayRatio = (id) => demoMode && demoProfile ? demoProfile.mastery[id] : actualRatio(id);
  const displayMastery = (id) => {
    const value = displayRatio(id);
    if (!demoMode) {
      const p = getProgress(id);
      if (!p.total) return 'none';
      return p.total >= 3 && p.correct / p.total >= 0.8 ? 'strong' : 'learning';
    }
    if (value >= 0.8) return 'strong';
    return value > 0 ? 'learning' : 'none';
  };
  const masteryLabel = (id) => ({ none: '未开始', learning: '学习中', strong: '已掌握' }[displayMastery(id)]);
  const nodeById = (id) => data.nodes.find((node) => node.id === id);

  const seeded = (seed) => {
    const value = Math.sin(seed * 12.9898) * 43758.5453;
    return value - Math.floor(value);
  };

  function buildDemoData() {
    const base = {
      array: 0.82,
      'linked-list': 0.68,
      stack: 0.74,
      queue: 0.63,
      'binary-tree': 0.59,
      bst: 0.48,
      heap: 0.44,
      'graph-traversal': 0.39,
      'binary-search': 0.55,
      sorting: 0.42
    };
    demoProfile = {
      name: '演示学生',
      mastery: Object.fromEntries(data.nodes.map((node) => [node.id, Math.max(0.08, Math.min(0.96, base[node.id] || 0.5))])),
      answered: 96,
      wrong: 14,
      errorCounts: { concept: 3, calculation: 5, reading: 2, method: 4 }
    };
    demoStudents = Array.from({ length: 30 }, (_, index) => {
      const ability = 0.38 + seeded(index + 1) * 0.4;
      const mastery = {};
      data.nodes.forEach((node, nodeIndex) => {
        const noise = (seeded((index + 1) * 13 + nodeIndex) - 0.5) * 0.36;
        mastery[node.id] = Math.max(0.05, Math.min(0.98, ability + noise + ((base[node.id] || 0.5) - 0.55) * 0.7));
      });
      return {
        id: `S${String(index + 1).padStart(2, '0')}`,
        group: index < 15 ? 'A' : 'B',
        mastery,
        errorCounts: {
          concept: Math.round(1 + seeded(index + 31) * 4),
          calculation: Math.round(1 + seeded(index + 61) * 5),
          reading: Math.round(seeded(index + 91) * 3),
          method: Math.round(seeded(index + 121) * 4)
        }
      };
    });
  }

  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const studentAverage = (student) => average(Object.values(student.mastery));
  const errorCountsFor = (id) => {
    if (demoMode && demoProfile) {
      const nodeQuestions = data.questions.filter((question) => question.concept === id);
      return Object.fromEntries(Object.keys(ERROR_LABELS).map((key) => {
        const ratio = demoProfile.errorCounts[key] / 14;
        return [key, Math.max(0, Math.round(nodeQuestions.length * ratio + (key === 'calculation' ? 1 : 0)))];
      }));
    }
    const counts = Object.fromEntries(Object.keys(ERROR_LABELS).map((key) => [key, 0]));
    data.questions
      .filter((question) => question.concept === id && wrong.has(question.id))
      .forEach((question) => {
        const type = ERROR_LABELS[question.errorType] ? question.errorType : 'concept';
        counts[type] += 1;
      });
    return counts;
  };

  function renderStats() {
    if (demoMode && demoProfile) {
      const mastered = data.nodes.filter((node) => displayMastery(node.id) === 'strong').length;
      $('#dsa-mastered').textContent = mastered;
      $('#dsa-answered').textContent = demoProfile.answered;
      $('#dsa-wrong').textContent = demoProfile.wrong;
      return;
    }
    const mastered = data.nodes.filter((node) => displayMastery(node.id) === 'strong').length;
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
      const radius = 22 + (Number(node.importance) || 3) * 2.4;
      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('data-id', node.id);
      group.setAttribute('class', `dsa-node is-${displayMastery(node.id)}${selected === node.id ? ' is-selected' : ''}`);
      group.setAttribute('transform', `translate(${node.x} ${node.y})`);
      group.innerHTML = `
        <circle r="${radius}"></circle>
        <text text-anchor="middle" dominant-baseline="middle">${escapeHtml(node.name)}</text>
        <title>${escapeHtml(node.name)} · ${masteryLabel(node.id)} · 权重 ${node.importance || 3}</title>`;
      svg.appendChild(group);
    });
    $('#dsa-map-count').textContent = `${data.nodes.length} 个知识点`;
  }

  function renderDaily() {
    const box = $('#dsa-daily');
    const weak = data.nodes.find((node) => displayRatio(node.id) < 0.8) || data.nodes[0];
    const value = displayRatio(weak.id);
    box.innerHTML = `
      <div>
        <span class="dsa-daily-kicker">今日任务 · 约 10 分钟</span>
        <strong>${value > 0 ? '复习' : '开始'}「${escapeHtml(weak.name)}」</strong>
        <span class="dsa-daily-note">${value > 0 ? `当前掌握度 ${Math.round(value * 100)}%` : '先做一组 4 题，看看哪里卡住'}</span>
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
    const value = displayRatio(node.id);
    const state = displayMastery(node.id);
    const hasWrong = data.questions.some((question) => question.concept === node.id && wrong.has(question.id));
    box.innerHTML = `
      <div class="dsa-concept-head">
        <span class="dsa-chapter">${escapeHtml(node.chapter)}${demoMode ? ' · 演示学生' : ''}</span>
        <span class="dsa-mastery is-${state}">${masteryLabel(node.id)}${demoMode ? ` · ${Math.round(value * 100)}%` : ''}</span>
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
        <button class="dsa-btn" type="button" data-review-quiz="${escapeHtml(node.id)}" ${hasWrong ? '' : 'disabled'}>复习错题</button>
      </div>`;
  }

  function renderDiagnosis() {
    const box = $('#dsa-diagnosis');
    const node = nodeById(selected);
    if (!node) {
      box.innerHTML = '';
      return;
    }
    const value = displayRatio(node.id);
    const errors = errorCountsFor(node.id);
    const totalErrors = Object.values(errors).reduce((sum, count) => sum + count, 0);
    const topError = Object.entries(errors).sort((a, b) => b[1] - a[1])[0];
    const prerequisites = data.edges
      .filter(([, to]) => to === node.id)
      .map(([from]) => nodeById(from))
      .filter(Boolean);
    const nextNode = data.nodes
      .filter((item) => item.id !== node.id && displayRatio(item.id) < 0.65)
      .sort((a, b) => displayRatio(a.id) - displayRatio(b.id))[0] || node;
    const weakPrereq = prerequisites.find((item) => displayRatio(item.id) < 0.6);
    const verdict = value >= 0.8
      ? '掌握度较高，可以进入下一个知识点或做综合题。'
      : weakPrereq
        ? `当前卡点可能不在「${node.name}」本身，而是前置「${weakPrereq.name}」没有打牢。`
        : value < 0.45
          ? '掌握度偏低，建议先看关键点，再做一组基础题。'
          : '基础还不稳定，优先重做错题，再做变式题。';
    const recommendation = weakPrereq
      ? `先补「${weakPrereq.name}」，再回到「${node.name}」；下一次练习从错题开始。`
      : value >= 0.8
        ? `进入「${nextNode.name}」；保持每 2 天一次短复习。`
        : `先完成「${node.name}」的一组错题变式，再进入「${nextNode.name}」。`;
    const bars = Object.entries(errors).map(([key, count]) => {
      const pct = totalErrors ? Math.round((count / totalErrors) * 100) : 0;
      return `<div class="diag-error-row">
        <span>${ERROR_LABELS[key]}</span>
        <i><b style="width:${pct}%"></b></i>
        <em>${count}</em>
      </div>`;
    }).join('');

    box.innerHTML = `
      <div class="diag-head">
        <div><span class="dsa-quiz-kicker">可视化诊断</span><h3>${escapeHtml(node.name)} · 学习诊断</h3></div>
        <strong class="diag-score">${Math.round(value * 100)}<small>%</small></strong>
      </div>
      <div class="diag-body">
        <div class="diag-column">
          <span class="diag-label">错因分布</span>
          <div class="diag-errors">${totalErrors ? bars : '<p class="diag-empty">做几道题后，这里会出现错因分布。</p>'}</div>
        </div>
        <div class="diag-column">
          <span class="diag-label">前置知识</span>
          <div class="diag-prereq">${prerequisites.length ? prerequisites.map((item) => `
            <span class="${displayRatio(item.id) < 0.6 ? 'is-weak' : 'is-ok'}">${escapeHtml(item.name)} · ${Math.round(displayRatio(item.id) * 100)}%</span>`).join('') : '<span class="is-ok">当前是起点</span>'}</div>
        </div>
      </div>
      <div class="diag-verdict">
        <strong>诊断结论</strong>
        <p>${escapeHtml(verdict)}</p>
      </div>
      <div class="diag-next">
        <span>下一步</span>
        <strong>${escapeHtml(recommendation)}</strong>
      </div>`;
  }

  function renderTeacher() {
    const summaries = $('#teacher-summary');
    const heatmap = $('#teacher-heatmap');
    const bottleneck = $('#teacher-bottleneck');
    const risk = $('#teacher-risk');
    if (!demoStudents.length) return;

    const studentAverages = demoStudents.map(studentAverage);
    const classAverage = average(studentAverages);
    const atRisk = demoStudents.filter((student) => studentAverage(student) < 0.55);
    const conceptStats = data.nodes.map((node) => {
      const values = demoStudents.map((student) => student.mastery[node.id]);
      return {
        node,
        avg: average(values),
        weak: values.filter((value) => value < 0.6).length
      };
    }).sort((a, b) => a.avg - b.avg);

    summaries.innerHTML = `
      <article><span>模拟班级</span><strong>30</strong><small>名学生</small></article>
      <article><span>班级平均掌握</span><strong>${Math.round(classAverage * 100)}<small>%</small></strong><small>A/B 两组各 15 人</small></article>
      <article><span>需要关注</span><strong>${atRisk.length}</strong><small>平均掌握 &lt; 55%</small></article>
      <article><span>最薄弱知识点</span><strong>${escapeHtml(conceptStats[0].node.name)}</strong><small>${Math.round(conceptStats[0].avg * 100)}%</small></article>`;

    heatmap.innerHTML = `<div class="teacher-heat-head"><span>知识点</span><span>平均掌握</span><span>未掌握人数</span></div>
      ${conceptStats.map(({ node, avg, weak }) => `
        <div class="teacher-heat-row">
          <span class="teacher-heat-name"><i class="dot ${avg >= 0.8 ? 'dot-strong' : avg >= 0.5 ? 'dot-learning' : 'dot-none'}"></i>${escapeHtml(node.name)}</span>
          <span class="teacher-heat-bar"><i style="width:${Math.round(avg * 100)}%"></i><em>${Math.round(avg * 100)}%</em></span>
          <span class="teacher-heat-weak">${weak} / 30</span>
        </div>`).join('')}`;

    bottleneck.innerHTML = conceptStats.slice(0, 5).map(({ node, avg }) => `
      <div class="teacher-rank">
        <span>${escapeHtml(node.name)}</span>
        <i><b style="width:${Math.round(avg * 100)}%"></b></i>
        <em>${Math.round(avg * 100)}%</em>
      </div>`).join('');

    const riskStudents = demoStudents
      .map((student) => ({ student, avg: studentAverage(student) }))
      .filter((item) => item.avg < 0.55)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 6);
    risk.innerHTML = riskStudents.length ? riskStudents.map(({ student, avg }) => {
      const weakest = data.nodes
        .map((node) => ({ node, value: student.mastery[node.id] }))
        .sort((a, b) => a.value - b.value)[0];
      return `<div class="teacher-risk-row">
        <strong>${student.id}</strong>
        <span>${student.group} 组</span>
        <em>${Math.round(avg * 100)}%</em>
        <small>最弱：${escapeHtml(weakest.node.name)}</small>
      </div>`;
    }).join('') : '<p class="diag-empty">暂无需要重点关注的学生。</p>';
  }

  function setView(view) {
    const tabs = app.querySelectorAll('[data-view]');
    tabs.forEach((tab) => {
      const active = tab.dataset.view === view;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    ['student', 'teacher', 'experiment'].forEach((name) => {
      const element = $(`#${name}-view`);
      if (element) element.hidden = name !== view;
    });
    if (view === 'teacher') renderTeacher();
  }

  function selectNode(id) {
    selected = id;
    quiz = null;
    renderGraph();
    renderConcept();
    renderDiagnosis();
    renderDaily();
    $('#dsa-quiz').innerHTML = '';
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
    renderDiagnosis();
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
      renderDiagnosis();
    });
    renderGraph();
    renderConcept();
    renderDiagnosis();
  }

  app.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-view]');
    if (tab) {
      setView(tab.dataset.view);
      return;
    }
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
      demoMode = params.get('demo') === '1';
      buildDemoData();
      const requested = params.get('concept');
      selected = data.nodes.some((node) => node.id === requested) ? requested : data.nodes[0].id;
      if (demoMode) $('#dsa-demo-note')?.classList.add('is-demo');
      renderGraph();
      renderStats();
      renderConcept();
      renderDiagnosis();
      renderDaily();
      const requestedView = params.get('view');
      if (['student', 'teacher', 'experiment'].includes(requestedView)) setView(requestedView);
      if (params.get('start') === '1') startQuiz(selected);
    } catch (error) {
      console.error(error);
      $('#dsa-concept').innerHTML = '<p class="dsa-empty">学习数据加载失败，请刷新页面。</p>';
    }
  })();
})();
