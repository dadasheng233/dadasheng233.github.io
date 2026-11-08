/* 晚风小筑 · 交互
   原生 JS，无依赖。所有增强功能在失败时都应优雅降级。 */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;

  const escapeHtml = (str = '') => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const escapeReg = (str = '') => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const debounce = (fn, wait = 100) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  /* ---------------------------------------------------------------- pace */
  const pace = $('#pace');
  if (pace) {
    const bar = $('span', pace);
    requestAnimationFrame(() => pace.classList.add('is-running'));
    setTimeout(() => { if (bar) bar.style.width = '68%'; }, 120);
    const finish = () => {
      if (bar) bar.style.width = '100%';
      pace.classList.add('is-done');
      setTimeout(() => pace.remove(), 900);
    };
    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish, { once: true });
    setTimeout(finish, 3800);
  }

  /* ------------------------------------------------------------ reveal */
  const revealItems = $$('.reveal');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -36px' });
    revealItems.forEach((el) => io.observe(el));
  } else {
    revealItems.forEach((el) => el.classList.add('is-in'));
  }

  /* --------------------------------------------------------------- year */
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());

  const sinceEl = $('#days');
  if (sinceEl && body.dataset.since) {
    const since = new Date(body.dataset.since + 'T00:00:00+08:00');
    if (!Number.isNaN(since.getTime())) {
      const days = Math.max(1, Math.floor((Date.now() - since.getTime()) / 86400000) + 1);
      sinceEl.textContent = `本站已经写了 ${days} 天`;
    }
  }

  /* --------------------------------------------------------------- scroll */
  const progress = $('#reading-progress');
  const percent = $('#scroll-percent');
  const backToTop = $('#back-to-top');
  let ticking = false;

  const tocLinks = $$('.toc a');
  const headings = $$('.post-body h2[id], .post-body h3[id]');

  const updateScrollUI = () => {
    ticking = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    if (progress) progress.style.width = (ratio * 100).toFixed(2) + '%';
    if (percent) percent.textContent = Math.round(ratio * 100) + '%';
    if (backToTop) backToTop.classList.toggle('is-on', window.scrollY > 520);

    if (headings.length && tocLinks.length) {
      let active = headings[0].id;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= 130) active = heading.id;
        else break;
      }
      tocLinks.forEach((link) => {
        const isActive = link.getAttribute('href') === '#' + active;
        link.classList.toggle('is-active', isActive);
      });
    }
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateScrollUI);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  updateScrollUI();

  if (backToTop) {
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ------------------------------------------------------------- nav/sidebar */
  const navToggle = $('.nav-toggle');
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const open = body.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
    });
  }

  const sidebar = $('#sidebar');
  const sidebarToggle = $('#sidebar-toggle');
  const sidebarClose = $('#sidebar-close');
  const sidebarDimmer = $('#sidebar-dimmer');

  const setSidebar = (open) => {
    if (!sidebar) return;
    body.classList.toggle('sidebar-open', open);
    sidebar.setAttribute('aria-hidden', String(!open));
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', String(open));
    if (open) body.classList.remove('nav-open');
  };

  if (sidebarToggle) sidebarToggle.addEventListener('click', () => setSidebar(!body.classList.contains('sidebar-open')));
  if (sidebarClose) sidebarClose.addEventListener('click', () => setSidebar(false));
  if (sidebarDimmer) sidebarDimmer.addEventListener('click', () => setSidebar(false));

  /* --------------------------------------------------------------- search */
  const searchModal = $('#search-modal');
  const searchInput = $('#search-input');
  const searchResults = $('#search-results');
  const searchHint = $('#search-hint');
  let searchIndex = null;
  let searchLoading = false;

  const openSearch = () => {
    if (!searchModal) return;
    setSidebar(false);
    searchModal.classList.add('is-open');
    searchModal.setAttribute('aria-hidden', 'false');
    body.style.overflow = 'hidden';
    window.setTimeout(() => searchInput && searchInput.focus(), 60);
    if (!searchIndex) loadSearchIndex();
    else if (!searchInput.value.trim()) renderSearch('');
  };

  const closeSearch = () => {
    if (!searchModal) return;
    searchModal.classList.remove('is-open');
    searchModal.setAttribute('aria-hidden', 'true');
    body.style.overflow = '';
  };

  $$('.search-trigger').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      openSearch();
    });
  });
  $$('[data-search-close]').forEach((el) => el.addEventListener('click', closeSearch));

  const loadSearchIndex = async () => {
    if (searchLoading || searchIndex) return;
    searchLoading = true;
    if (searchResults) searchResults.innerHTML = '<div class="search-empty">正在把书架翻一遍…</div>';
    try {
      const response = await fetch('/search.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      searchIndex = await response.json();
      renderSearch(searchInput ? searchInput.value : '');
    } catch (error) {
      if (searchResults) searchResults.innerHTML = '<div class="search-empty">搜索索引暂时没有加载出来。可以直接去 <a href="/archives.html">归档</a> 看看。</div>';
    } finally {
      searchLoading = false;
    }
  };

  const mark = (text, query) => {
    const safe = escapeHtml(text);
    const q = query.trim();
    if (!q) return safe;
    const term = escapeHtml(q);
    try {
      return safe.replace(new RegExp('(' + escapeReg(term) + ')', 'gi'), '<mark>$1</mark>');
    } catch (error) {
      return safe;
    }
  };

  const renderSearch = (rawQuery) => {
    if (!searchResults) return;
    const query = String(rawQuery || '').trim();
    if (!searchIndex) return;
    if (searchHint) searchHint.hidden = query.length > 0;

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    let posts = searchIndex;
    if (terms.length) {
      posts = searchIndex
        .map((post) => {
          const title = post.title.toLowerCase();
          const tags = (post.tags || []).join(' ').toLowerCase();
          const category = (post.category || '').toLowerCase();
          const text = (post.excerpt + ' ' + post.content).toLowerCase();
          let score = 0;
          terms.forEach((term) => {
            if (title.includes(term)) score += 8;
            if (tags.includes(term)) score += 5;
            if (category.includes(term)) score += 3;
            if (text.includes(term)) score += 1;
          });
          return { post, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || b.post.date.localeCompare(a.post.date))
        .map((item) => item.post);
    } else {
      posts = searchIndex.slice(0, 5);
    }

    if (!posts.length) {
      searchResults.innerHTML = `<div class="search-empty">没有找到和「${escapeHtml(query)}」有关的文章。<br>换个词试试，或者去归档里翻翻。</div>`;
      return;
    }

    const heading = query ? `找到 ${posts.length} 篇` : '最近更新';
    searchResults.innerHTML = `<div class="tag-result-head"><span>${heading}</span><span>${query ? '按相关度排序' : 'LATEST'}</span></div>` +
      posts.map((post) => `
        <a class="search-result" href="${post.url}">
          <div class="search-result-top">
            <h4>${mark(post.title, query)}</h4>
            <span class="badge">${escapeHtml(post.category)}</span>
          </div>
          <p>${mark(post.excerpt, query)}</p>
        </a>`).join('');
  };

  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => renderSearch(searchInput.value), 90));
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const first = searchResults && searchResults.querySelector('a.search-result');
        if (first) window.location.href = first.getAttribute('href');
      }
    });
  }

  $$('[data-search-suggest]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!searchInput) return;
      searchInput.value = button.dataset.searchSuggest || '';
      renderSearch(searchInput.value);
      searchInput.focus();
    });
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openSearch();
    }
    if (event.key === 'Escape') {
      if (searchModal && searchModal.classList.contains('is-open')) closeSearch();
      else if (body.classList.contains('sidebar-open')) setSidebar(false);
      else if (body.classList.contains('nav-open')) body.classList.remove('nav-open');
    }
  });

  /* ----------------------------------------------------------- code blocks */
  const langLabel = (lang) => ({
    js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript',
    css: 'CSS', html: 'HTML', text: 'Text', bash: 'Shell', sh: 'Shell',
    json: 'JSON', py: 'Python', python: 'Python'
  }[lang] || (lang ? lang.toUpperCase() : 'CODE'));

  const highlightCode = (codeEl, lang) => {
    if (!['js', 'javascript', 'ts', 'css', 'json'].includes(lang)) return;
    let source = codeEl.textContent;
    let safe = escapeHtml(source);
    const stash = [];
    const keep = (html) => {
      stash.push(html);
      return `\u0000${stash.length - 1}\u0000`;
    };

    safe = safe.replace(/(&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;|`[\s\S]*?`)/g, (match) => keep(`<span class="tok-str">${match}</span>`));

    if (lang === 'js' || lang === 'javascript' || lang === 'ts') {
      safe = safe.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, (match) => keep(`<span class="tok-com">${match}</span>`));
      safe = safe.replace(/\b(const|let|var|function|return|if|else|for|while|of|in|new|class|extends|import|export|from|await|async|try|catch|throw|true|false|null|undefined|this|typeof|instanceof)\b/g, (match) => keep(`<span class="tok-key">${match}</span>`));
    } else if (lang === 'css') {
      safe = safe.replace(/(\/\*[\s\S]*?\*\/)/g, (match) => keep(`<span class="tok-com">${match}</span>`));
      safe = safe.replace(/(@[a-z-]+)/g, (match) => keep(`<span class="tok-key">${match}</span>`));
    } else if (lang === 'json') {
      safe = safe.replace(/\b(true|false|null)\b/g, (match) => keep(`<span class="tok-key">${match}</span>`));
    }

    safe = safe.replace(/\u0000(\d+)\u0000/g, (_, index) => stash[Number(index)]);
    codeEl.innerHTML = safe;
  };

  $$('.post-body pre > code').forEach((codeEl) => {
    const pre = codeEl.parentElement;
    const block = document.createElement('div');
    block.className = 'code-block';
    const langClass = Array.from(codeEl.classList).find((name) => name.startsWith('language-'));
    const lang = langClass ? langClass.slice(9).toLowerCase() : 'text';

    highlightCode(codeEl, lang);

    const head = document.createElement('div');
    head.className = 'code-head';
    head.innerHTML = `<span class="code-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>${escapeHtml(langLabel(lang))}</span>`;

    const copy = document.createElement('button');
    copy.className = 'copy-code';
    copy.type = 'button';
    copy.textContent = '复制';
    copy.setAttribute('aria-label', '复制这段代码');
    copy.addEventListener('click', async () => {
      const text = codeEl.textContent;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          const area = document.createElement('textarea');
          area.value = text;
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.appendChild(area);
          area.select();
          document.execCommand('copy');
          area.remove();
        }
        copy.textContent = '已复制';
        copy.classList.add('is-copied');
        setTimeout(() => {
          copy.textContent = '复制';
          copy.classList.remove('is-copied');
        }, 1600);
      } catch (error) {
        copy.textContent = '复制失败';
      }
    });

    head.appendChild(copy);
    pre.parentNode.insertBefore(block, pre);
    block.appendChild(head);
    block.appendChild(pre);
  });

  /* --------------------------------------------------------------- lightbox */
  const lightbox = $('#lightbox');
  const lightboxImage = $('#lightbox-image');
  const lightboxCaption = $('#lightbox-caption');
  const lightboxClose = $('#lightbox-close');
  let lastFocused = null;

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  };

  $$('.post-body img').forEach((img) => {
    img.addEventListener('click', () => {
      if (!lightbox || !lightboxImage) return;
      lastFocused = img;
      lightboxImage.src = img.currentSrc || img.src;
      lightboxImage.alt = img.alt || '';
      const figure = img.closest('figure');
      const caption = figure ? $('figcaption', figure) : null;
      if (lightboxCaption) lightboxCaption.textContent = caption ? caption.textContent : (img.alt || '');
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
      if (lightboxClose) lightboxClose.focus();
    });
  });

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) lightbox.addEventListener('click', (event) => { if (event.target === lightbox) closeLightbox(); });

  /* --------------------------------------------------------------- comments */
  const commentForm = $('#comment-form');
  if (commentForm) {
    const slug = commentForm.dataset.slug || location.pathname;
    const storageKey = 'wanfeng:comments:' + slug;
    const list = $('#comment-list');
    const nameInput = $('#comment-name');
    const textInput = $('#comment-text');

    const readComments = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        const data = raw ? JSON.parse(raw) : [];
        return Array.isArray(data) ? data : [];
      } catch (error) {
        return [];
      }
    };

    const formatTime = (iso) => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      const diff = Date.now() - date.getTime();
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
      if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
      return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const renderComments = () => {
      if (!list) return;
      const items = readComments();
      list.innerHTML = items.length
        ? items.map((item) => `
          <li class="comment-item" data-id="${escapeHtml(item.id)}">
            <div class="comment-meta">
              <span class="comment-avatar">${escapeHtml((item.name || '猫').slice(0, 1))}</span>
              <span class="comment-name">${escapeHtml(item.name)}</span>
              <span class="comment-time">${escapeHtml(formatTime(item.time))}</span>
              <button class="comment-del" type="button" data-delete="${escapeHtml(item.id)}">删除</button>
            </div>
            <div class="comment-text">${escapeHtml(item.text)}</div>
          </li>`).join('')
        : '<li class="comment-empty" style="padding:14px 0;color:#aaa49c;font-family:var(--sans);font-size:12px;">还没有留言。你可以做第一个留下猫爪印的人。</li>';
    };

    commentForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = (nameInput ? nameInput.value : '').trim().slice(0, 24) || '匿名';
      const text = (textInput ? textInput.value : '').trim().slice(0, 500);
      if (!text) {
        if (textInput) textInput.focus();
        return;
      }
      const items = readComments();
      items.unshift({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        text,
        time: new Date().toISOString()
      });
      try {
        localStorage.setItem(storageKey, JSON.stringify(items.slice(0, 50)));
      } catch (error) {
        /* 隐私模式下可能写不进去，页面不因此中断 */
      }
      if (textInput) textInput.value = '';
      renderComments();
    });

    if (list) {
      list.addEventListener('click', (event) => {
        const del = event.target.closest('[data-delete]');
        if (!del) return;
        const id = del.dataset.delete;
        if (!window.confirm('删除这条留言？')) return;
        const items = readComments().filter((item) => item.id !== id);
        try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch (error) { /* noop */ }
        renderComments();
      });
    }

    renderComments();
  }

  /* --------------------------------------------------------------- tag filter */
  const tagCloud = $('#tag-cloud');
  const tagResults = $('#tag-results');
  if (tagCloud && tagResults) {
    const chips = $$('.tag-chip', tagCloud);
    const items = $$('.tag-result-item', tagResults);
    const label = $('#tag-result-label');
    const count = $('#tag-result-count');

    const filter = (tag, labelText) => {
      chips.forEach((chip) => chip.classList.toggle('is-active', chip.dataset.tag === tag));
      let visible = 0;
      items.forEach((item) => {
        const tags = (item.dataset.tags || '').split(' ');
        const show = tag === 'all' || tags.includes(tag);
        item.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      if (label) label.textContent = labelText;
      if (count) count.textContent = visible + ' 篇';
    };

    chips.forEach((chip) => {
      chip.addEventListener('click', () => filter(chip.dataset.tag, chip.dataset.label || '全部文章'));
    });
  }

  /* --------------------------------------------------------- page transition */
  if (!reduceMotion) {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link) return;
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;
      const href = link.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
      let url;
      try { url = new URL(href, location.href); } catch (error) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname) return;
      event.preventDefault();
      body.classList.add('page-leaving');
      setTimeout(() => { window.location.href = url.href; }, 180);
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateScrollUI();
  });
})();
