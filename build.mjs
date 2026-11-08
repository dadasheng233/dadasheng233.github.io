import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage, icon } from './theme/layout.mjs';
import {
  escapeHtml,
  stripTags,
  slugify,
  dateParts,
  formatDate,
  isoDateTime,
  toAbsolute
} from './theme/utils.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const contentDir = join(root, 'content');
const themeDir = join(root, 'theme');
const outDir = join(root, 'public');

const PAGE_SIZE = 4;
const CATEGORY_COLORS = ['#f79533', '#ef4e7b', '#a166ab', '#5073b8', '#07b39b', '#6dba82'];

const ensureDir = async (path) => mkdir(path, { recursive: true });

const writePage = async (relativePath, html) => {
  const target = join(outDir, ...relativePath.split('/').filter(Boolean));
  await ensureDir(dirname(target));
  await writeFile(target, html, 'utf8');
};

const clean = async (dir) => {
  try {
    const info = await stat(dir);
    if (info.isDirectory()) await rm(dir, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
};

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const estimateReading = (text) => {
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (text.replace(/[\u3400-\u9fff]/g, ' ').match(/[A-Za-z0-9_'-]+/g) || []).length;
  return Math.max(1, Math.round(cjk / 360 + words / 220));
};

const processBody = (html, slug) => {
  const used = new Map();
  const toc = [];
  const body = String(html).replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (full, level, attrs, inner) => {
    const text = stripTags(inner);
    const existing = attrs.match(/\bid=(?:"([^"]+)"|'([^']+)')/i);
    const base = existing ? (existing[1] || existing[2]) : slugify(text);
    let id = base;
    let count = 2;
    while (used.has(id)) {
      id = `${base}-${count}`;
      count++;
    }
    used.set(id, true);
    const nextAttrs = existing ? attrs : `${attrs} id="${id}"`;
    toc.push({ level: Number(level), id, text });
    return `<h${level}${nextAttrs}>${inner}</h${level}>`;
  });

  return { body, toc };
};

const renderToc = (toc) => {
  if (!toc.length) return '';
  const items = toc.map((item) => `
      <li class="toc-level-${item.level}"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`).join('');
  return `
  <details class="toc" open>
    <summary>${icon('i-book')} 本文目录</summary>
    <ol>${items}</ol>
  </details>`;
};

const renderPostCard = (post) => `
  <article class="post reveal${post.featured ? ' is-featured' : ''}" id="post-${escapeHtml(post.slug)}">
    <header class="post-header">
      <h2 class="post-title">
        <a class="post-title-link" href="${post.path}">${escapeHtml(post.title)}</a>
      </h2>
      <div class="post-meta">
        <span class="meta-item">${icon('i-calendar')}<time datetime="${post.date}">${formatDate(post.date)}</time></span>
        <span class="meta-item">${icon('i-clock')}${post.reading} 分钟</span>
        <span class="meta-item">${icon('i-folder')}<a href="/categories.html#${post.categoryId}">${escapeHtml(post.category)}</a></span>
        <span class="meta-item">${icon('i-eye')}${escapeHtml(post.views)}</span>
      </div>
    </header>
    ${post.cover ? `<a class="post-cover" href="${post.path}" aria-label="阅读《${escapeHtml(post.title)}》">
      <img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.coverAlt || post.title)}" loading="lazy" width="1200" height="675">
    </a>` : ''}
    <div class="post-excerpt">
      <p>${escapeHtml(post.excerpt)}</p>
    </div>
    <div class="post-button">
      <a class="btn-read" href="${post.path}">阅读全文 ${icon('i-arrow-right')}</a>
    </div>
  </article>`;

const pageUrl = (number) => number === 1 ? '/' : `/page/${number}/`;
const pageFile = (number) => number === 1 ? 'index.html' : `page/${number}/index.html`;

const renderPagination = (current, total) => {
  if (total <= 1) return '';
  const items = [];
  if (current > 1) {
    items.push(`<a class="page-number page-arrow" href="${pageUrl(current - 1)}" aria-label="上一页">${icon('i-chevron-left')}</a>`);
  }
  for (let index = 1; index <= total; index++) {
    if (index === current) {
      items.push(`<span class="page-number current" aria-current="page">${index}</span>`);
    } else {
      items.push(`<a class="page-number" href="${pageUrl(index)}" aria-label="第 ${index} 页">${index}</a>`);
    }
  }
  if (current < total) {
    items.push(`<a class="page-number page-arrow" href="${pageUrl(current + 1)}" aria-label="下一页">${icon('i-chevron-right')}</a>`);
  }
  return `<nav class="pagination" aria-label="分页">${items.join('')}</nav>`;
};

const renderPostPage = (post, context) => {
  const { posts, site, stats } = context;
  const index = posts.findIndex((item) => item.slug === post.slug);
  const newer = index > 0 ? posts[index - 1] : null;
  const older = index >= 0 && index < posts.length - 1 ? posts[index + 1] : null;

  const prev = newer
    ? `<a class="post-nav-item prev" href="${newer.path}">
        <span class="post-nav-label">${icon('i-chevron-left')} 较新的一篇</span>
        <span class="post-nav-title">${escapeHtml(newer.title)}</span>
      </a>`
    : '<span></span>';

  const next = older
    ? `<a class="post-nav-item next" href="${older.path}">
        <span class="post-nav-label">较早的一篇 ${icon('i-chevron-right')}</span>
        <span class="post-nav-title">${escapeHtml(older.title)}</span>
      </a>`
    : '<span></span>';

  const tagLinks = post.tagInfos.map((tag) => `<a href="/tags.html#${tag.id}">${escapeHtml(tag.name)}</a>`).join('');

  const content = `
  <article class="post post-detail reveal">
    <header class="post-header">
      <h1 class="post-title">${escapeHtml(post.title)}</h1>
      ${post.subtitle ? `<p class="post-subtitle">${escapeHtml(post.subtitle)}</p>` : ''}
      <div class="post-meta">
        <span class="meta-item">${icon('i-calendar')}<time datetime="${post.date}">${formatDate(post.date)}</time></span>
        ${post.updated && post.updated !== post.date ? `<span class="meta-item">${icon('i-clock')}更新于 <time datetime="${post.updated}">${formatDate(post.updated)}</time></span>` : ''}
        <span class="meta-item">${icon('i-clock')}${post.reading} 分钟</span>
        <span class="meta-item">${icon('i-folder')}<a href="/categories.html#${post.categoryId}">${escapeHtml(post.category)}</a></span>
        <span class="meta-item">${icon('i-eye')}${escapeHtml(post.views)}</span>
      </div>
    </header>

    ${post.cover ? `<figure class="post-cover">
      <img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.coverAlt || post.title)}" width="1200" height="675">
    </figure>` : ''}

    ${renderToc(post.toc)}

    <div class="post-body">
      ${post.body}
    </div>

    <div class="post-tags">${tagLinks}</div>

    <div class="post-end">END</div>

    <div class="post-copyright">
      <strong>© ${new Date(post.date + 'T00:00:00+08:00').getFullYear()} ${escapeHtml(site.author)}</strong>
      · 本文采用 <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a> 许可协议
      · 转载请注明出处<br>
      原文链接：<a href="${toAbsolute(site.url, post.path)}">${toAbsolute(site.url, post.path)}</a>
    </div>

    <nav class="post-nav" aria-label="文章导航">
      ${prev}
      ${next}
    </nav>

    <section class="comments" aria-labelledby="comments-title">
      <div class="comments-head">
        <h2 id="comments-title">猫爪留言板</h2>
        <span>留言只保存在你的浏览器里</span>
      </div>
      <form class="comment-form" id="comment-form" data-slug="${escapeHtml(post.slug)}">
        <div class="comment-fields">
          <input id="comment-name" name="name" type="text" maxlength="24" placeholder="你的名字（可不填）" autocomplete="nickname">
          <input id="comment-email" name="email" type="email" maxlength="80" placeholder="邮箱（不会公开）" autocomplete="email">
        </div>
        <textarea id="comment-text" name="text" maxlength="500" placeholder="写点什么吧，猫会看到的。" required></textarea>
        <div class="comment-actions">
          <span class="comment-note">静态站点演示：数据不会上传到服务器。</span>
          <button class="btn-comment" type="submit">留下猫爪印</button>
        </div>
      </form>
      <ul class="comment-list" id="comment-list"></ul>
    </section>
  </article>`;

  return renderPage({
    site,
    stats,
    page: {
      title: post.title,
      description: post.excerpt,
      active: 'post',
      bodyClass: 'page-post-detail',
      path: post.path,
      image: post.cover ? toAbsolute(site.url, post.cover) : '',
      canonical: toAbsolute(site.url, post.path)
    },
    content
  });
};

const renderHome = (pagePosts, current, total, site, stats) => {
  const content = `
  <div class="posts-expand">
    ${pagePosts.map(renderPostCard).join('\n')}
  </div>
  ${renderPagination(current, total)}`;

  return renderPage({
    site,
    stats,
    page: {
      title: current > 1 ? `第 ${current} 页` : '',
      description: site.description,
      active: 'home',
      path: pageUrl(current),
      image: toAbsolute(site.url, '/assets/img/cover-cat.svg'),
      canonical: toAbsolute(site.url, pageUrl(current))
    },
    content
  });
};

const renderArchives = (posts, site, stats) => {
  const years = [...new Set(posts.map((post) => post.date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const yearBlocks = years.map((year) => {
    const items = posts.filter((post) => post.date.startsWith(year));
    return `
      <h2 class="archive-year">${year} <small>${items.length} POSTS</small></h2>
      <ul class="archive-list">
        ${items.map((post) => {
          const parts = dateParts(post.date);
          return `<li class="archive-item">
            <span class="archive-date">${parts.short}</span>
            <a class="archive-title" href="${post.path}">${escapeHtml(post.title)}</a>
            <a class="archive-cat" href="/categories.html#${post.categoryId}">${escapeHtml(post.category)}</a>
          </li>`;
        }).join('')}
      </ul>`;
  }).join('');

  const content = `
  <div class="page-card reveal">
    <div class="page-header">
      <p class="page-kicker">ARCHIVE</p>
      <h1 class="page-title">归档</h1>
      <p class="page-subtitle">所有写过的字，按时间排好。共 ${posts.length} 篇，慢慢翻。</p>
    </div>
    <p class="archive-counter">最近更新于 ${formatDate(posts[0]?.date || '')} · 不要着急，文字比时间慢一点。</p>
    ${yearBlocks}
  </div>`;

  return renderPage({
    site,
    stats,
    page: {
      title: '归档',
      description: '晚风小筑的全部文章归档。',
      active: 'archives',
      path: '/archives.html',
      image: toAbsolute(site.url, '/assets/img/cover-horizon.svg'),
      canonical: toAbsolute(site.url, '/archives.html')
    },
    content
  });
};

const renderCategories = (categories, site, stats) => {
  const cards = categories.map((category) => `
    <a class="category-card" href="#${category.id}" style="--accent:${category.color}">
      <span class="category-name">${escapeHtml(category.name)} ${icon('i-folder')}</span>
      <span class="category-count">${category.posts.length} 篇文章</span>
      <ul class="category-posts">
        ${category.posts.slice(0, 2).map((post) => `<li>${escapeHtml(post.title)}</li>`).join('')}
      </ul>
    </a>`).join('');

  const sections = categories.map((category) => `
    <section class="category-section" id="${category.id}">
      <h2>${icon('i-folder')}${escapeHtml(category.name)} <span>${category.posts.length} 篇</span></h2>
      <ul class="category-article-list">
        ${category.posts.map((post) => `<li><a href="${post.path}">${escapeHtml(post.title)}</a><time datetime="${post.date}">${formatDate(post.date)}</time></li>`).join('')}
      </ul>
    </section>`).join('');

  const content = `
  <div class="page-card reveal">
    <div class="page-header">
      <p class="page-kicker">CATEGORIES</p>
      <h1 class="page-title">分类</h1>
      <p class="page-subtitle">技术、生活、摄影、阅读，还有一些说不清归到哪里的随笔。</p>
    </div>
    <div class="category-grid">${cards}</div>
    ${sections}
  </div>`;

  return renderPage({
    site,
    stats,
    page: {
      title: '分类',
      description: '晚风小筑的文章分类目录。',
      active: 'categories',
      path: '/categories.html',
      image: toAbsolute(site.url, '/assets/img/cover-grid.svg'),
      canonical: toAbsolute(site.url, '/categories.html')
    },
    content
  });
};

const renderTags = (tags, posts, site, stats) => {
  const chips = [
    `<button class="tag-chip is-active" type="button" data-tag="all" data-label="全部文章">全部 <span>${posts.length}</span></button>`,
    ...tags.map((tag) => `<button class="tag-chip" type="button" data-tag="${tag.id}" data-label="${escapeHtml(tag.name)}">${escapeHtml(tag.name)} <span>${tag.count}</span></button>`)
  ].join('');

  const items = posts.map((post) => {
    const tagIds = post.tagInfos.map((tag) => tag.id).join(' ');
    return `<li class="tag-result-item" data-tags="${tagIds}">
      <span class="date">${formatDate(post.date)}</span>
      <a href="${post.path}">${escapeHtml(post.title)}</a>
      <span class="cat">${escapeHtml(post.category)}</span>
    </li>`;
  }).join('');

  const content = `
  <div class="page-card reveal">
    <div class="page-header">
      <p class="page-kicker">TAGS</p>
      <h1 class="page-title">标签</h1>
      <p class="page-subtitle">像书架上的便利贴，帮你在不同文章之间找到一点联系。</p>
    </div>
    <div class="tag-cloud" id="tag-cloud">${chips}</div>
    <div class="tag-result-head">
      <span id="tag-result-label">全部文章</span>
      <span id="tag-result-count">${posts.length} 篇</span>
    </div>
    <ul class="tag-result-list" id="tag-results">${items}</ul>
  </div>`;

  return renderPage({
    site,
    stats,
    page: {
      title: '标签',
      description: '晚风小筑的文章标签云。',
      active: 'tags',
      path: '/tags.html',
      image: toAbsolute(site.url, '/assets/img/cover-book.svg'),
      canonical: toAbsolute(site.url, '/tags.html')
    },
    content
  });
};

const renderAbout = async (site, stats) => {
  const aboutBody = await readFile(join(contentDir, 'about.html'), 'utf8');
  const content = `
  <article class="about-card reveal">
    <div class="page-header">
      <p class="page-kicker">ABOUT</p>
      <h1 class="page-title">关于</h1>
      <p class="page-subtitle">一个写字的地方，和一只住在左下角的猫。</p>
    </div>
    ${aboutBody}
  </article>`;

  return renderPage({
    site,
    stats,
    page: {
      title: '关于',
      description: '关于晚风小筑，和这个站点背后的一些事。',
      active: 'about',
      path: '/about.html',
      image: toAbsolute(site.url, site.avatar),
      canonical: toAbsolute(site.url, '/about.html')
    },
    content
  });
};

const render404 = (site, stats) => {
  const content = `
  <div class="page-card error-page reveal">
    <div class="page-header">
      <p class="page-kicker">LOST IN THE WIND</p>
      <h1 class="page-title">这一页被风吹走了</h1>
      <p class="page-subtitle">你要找的东西不在这里。也许是链接写错了，也许它还没有被写出来。</p>
    </div>
    <p class="error-code">404</p>
    <p class="error-text">小猫在门口等你，先回首页坐一会儿吧。</p>
    <p class="error-actions"><a class="btn-read" href="/">回到首页 ${icon('i-arrow-right')}</a></p>
  </div>`;

  return renderPage({
    site,
    stats,
    page: {
      title: '页面不存在',
      description: '这一页被风吹走了。',
      active: 'home',
      path: '/404.html',
      canonical: toAbsolute(site.url, '/404.html')
    },
    content
  });
};

const xml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const renderAtom = (posts, site) => {
  const updated = posts[0] ? isoDateTime(posts[0].updated || posts[0].date) : new Date().toISOString();
  const entries = posts.map((post) => `
  <entry>
    <title>${xml(post.title)}</title>
    <link href="${xml(toAbsolute(site.url, post.path))}"/>
    <id>${xml(toAbsolute(site.url, post.path))}</id>
    <published>${xml(isoDateTime(post.date))}</published>
    <updated>${xml(isoDateTime(post.updated || post.date))}</updated>
    <category term="${xml(post.category)}"/>
    ${post.tags.map((tag) => `<category term="${xml(tag)}"/>`).join('\n    ')}
    <summary type="html">${xml(post.excerpt)}</summary>
  </entry>`).join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xml(site.title)}</title>
  <subtitle>${xml(site.subtitle)}</subtitle>
  <link href="${xml(site.url + '/atom.xml')}" rel="self"/>
  <link href="${xml(site.url + '/')}"/>
  <updated>${xml(updated)}</updated>
  <id>${xml(site.url + '/')}</id>
  <author><name>${xml(site.author)}</name></author>
  <generator>wanfeng-static-blog</generator>
  ${entries}
</feed>`;
};

const renderSitemap = (site, pages) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((page) => `  <url><loc>${xml(toAbsolute(site.url, page))}</loc></url>`).join('\n')}
</urlset>`;

const removeSourceMaps = async (dir) => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await removeSourceMaps(full);
    else if (entry.name.endsWith('.map')) await rm(full, { force: true });
  }
};

const main = async () => {
  const site = await readJson(join(contentDir, 'site.json'));
  if (process.env.SITE_URL) {
    site.url = process.env.SITE_URL.replace(/\/+$/, '');
  }
  const postFiles = (await readdir(join(contentDir, 'posts'))).filter((file) => file.endsWith('.html'));

  const rawPosts = [];
  for (const file of postFiles) {
    const raw = await readFile(join(contentDir, 'posts', file), 'utf8');
    const match = raw.match(/^\s*<!--meta\s*([\s\S]*?)-->\s*/);
    if (!match) throw new Error(`No front matter found in ${file}`);
    let meta;
    try {
      meta = JSON.parse(match[1]);
    } catch (error) {
      throw new Error(`Invalid JSON front matter in ${file}: ${error.message}`);
    }
    const body = raw.slice(match[0].length);
    const text = stripTags(body);
    const slug = meta.slug || file.replace(/\.html$/, '');
    rawPosts.push({
      ...meta,
      slug,
      date: formatDate(meta.date),
      updated: meta.updated ? formatDate(meta.updated) : '',
      path: `/posts/${slug}.html`,
      body,
      text,
      words: text.replace(/\s/g, '').length,
      reading: Number(meta.reading) || estimateReading(text),
      excerpt: meta.excerpt || (text.slice(0, 120) + '…'),
      views: meta.views || '—',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      tagInfos: []
    });
  }

  const posts = rawPosts.sort((a, b) => b.date.localeCompare(a.date));

  /* categories */
  const categoryMap = new Map();
  posts.forEach((post) => {
    if (!categoryMap.has(post.category)) {
      categoryMap.set(post.category, { name: post.category, posts: [], color: '#f79533' });
    }
    categoryMap.get(post.category).posts.push(post);
  });
  const categories = [...categoryMap.values()]
    .sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name, 'zh'));
  categories.forEach((category, index) => {
    category.id = `cat-${index}`;
    category.color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
    category.posts.forEach((post) => {
      post.categoryId = category.id;
      post.categoryColor = category.color;
    });
  });

  /* tags */
  const tagMap = new Map();
  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      if (!tagMap.has(tag)) tagMap.set(tag, { name: tag, count: 0, posts: [] });
      const info = tagMap.get(tag);
      info.count++;
      info.posts.push(post);
    });
  });
  const tags = [...tagMap.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
  tags.forEach((tag, index) => {
    tag.id = `tag-${index}`;
    tag.posts.forEach((post) => post.tagInfos.push(tag));
  });
  posts.forEach((post) => {
    const processed = processBody(post.body, post.slug);
    post.toc = processed.toc;
    post.body = processed.body;
  });

  const totalWords = posts.reduce((sum, post) => sum + post.words, 0);
  const totalReading = posts.reduce((sum, post) => sum + post.reading, 0);
  const stats = {
    posts: posts.length,
    categories: categories.length,
    tags: tags.length,
    words: totalWords,
    reading: totalReading,
    wordsLabel: totalWords >= 1000 ? (totalWords / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(totalWords),
    timeLabel: totalReading >= 60
      ? `${Math.floor(totalReading / 60)} 小时 ${totalReading % 60} 分`
      : `${totalReading} 分钟`
  };
  site.stats = stats;

  await clean(outDir);
  await ensureDir(outDir);
  await cp(join(themeDir, 'assets'), join(outDir, 'assets'), { recursive: true });
  await cp(join(root, 'vendor', 'live2d'), join(outDir, 'vendor', 'live2d'), { recursive: true });
  await cp(join(root, 'live2d'), join(outDir, 'live2d'), { recursive: true });
  await removeSourceMaps(join(outDir, 'vendor'));

  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  for (let page = 1; page <= totalPages; page++) {
    const slice = posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    await writePage(pageFile(page), renderHome(slice, page, totalPages, site, stats));
  }

  for (const post of posts) {
    await writePage(`posts/${post.slug}.html`, renderPostPage(post, { posts, site, stats }));
  }

  await writePage('archives.html', renderArchives(posts, site, stats));
  await writePage('categories.html', renderCategories(categories, site, stats));
  await writePage('tags.html', renderTags(tags, posts, site, stats));
  await writePage('about.html', await renderAbout(site, stats));
  await writePage('404.html', render404(site, stats));

  const searchIndex = posts.map((post) => ({
    title: post.title,
    url: post.path,
    date: post.date,
    category: post.category,
    tags: post.tags,
    excerpt: post.excerpt,
    content: post.text.slice(0, 1600)
  }));
  await writeFile(join(outDir, 'search.json'), JSON.stringify(searchIndex), 'utf8');
  await writeFile(join(outDir, 'atom.xml'), renderAtom(posts, site), 'utf8');

  const sitemapPages = ['/', ...Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => `/page/${i + 2}/`), ...posts.map((post) => post.path), '/archives.html', '/categories.html', '/tags.html', '/about.html'];
  await writeFile(join(outDir, 'sitemap.xml'), renderSitemap(site, sitemapPages), 'utf8');
  await writeFile(join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`, 'utf8');
  await writeFile(join(outDir, '.nojekyll'), '', 'utf8');

  console.log('');
  console.log('  晚风小筑 · build complete');
  console.log(`  ${posts.length} posts / ${categories.length} categories / ${tags.length} tags`);
  console.log(`  ${totalPages} home page(s), ${stats.wordsLabel} words`);
  console.log(`  output: ${relative(process.cwd(), outDir) || outDir}`);
  console.log('');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
