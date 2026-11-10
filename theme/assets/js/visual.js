/* 数据结构 · 可视化实验室：知识地图 + 完成度 + 算法动画 */
(() => {
  'use strict';

  const app = document.getElementById('visual-app');
  if (!app) return;

  const $ = (sel) => app.querySelector(sel);
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DEMO = {
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
  const BS_ARRAY = [3, 8, 12, 17, 23, 31, 39, 45, 52, 60, 68, 75];
  const BS_TARGET = 23;
  const BS_STEPS = [
    { low: 0, high: 11, mid: 5, found: false, message: 'mid = 5，a[5] = 31 > 23，排除右半区。' },
    { low: 0, high: 4, mid: 2, found: false, message: 'mid = 2，a[2] = 12 < 23，排除左半区。' },
    { low: 3, high: 4, mid: 3, found: false, message: 'mid = 3，a[3] = 17 < 23，继续向右。' },
    { low: 4, high: 4, mid: 4, found: true, message: 'mid = 4，a[4] = 23，找到目标。' }
  ];

  let data = null;
  let selected = 'binary-search';
  let demoMode = true;
  let progress = {};
  let bsIndex = 0;
  let bsTimer = null;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const readProgress = () => {
    try {
      return JSON.parse(localStorage.getItem('wanfeng:dsa:progress') || '{}');
    } catch (error) {
      return {};
    }
  };

  const nodeById = (id) => data.nodes.find((node) => node.id === id);
  const valueOf = (id) => {
    if (demoMode) return DEMO[id] || 0;
    const item = progress[id] || {};
    return item.total ? item.correct / item.total : 0;
  };
  const stateOf = (id) => {
    const value = valueOf(id);
    if (value >= 0.8) return 'strong';
    return value > 0 ? 'learning' : 'none';
  };
  const stateLabel = (id) => ({ none: '未开始', learning: '学习中', strong: '已掌握' }[stateOf(id)]);

  function renderGraph() {
    const svg = $('#viz-graph');
    svg.innerHTML = '';
    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = '<marker id="viz-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#d4c8b9"/></marker>';
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
      line.setAttribute('stroke-width', '1.35');
      line.setAttribute('marker-end', 'url(#viz-arrow)');
      svg.appendChild(line);
    });

    data.nodes.forEach((node) => {
      const value = valueOf(node.id);
      const radius = 24 + (Number(node.importance) || 3) * 2.2;
      const circumference = 2 * Math.PI * (radius + 7);
      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('data-id', node.id);
      group.setAttribute('class', `viz-node is-${stateOf(node.id)}${selected === node.id ? ' is-selected' : ''}`);
      group.setAttribute('transform', `translate(${node.x} ${node.y})`);
      group.innerHTML = `
        <circle class="viz-node-ring-bg" r="${radius + 7}"></circle>
        <circle class="viz-node-ring" r="${radius + 7}" stroke-dasharray="${(circumference * value).toFixed(2)} ${circumference.toFixed(2)}" transform="rotate(-90)"></circle>
        <circle class="viz-node-core" r="${radius}"></circle>
        <text text-anchor="middle" dominant-baseline="middle">${escapeHtml(node.name)}</text>
        <title>${escapeHtml(node.name)} · ${stateLabel(node.id)} · ${Math.round(value * 100)}%</title>`;
      svg.appendChild(group);
    });
  }

  function renderProgress() {
    const values = data.nodes.map((node) => valueOf(node.id));
    const overall = values.reduce((sum, value) => sum + value, 0) / values.length;
    const mastered = data.nodes.filter((node) => valueOf(node.id) >= 0.8).length;
    const circumference = 2 * Math.PI * 56;
    const ring = $('#viz-ring-value');
    if (ring) {
      ring.style.strokeDasharray = String(circumference);
      ring.style.strokeDashoffset = String(circumference * (1 - overall));
    }
    $('#viz-ring-text').textContent = Math.round(overall * 100) + '%';
    $('#viz-mastered-count').textContent = `${mastered} / ${data.nodes.length}`;
    $('#viz-average-note').textContent = `平均掌握度 ${Math.round(overall * 100)}%`;
    app.querySelector('.viz-demo-badge').textContent = demoMode ? '演示数据' : '我的进度';

    const groups = new Map();
    data.nodes.forEach((node) => {
      if (!groups.has(node.chapter)) groups.set(node.chapter, []);
      groups.get(node.chapter).push(valueOf(node.id));
    });
    $('#viz-chapters').innerHTML = [...groups.entries()].map(([chapter, items]) => {
      const avg = items.reduce((sum, value) => sum + value, 0) / items.length;
      return `<div class="viz-chapter-row">
        <span>${escapeHtml(chapter)}</span>
        <i><b style="width:${Math.round(avg * 100)}%"></b></i>
        <em>${Math.round(avg * 100)}%</em>
      </div>`;
    }).join('');

    $('#viz-heat').innerHTML = data.nodes.map((node) => {
      const value = valueOf(node.id);
      return `<button type="button" class="viz-chip is-${stateOf(node.id)}${selected === node.id ? ' is-selected' : ''}" data-viz-id="${escapeHtml(node.id)}">
        <span>${escapeHtml(node.name)}</span><em>${Math.round(value * 100)}%</em>
      </button>`;
    }).join('');
  }

  function renderDetail() {
    const node = nodeById(selected);
    if (!node) return;
    const value = valueOf(node.id);
    $('#viz-detail').innerHTML = `
      <span class="viz-detail-kicker">${escapeHtml(node.chapter)} · ${stateLabel(node.id)}</span>
      <h2>${escapeHtml(node.name)}</h2>
      <div class="viz-detail-score"><strong>${Math.round(value * 100)}%</strong><span>当前掌握度</span></div>
      <p>${escapeHtml(node.summary)}</p>
      <div class="viz-detail-points">${node.points.slice(0, 3).map((point) => `<span>${escapeHtml(point)}</span>`).join('')}</div>
      <a class="viz-text-link" href="/learn.html?concept=${encodeURIComponent(node.id)}">进入文字诊断与练习 →</a>`;
  }

  function renderBs() {
    const step = BS_STEPS[bsIndex];
    const cells = BS_ARRAY.map((value, index) => {
      const classes = ['bs-cell'];
      if (index < step.low || index > step.high) classes.push('is-out');
      if (index === step.mid) classes.push('is-mid');
      if (step.found && index === step.mid) classes.push('is-found');
      const pointers = [];
      if (index === step.low) pointers.push('low');
      if (index === step.high) pointers.push('high');
      if (index === step.mid) pointers.push('mid');
      return `<div class="${classes.join(' ')}" data-index="${index}">
        <span class="bs-pointer">${pointers.join(' / ') || '&nbsp;'}</span>
        <span class="bs-value">${value}</span>
        <span class="bs-index">${index}</span>
      </div>`;
    }).join('');
    $('#viz-algo-body').innerHTML = `
      <div class="bs-meta">
        <span>目标值 <strong>${BS_TARGET}</strong></span>
        <span>第 ${bsIndex + 1} / ${BS_STEPS.length} 步</span>
      </div>
      <div class="bs-array">${cells}</div>
      <div class="bs-message ${step.found ? 'is-found' : ''}">${escapeHtml(step.message)}</div>
      <div class="bs-controls">
        <button type="button" class="dsa-btn" data-bs-prev ${bsIndex === 0 ? 'disabled' : ''}>上一步</button>
        <button type="button" class="dsa-btn is-primary" data-bs-play>${bsTimer ? '暂停' : '播放'}</button>
        <button type="button" class="dsa-btn" data-bs-next ${bsIndex === BS_STEPS.length - 1 ? 'disabled' : ''}>下一步</button>
        <button type="button" class="dsa-btn" data-bs-reset>重置</button>
      </div>`;
  }

  function renderAlgo() {
    const node = nodeById(selected);
    $('#viz-algo-title').textContent = `算法动画 · ${node ? node.name : '数据结构'}`;
    if (selected === 'binary-search') {
      renderBs();
      return;
    }
    const value = valueOf(selected);
    $('#viz-algo-body').innerHTML = `
      <div class="viz-placeholder">
        <div class="viz-placeholder-orbit"><span>${Math.round(value * 100)}%</span></div>
        <strong>「${escapeHtml(node ? node.name : '这个知识点')}」动画正在制作</strong>
        <p>二分查找已经可播放。后续会按同一套“逐步状态 + 指针/高亮”的框架补齐链表、栈、队列、树遍历、堆和排序动画。</p>
      </div>`;
  }

  function renderAll() {
    renderGraph();
    renderProgress();
    renderDetail();
    renderAlgo();
  }

  function selectNode(id) {
    if (!nodeById(id)) return;
    selected = id;
    bsIndex = 0;
    stopBs();
    renderAll();
  }

  function stopBs() {
    if (bsTimer) {
      clearInterval(bsTimer);
      bsTimer = null;
    }
  }

  function togglePlay() {
    if (bsTimer) {
      stopBs();
      renderBs();
      return;
    }
    if (bsIndex >= BS_STEPS.length - 1) bsIndex = 0;
    bsTimer = setInterval(() => {
      if (bsIndex >= BS_STEPS.length - 1) {
        stopBs();
        renderBs();
        return;
      }
      bsIndex += 1;
      renderBs();
    }, 1000);
    renderBs();
  }

  app.addEventListener('click', (event) => {
    const node = event.target.closest('.viz-node');
    if (node) {
      selectNode(node.dataset.id);
      return;
    }
    const chip = event.target.closest('[data-viz-id]');
    if (chip) {
      selectNode(chip.dataset.vizId);
      return;
    }
    if (event.target.closest('[data-bs-prev]')) {
      stopBs();
      bsIndex = Math.max(0, bsIndex - 1);
      renderBs();
    } else if (event.target.closest('[data-bs-next]')) {
      stopBs();
      bsIndex = Math.min(BS_STEPS.length - 1, bsIndex + 1);
      renderBs();
    } else if (event.target.closest('[data-bs-play]')) {
      togglePlay();
    } else if (event.target.closest('[data-bs-reset]')) {
      stopBs();
      bsIndex = 0;
      renderBs();
    }
  });

  (async () => {
    try {
      progress = readProgress();
      const params = new URLSearchParams(location.search);
      demoMode = params.get('demo') !== '0';
      data = await fetch('/dsa.json').then((response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      });
      const requested = params.get('concept');
      if (requested && nodeById(requested)) selected = requested;
      renderAll();
    } catch (error) {
      console.error(error);
      $('#viz-detail').innerHTML = '<p class="dsa-empty">数据加载失败，请刷新页面。</p>';
    }
  })();
})();
