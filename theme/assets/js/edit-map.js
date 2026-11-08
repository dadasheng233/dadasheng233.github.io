/* 晚风小筑 · 配置地图
   只读辅助层：鼠标移到页面元素上，告诉你它来自哪个文件、哪个字段。
   不写文件，不改变站点内容。快捷键：Ctrl / Cmd + Shift + E。 */
(() => {
  'use strict';

  const toggle = document.getElementById('edit-map-toggle');
  if (!toggle) return;

  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#${name}"></use></svg>`;
  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const ENTRIES = [
    {
      id: 'site-title', group: '站点信息', label: '站点标题',
      file: 'content/site.json', field: 'title',
      note: '页头大标题、浏览器标签、侧栏名称都来自这里',
      selectors: ['.site-title', '.site-description']
    },
    {
      id: 'site-subtitle', group: '站点信息', label: '副标题',
      file: 'content/site.json', field: 'subtitle',
      note: '标题下面那句话',
      selectors: ['.site-subtitle']
    },
    {
      id: 'site-author', group: '站点信息', label: '作者与简介',
      file: 'content/site.json', field: 'author / description',
      note: '侧栏作者名、站点描述、文章版权署名',
      selectors: ['.site-author-name', '.site-description']
    },
    {
      id: 'avatar', group: '站点信息', label: '头像',
      file: 'theme/assets/img/avatar.svg', field: '替换同名文件即可',
      note: '侧栏和关于页都会用到',
      selectors: ['.site-author-image', '.about-avatar']
    },
    {
      id: 'social', group: '站点信息', label: '邮箱、GitHub、RSS',
      file: 'content/site.json', field: 'email / github / links',
      note: '侧栏底部的圆形图标',
      selectors: ['.links-of-author', '.feed-link']
    },
    {
      id: 'footer', group: '站点信息', label: '页脚',
      file: 'content/site.json', field: 'footer / rss / github',
      note: '页脚文案和右侧图标',
      selectors: ['.footer-copy', '.footer-meta']
    },
    {
      id: 'nav', group: '站点信息', label: '导航菜单',
      file: 'theme/layout.mjs', field: 'NAV 数组',
      note: '首页、归档、分类、标签、关于、搜索',
      selectors: ['.site-nav']
    },
    {
      id: 'color', group: '站点信息', label: '主色与彩虹线',
      file: 'theme/assets/css/site.css', field: ':root 里的 --coral / --violet / --rainbow',
      note: '改颜色先改变量，不要直接改零散颜色',
      selectors: []
    },
    {
      id: 'width', group: '站点信息', label: '页面宽度',
      file: 'theme/assets/css/site.css', field: ':root 里的 --max',
      note: '默认 960px；改成 880px 会更窄',
      selectors: []
    },
    {
      id: 'font', group: '站点信息', label: '字体',
      file: 'theme/assets/css/site.css', field: ':root 里的 --serif / --sans / --mono',
      note: '中文衬线、无衬线、等宽字体',
      selectors: []
    },

    {
      id: 'post-title', group: '文章内容', label: '文章标题',
      file: 'content/posts/<slug>.html', field: 'title',
      note: '首页卡片和文章页顶部',
      selectors: ['.post-title', '.post-title-link']
    },
    {
      id: 'post-subtitle', group: '文章内容', label: '文章副标题',
      file: 'content/posts/<slug>.html', field: 'subtitle',
      note: '文章标题下面的一句小字',
      selectors: ['.post-subtitle']
    },
    {
      id: 'post-excerpt', group: '文章内容', label: '首页摘要',
      file: 'content/posts/<slug>.html', field: 'excerpt',
      note: '首页卡片上的介绍文字',
      selectors: ['.post-excerpt']
    },
    {
      id: 'post-cover', group: '文章内容', label: '文章封面',
      file: 'content/posts/<slug>.html', field: 'cover / coverAlt',
      note: '图片本身放在 theme/assets/img/',
      selectors: ['.post-cover']
    },
    {
      id: 'post-meta', group: '文章内容', label: '日期、分类、阅读时间',
      file: 'content/posts/<slug>.html', field: 'date / updated / category / views / reading',
      note: '标题下面那排小字',
      selectors: ['.post-meta']
    },
    {
      id: 'post-body', group: '文章内容', label: '文章正文',
      file: 'content/posts/<slug>.html', field: 'front matter 下面的 HTML',
      note: '直接写 p、h2、blockquote、pre 等标签',
      selectors: ['.post-body']
    },
    {
      id: 'post-tags', group: '文章内容', label: '文章标签',
      file: 'content/posts/<slug>.html', field: 'tags',
      note: '标签页会自动汇总，不用手动维护列表',
      selectors: ['.post-tags']
    },
    {
      id: 'about-page', group: '文章内容', label: '关于页',
      file: 'content/about.html', field: '整页正文',
      note: '名字、邮箱和自我介绍需要在这里单独改',
      selectors: ['.about-card']
    },
    {
      id: 'words', group: '文章内容', label: '四级单词本',
      file: 'content/words.json', field: 'word / meaning / example',
      note: '卡片、词表、测验都读取这个文件；页面逻辑在 words.js',
      selectors: ['.words-page']
    },
    {
      id: 'home-word-card', group: '文章内容', label: '首页 CET-4 卡片',
      file: 'build.mjs', field: 'renderHome() 里的 .home-word-card',
      note: '只在首页第 1 页出现；显示总词数和 DAY 数',
      selectors: ['.home-word-card']
    },
    {
      id: 'auto-pages', group: '文章内容', label: '归档、分类、标签',
      file: 'build.mjs', field: '自动生成',
      note: '根据文章 front matter 自动汇总，不用手写',
      selectors: ['.archive-list', '.category-grid', '.tag-cloud']
    },
    {
      id: 'comments', group: '文章内容', label: '留言板',
      file: 'theme/assets/js/site.js', field: 'comments 这一段',
      note: '当前只存在浏览器 localStorage，不会上传',
      selectors: ['.comments']
    },

    {
      id: 'cat-lines', group: '小猫', label: '小猫的台词',
      file: 'live2d/waifu-tips.json', field: 'message / mouseover',
      note: '默认台词、悬停、点击、阅读欢迎语',
      selectors: ['#waifu', '.cat-fallback']
    },
    {
      id: 'cat-model', group: '小猫', label: '小猫的模型',
      file: 'live2d/tororo/tororo.model.json', field: 'model / textures / motions',
      note: '换模型时同时改 live2d/waifu-tips.json 的 paths',
      selectors: ['#waifu']
    },
    {
      id: 'cat-size', group: '小猫', label: '小猫的大小与位置',
      file: 'theme/assets/css/site.css', field: '#waifu / #live2d / #waifu-tips',
      note: '默认左下角，宽屏才加载 Live2D',
      selectors: ['#waifu']
    },
    {
      id: 'cat-toggle', group: '小猫', label: '拖拽、关闭、召回按钮',
      file: 'theme/assets/js/cat.js', field: 'initWidget 配置',
      note: 'drag、showToggleAfterQuit 等参数',
      selectors: ['#waifu-toggle']
    },

    {
      id: 'layout', group: '进阶', label: '页面骨架',
      file: 'theme/layout.mjs', field: 'header / sidebar / footer',
      note: '想加导航项、改结构时再动',
      selectors: ['.site-header']
    },
    {
      id: 'search', group: '进阶', label: '搜索',
      file: 'theme/assets/js/site.js', field: 'search 这一段',
      note: '搜索索引由 build.mjs 生成到 search.json',
      selectors: ['.search-trigger']
    },
    {
      id: 'transition', group: '进阶', label: '页面转场',
      file: 'theme/assets/js/site.js', field: 'page transition 这一段',
      note: '点站内链接时先淡出再跳转',
      selectors: []
    },
    {
      id: 'build', group: '进阶', label: '分页与构建',
      file: 'build.mjs', field: 'PAGE_SIZE / renderHome',
      note: '每页 4 篇，改成 5 就会重新分页',
      selectors: ['.pagination']
    },
    {
      id: 'cards', group: '进阶', label: '卡片与动效',
      file: 'theme/assets/css/site.css', field: '.post / .post-cover / @keyframes',
      note: '悬停、入场、阅读进度都在这里',
      selectors: ['.post']
    }
  ];

  const targets = new Map();
  let active = false;
  let hovered = null;
  let pointerX = 0;
  let pointerY = 0;
  let toastTimer = 0;

  const panel = document.createElement('aside');
  panel.className = 'edit-map-panel';
  panel.id = 'edit-map-panel';
  panel.setAttribute('aria-label', '配置地图');
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <div class="edit-map-head">
      <div class="edit-map-head-text">
        <p class="edit-map-kicker">CONFIG MAP</p>
        <h2 class="edit-map-title">配置地图</h2>
        <p class="edit-map-sub">鼠标移到页面元素上，看看它来自哪个文件</p>
      </div>
      <button class="edit-map-close" id="edit-map-close" type="button" aria-label="关闭配置地图">
        ${icon('i-close')}
      </button>
    </div>
    <div class="edit-map-search">
      ${icon('i-search')}
      <label class="sr-only" for="edit-map-search-input">搜索配置项</label>
      <input id="edit-map-search-input" type="search" placeholder="搜索：标题、头像、猫、颜色…" autocomplete="off">
    </div>
    <div class="edit-map-list" id="edit-map-list"></div>
    <div class="edit-map-foot">
      <span>只读地图 · 不会修改文件</span>
      <kbd>Ctrl + Shift + E</kbd>
    </div>`;
  body.appendChild(panel);

  const tip = document.createElement('div');
  tip.className = 'edit-map-tip';
  tip.hidden = true;
  body.appendChild(tip);

  const toast = document.createElement('div');
  toast.className = 'edit-map-toast';
  toast.setAttribute('role', 'status');
  body.appendChild(toast);

  const pathOf = (info) => `${info.file}${info.field ? ' → ' + info.field : ''}`;
  const list = panel.querySelector('#edit-map-list');
  const searchInput = panel.querySelector('#edit-map-search-input');
  let searchQuery = '';

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
  };

  const copyText = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      showToast('已复制：' + text);
    } catch (error) {
      showToast('复制失败，可以手动选中面板里的路径');
    }
  };

  const filteredEntries = () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return ENTRIES;
    return ENTRIES.filter((entry) => [entry.group, entry.label, entry.file, entry.field, entry.note]
      .join(' ').toLowerCase().includes(query));
  };

  const renderList = () => {
    const entries = filteredEntries();
    if (!entries.length) {
      list.innerHTML = '<div class="edit-map-empty">没有找到相关配置。换个词试试，比如「头像」「猫」「颜色」。</div>';
      return;
    }
    const groups = [...new Set(entries.map((entry) => entry.group))];
    list.innerHTML = groups.map((group) => `
      <section class="edit-map-group">
        <h3>${escapeHtml(group)}</h3>
        ${entries.filter((entry) => entry.group === group).map((entry) => `
          <div class="edit-map-entry" data-entry-id="${entry.id}" role="button" tabindex="0" aria-label="定位 ${escapeHtml(entry.label)}">
            <div class="edit-map-entry-text">
              <strong>${escapeHtml(entry.label)}</strong>
              <code>${escapeHtml(entry.file)}${entry.field ? ' → ' + escapeHtml(entry.field) : ''}</code>
              ${entry.note ? `<small>${escapeHtml(entry.note)}</small>` : ''}
            </div>
            <button class="edit-map-copy" type="button" data-copy-id="${entry.id}" aria-label="复制 ${escapeHtml(entry.label)} 的路径" title="复制路径">
              ${icon('i-copy')}
            </button>
          </div>`).join('')}
      </section>`).join('');
  };

  const addTarget = (element, info) => {
    if (!element || element.closest('#edit-map-panel, .edit-map-toggle, #waifu-tool, #waifu-toggle')) return;
    element.classList.add('edit-map-target');
    targets.set(element, info);
  };

  const buildTargets = () => {
    document.querySelectorAll('.edit-map-target').forEach((element) => {
      element.classList.remove('edit-map-target', 'edit-map-hover');
    });
    targets.clear();

    ENTRIES.forEach((entry) => {
      if (!entry.selectors.length) return;
      entry.selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((element) => addTarget(element, entry));
      });
    });

    // 首页和文章页的每张卡片，指向各自具体的文章文件
    document.querySelectorAll('.post').forEach((post) => {
      const link = post.querySelector('.post-title-link');
      const href = link ? link.getAttribute('href') : location.pathname;
      const match = String(href || '').match(/\/posts\/([^/]+)\.html/);
      const slug = match ? match[1] : '当前文章';
      const file = `content/posts/${slug}.html`;
      const isDetail = post.classList.contains('post-detail');

      const map = (selector, label, field, note) => {
        post.querySelectorAll(selector).forEach((element) => addTarget(element, { label, file, field, note }));
      };

      map('.post-title, .post-title-link', '文章标题', 'title', 'front matter 里的 title');
      map('.post-subtitle', '文章副标题', 'subtitle', '标题下的一句小字');
      map('.post-cover', '文章封面', 'cover / coverAlt', '图片放在 theme/assets/img/');
      map('.post-excerpt', '首页摘要', 'excerpt', '首页卡片上的介绍文字');
      map('.post-meta', '日期、分类、阅读时间', 'date / updated / category / views / reading', '标题下面那排小字');
      map('.post-tags', '文章标签', 'tags', '标签页会自动汇总');

      if (isDetail) {
        map('.post-body', '文章正文', 'front matter 下面的 HTML', '目录会从 h2/h3 自动生成');
        map('.toc', '本文目录', '自动生成', '不需要手写');
        map('.post-copyright', '版权信息', 'site.json → author', '协议文字在 build.mjs');
        map('.post-nav', '上一篇 / 下一篇', '自动生成', '根据文章日期排序');
        map('.comments', '留言板', 'theme/assets/js/site.js', '只存 localStorage');
      }
    });
  };

  const findTarget = (element) => {
    if (!element) return null;
    if (element.closest('#edit-map-panel, .edit-map-toggle, #waifu-tool, #waifu-toggle, .search-modal, .lightbox')) return null;
    return element.closest('.edit-map-target');
  };

  const positionTip = () => {
    if (tip.hidden) return;
    const pad = 12;
    const width = tip.offsetWidth;
    const height = tip.offsetHeight;
    let left = pointerX + 16;
    let top = pointerY + 16;
    if (left + width > window.innerWidth - pad) left = pointerX - width - 16;
    if (top + height > window.innerHeight - pad) top = pointerY - height - 16;
    tip.style.left = Math.max(pad, left) + 'px';
    tip.style.top = Math.max(pad, top) + 'px';
  };

  const showTip = (info) => {
    tip.innerHTML = `<strong>${escapeHtml(info.label)}</strong><code>${escapeHtml(pathOf(info))}</code><span>${escapeHtml(info.note || '')}</span><span>按 C 复制路径</span>`;
    tip.hidden = false;
    requestAnimationFrame(positionTip);
  };

  const hideTip = () => {
    tip.hidden = true;
    if (hovered) hovered.classList.remove('edit-map-hover');
    hovered = null;
  };

  const setHover = (element) => {
    if (hovered === element) return;
    if (hovered) hovered.classList.remove('edit-map-hover');
    hovered = element;
    if (hovered && targets.has(hovered)) {
      hovered.classList.add('edit-map-hover');
      showTip(targets.get(hovered));
    } else {
      tip.hidden = true;
    }
  };

  const copyEntry = (entry) => {
    const path = `${entry.file}${entry.field ? ' → ' + entry.field : ''}`;
    copyText(path);
  };

  const locateEntry = (entry) => {
    if (!entry) return;
    const selector = entry.selectors.find((item) => document.querySelector(item));
    if (!selector) {
      copyEntry(entry);
      showToast('这个设置在文件里，当前页面没有可直接定位的元素；路径已复制。');
      return;
    }
    const element = document.querySelector(selector);
    element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    element.classList.add('edit-map-focus');
    window.setTimeout(() => element.classList.remove('edit-map-focus'), 1300);
    showToast(`${entry.label}：${pathOf(entry)}`);
  };

  const openMap = () => {
    active = true;
    body.classList.add('edit-map-active');
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', '关闭配置地图');
    buildTargets();
    renderList();
    sessionStorage.setItem('edit-map-open', '1');
    window.setTimeout(() => { if (active) buildTargets(); }, 1800);
    window.setTimeout(() => { if (active) buildTargets(); }, 5200);
  };

  const closeMap = () => {
    active = false;
    body.classList.remove('edit-map-active');
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '打开配置地图');
    hideTip();
    sessionStorage.removeItem('edit-map-open');
  };

  const toggleMap = () => {
    if (active) closeMap();
    else openMap();
  };

  toggle.addEventListener('click', toggleMap);
  panel.querySelector('#edit-map-close').addEventListener('click', closeMap);

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderList();
  });

  list.addEventListener('click', (event) => {
    const copy = event.target.closest('[data-copy-id]');
    if (copy) {
      event.stopPropagation();
      const entry = ENTRIES.find((item) => item.id === copy.dataset.copyId);
      if (entry) copyEntry(entry);
      return;
    }
    const row = event.target.closest('[data-entry-id]');
    if (row) locateEntry(ENTRIES.find((item) => item.id === row.dataset.entryId));
  });

  list.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('[data-entry-id]');
    if (!row) return;
    event.preventDefault();
    locateEntry(ENTRIES.find((item) => item.id === row.dataset.entryId));
  });

  document.addEventListener('pointermove', (event) => {
    if (!active) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (event.target.closest('#edit-map-panel, .edit-map-toggle')) {
      hideTip();
      return;
    }
    const target = findTarget(event.target);
    if (target) {
      setHover(target);
      positionTip();
    } else {
      hideTip();
    }
  }, { passive: true });

  document.addEventListener('click', (event) => {
    if (!active) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.target.closest('#edit-map-panel, .edit-map-toggle, #waifu-tool, #waifu-toggle, .search-modal, .lightbox')) return;
    const target = event.target.closest('.edit-map-target');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    const info = targets.get(target);
    if (info) showToast(`${info.label}：${pathOf(info)}（只读，不会修改文件）`);
  }, true);

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      toggleMap();
      return;
    }
    if (!active) return;
    if (event.key === 'Escape') {
      closeMap();
      return;
    }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if (!typing && event.key.toLowerCase() === 'c' && hovered && targets.has(hovered)) {
      event.preventDefault();
      copyText(pathOf(targets.get(hovered)));
    }
  });

  if (sessionStorage.getItem('edit-map-open') === '1' || new URLSearchParams(location.search).get('edit-map') === '1') {
    window.setTimeout(openMap, 260);
  }
})();
