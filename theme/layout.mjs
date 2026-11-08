import { escapeHtml as esc } from './utils.mjs';

export function icon(name, className = '') {
  const cls = ['icon', className].filter(Boolean).join(' ');
  return `<svg class="${cls}" aria-hidden="true"><use href="/assets/icons.svg#${name}"></use></svg>`;
}

const NAV = [
  { key: 'home', label: '首页', href: '/', icon: 'i-home' },
  { key: 'archives', label: '归档', href: '/archives.html', icon: 'i-archive' },
  { key: 'categories', label: '分类', href: '/categories.html', icon: 'i-grid' },
  { key: 'tags', label: '标签', href: '/tags.html', icon: 'i-tag' },
  { key: 'words', label: '单词', href: '/words.html', icon: 'i-book' },
  { key: 'papers', label: '真题', href: '/papers.html', icon: 'i-archive' },
  { key: 'about', label: '关于', href: '/about.html', icon: 'i-user' }
];

function header(site, active) {
  const items = NAV.map((item, index) => `
      <li class="menu-item menu-item-${item.key}${active === item.key ? ' is-active' : ''}" style="--i:${index}">
        <a href="${item.href}"${active === item.key ? ' aria-current="page"' : ''}>
          ${icon(item.icon, 'menu-icon')}
          <span>${item.label}</span>
        </a>
      </li>`).join('');

  return `
  <div class="headband" aria-hidden="true"></div>
  <header class="site-header" id="header">
    <button class="nav-toggle" type="button" aria-label="打开导航" aria-expanded="false" aria-controls="site-nav">
      <span class="nav-toggle-line"></span><span class="nav-toggle-line"></span><span class="nav-toggle-line"></span>
    </button>

    <div class="site-meta">
      <a class="brand" href="/" rel="home">
        <span class="site-title">${esc(site.title)}</span>
      </a>
      <p class="site-subtitle">${esc(site.subtitle)}</p>
    </div>

    <nav class="site-nav" id="site-nav" aria-label="主导航">
      <ul class="menu">
        ${items}
        <li class="menu-item menu-item-search" style="--i:5">
          <a href="#search" role="button" class="search-trigger" aria-haspopup="dialog" aria-controls="search-modal">
            ${icon('i-search', 'menu-icon')}
            <span>搜索</span>
          </a>
        </li>
      </ul>
    </nav>
  </header>`;
}

function sidebar(site, stats) {
  const social = (site.links || []).map((link) => `
        <a href="${esc(link.url)}" target="_blank" rel="noopener" aria-label="${esc(link.name)}" title="${esc(link.name)}">
          ${icon(link.icon || 'i-link')}
        </a>`).join('');

  const blogroll = (site.blogroll || []).map((link) => `
        <li><a href="${esc(link.url)}" target="_blank" rel="noopener">${esc(link.name)} ${icon('i-external')}</a></li>`).join('');

  return `
  <div class="sidebar-dimmer" id="sidebar-dimmer" aria-hidden="true"></div>
  <aside class="sidebar" id="sidebar" aria-label="站点信息" aria-hidden="true">
    <button class="sidebar-close" id="sidebar-close" type="button" aria-label="关闭侧栏">
      ${icon('i-close')}
    </button>

    <div class="site-author">
      <img class="site-author-image" src="${esc(site.avatar)}" alt="${esc(site.author)}的头像" width="96" height="96">
      <p class="site-author-name">${esc(site.author)}</p>
      <p class="site-description">${esc(site.title)}</p>
    </div>

    <div class="site-state">
      <div class="site-state-item">
        <a href="/archives.html"><span class="site-state-item-count">${stats.posts}</span><span class="site-state-item-name">日志</span></a>
      </div>
      <div class="site-state-item">
        <a href="/categories.html"><span class="site-state-item-count">${stats.categories}</span><span class="site-state-item-name">分类</span></a>
      </div>
      <div class="site-state-item">
        <a href="/tags.html"><span class="site-state-item-count">${stats.tags}</span><span class="site-state-item-name">标签</span></a>
      </div>
    </div>

    <div class="feed-link">
      <a href="${esc(site.rss)}">${icon('i-rss')} RSS 订阅</a>
    </div>

    <div class="links-of-author">${social}</div>

    <div class="sidebar-divider"></div>
    <p class="sidebar-title">Friends</p>
    <ul class="sidebar-links">${blogroll}</ul>

    <div class="sidebar-divider"></div>
    <p class="sidebar-title">About</p>
    <p class="sidebar-foot">
      ${esc(site.description)}
      <span id="days">本站已经写了 0 天</span>
    </p>
  </aside>`;
}

function footer(site, stats) {
  return `
  <footer class="site-footer" id="footer">
    <div class="footer-inner">
      <div class="footer-copy">
        <span>© <span id="year">2026</span> <a href="/">${esc(site.title)}</a></span>
        <span>·</span>
        <span>${esc(site.footer)}</span>
        <span class="heart" aria-hidden="true">♥</span>
      </div>
      <div class="footer-meta">
        <span>${stats.wordsLabel} 字</span>
        <span>·</span>
        <span>${stats.timeLabel}</span>
        <a href="${esc(site.rss)}" aria-label="RSS">${icon('i-rss')}</a>
        <a href="${esc(site.github)}" target="_blank" rel="noopener" aria-label="GitHub">${icon('i-github')}</a>
        <span id="scroll-percent">0%</span>
      </div>
    </div>
  </footer>`;
}

function floatingControls() {
  return `
  <button class="edit-map-toggle" id="edit-map-toggle" type="button" aria-label="打开配置地图" aria-expanded="false" title="配置地图：看每块内容对应哪个文件">
    ${icon('i-pen')}
    <span>配置地图</span>
  </button>
  <button class="sidebar-toggle" id="sidebar-toggle" type="button" aria-label="打开站点信息" aria-expanded="false" aria-controls="sidebar">
    <span class="sidebar-toggle-line"></span><span class="sidebar-toggle-line"></span><span class="sidebar-toggle-line"></span>
  </button>
  <button class="back-to-top" id="back-to-top" type="button" aria-label="回到顶部">
    ${icon('i-arrow-up')}
  </button>`;
}

function searchModal() {
  return `
  <div class="search-modal" id="search-modal" role="dialog" aria-modal="true" aria-labelledby="search-title" aria-hidden="true">
    <div class="search-backdrop" data-search-close></div>
    <div class="search-panel">
      <div class="search-bar">
        ${icon('i-search')}
        <label class="sr-only" id="search-title" for="search-input">搜索文章</label>
        <input id="search-input" type="search" placeholder="搜索标题、标签或正文…" autocomplete="off" spellcheck="false">
        <span class="search-kbd">ESC</span>
        <button class="search-close" type="button" data-search-close aria-label="关闭搜索">${icon('i-close')}</button>
      </div>
      <div class="search-body">
        <div class="search-hint" id="search-hint">
          <span>试试：</span>
          <button type="button" data-search-suggest="Live2D">Live2D</button>
          <button type="button" data-search-suggest="前端">前端</button>
          <button type="button" data-search-suggest="秋日">秋日</button>
          <button type="button" data-search-suggest="阅读">阅读</button>
          <button type="button" data-search-suggest="摄影">摄影</button>
        </div>
        <div class="search-results" id="search-results"></div>
      </div>
    </div>
  </div>`;
}

function lightbox() {
  return `
  <div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-label="查看大图" aria-hidden="true">
    <button class="lightbox-close" id="lightbox-close" type="button" aria-label="关闭大图">${icon('i-close')}</button>
    <img id="lightbox-image" src="" alt="">
    <p class="lightbox-caption" id="lightbox-caption"></p>
  </div>`;
}

export function renderPage({ site, page, content, stats }) {
  const title = page.title ? `${page.title} | ${site.title}` : `${site.title} | ${site.subtitle}`;
  const description = page.description || site.description;
  const canonical = page.canonical || `${site.url}${page.path || '/'}`;
  const bodyClass = [page.bodyClass, 'page-' + (page.active || 'home'), 'cat-loading'].filter(Boolean).join(' ');
  const image = page.image || `${site.url}${site.avatar}`;

  return `<!DOCTYPE html>
<html class="no-js" lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#141418">
  <meta name="description" content="${esc(description)}">
  <meta name="keywords" content="${esc(site.keywords || '')}">
  <meta name="author" content="${esc(site.author)}">
  <meta property="og:type" content="${page.active === 'post' ? 'article' : 'website'}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:site_name" content="${esc(site.title)}">
  <meta name="twitter:card" content="summary_large_image">
  <title>${esc(title)}</title>
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="icon" type="image/svg+xml" href="${esc(site.favicon)}">
  <link rel="alternate" type="application/atom+xml" title="${esc(site.title)}" href="/atom.xml">
  <link rel="stylesheet" href="/vendor/live2d/waifu.css">
  <link rel="stylesheet" href="/assets/css/site.css">
  <script>document.documentElement.classList.remove('no-js');document.documentElement.classList.add('js');</script>
</head>
<body class="${esc(bodyClass)}" data-since="${esc(site.since)}">
  <a class="skip-link" href="#main">跳到正文</a>
  <div class="pace-bar" id="pace" aria-hidden="true"><span></span></div>
  <div class="scroll-meter" aria-hidden="true"><span id="reading-progress"></span></div>

  <div class="container">
    ${header(site, page.active)}
    <main class="main page-main" id="main">
      <div class="main-inner">
        ${content}
      </div>
    </main>
    ${footer(site, stats)}
  </div>

  ${sidebar(site, stats)}
  ${floatingControls()}
  ${searchModal()}
  ${lightbox()}

  <script src="/assets/js/site.js" defer></script>
  <script src="/assets/js/edit-map.js" defer></script>
  <script src="/assets/js/words.js" defer></script>
  <script src="/assets/js/papers.js" defer></script>
  <script src="/assets/js/pdf-reader.js" defer></script>
  <script type="module" src="/assets/js/cat.js"></script>
</body>
</html>`;
}
