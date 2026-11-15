/* 晚风小筑 · 后台管理
   仅管理员可见：写文章 / 一键构建 / 导入 408 题库。 */
(() => {
  'use strict';

  const app = document.getElementById('admin-app');
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
    tab: 'posts',
    posts: [],
    sets: [],
    current: null,
    loading: false,
    buildOutput: '',
    busy: false
  };

  const SUBJECTS = ['ds', 'co', 'os', 'cn'];
  const SUBJECT_LABELS = { ds: '数据结构', co: '计算机组成原理', os: '操作系统', cn: '计算机网络' };
  const SAMPLE_BANK = {
    title: '2024 年 408 真题 · 数据结构（示例）',
    subject: 'ds',
    year: 2024,
    source: '你的来源',
    description: '导入后可在 408 练习页看到。',
    questions: [
      {
        type: 'single',
        stem: '题干写在这里，支持任意长度。',
        options: [
          { key: 'A', text: '选项 A' },
          { key: 'B', text: '选项 B' },
          { key: 'C', text: '选项 C' },
          { key: 'D', text: '选项 D' }
        ],
        answer: 'A',
        analysis: '解析写在这里。',
        difficulty: 2,
        knowledge: '知识点'
      }
    ]
  };

  function api(path, options) {
    return auth.api(path, options);
  }

  function today() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function loginBlock() {
    return `
      <div class="admin-empty">
        <p class="page-kicker">ADMIN</p>
        <h2>需要管理员账号</h2>
        <p>用管理员登录后才能写文章、导入题库。管理员账号在 <code>server/src/main/resources/application.yml</code> 里配置。</p>
        <button class="btn-read" type="button" data-account-open>登录</button>
      </div>`;
  }

  function render() {
    if (!auth || !auth.user) {
      app.innerHTML = loginBlock();
      return;
    }
    if (!auth.isAdmin()) {
      app.innerHTML = `
        <div class="admin-empty">
          <p class="page-kicker">ADMIN</p>
          <h2>当前账号不是管理员</h2>
          <p>你登录的是 <b>${esc(auth.displayName(auth.user))}</b>。管理员默认用户名是 <code>admin</code>，密码在服务端配置。</p>
          <button class="practice-back" type="button" data-admin-logout>退出并换一个账号</button>
        </div>`;
      return;
    }
    app.innerHTML = `
      <div class="admin-shell">
        <header class="admin-head">
          <div>
            <p class="page-kicker">ADMIN CONSOLE</p>
            <h1>后台管理</h1>
          </div>
          <div class="admin-head-actions">
            <button class="admin-build" type="button" data-admin-build>${state.busy ? '构建中…' : '重新构建站点'}</button>
            <span class="admin-user">${esc(auth.displayName(auth.user))}</span>
          </div>
        </header>
        <div class="admin-tabs" role="tablist">
          <button class="admin-tab ${state.tab === 'posts' ? 'is-active' : ''}" type="button" data-admin-tab="posts">文章</button>
          <button class="admin-tab ${state.tab === 'questions' ? 'is-active' : ''}" type="button" data-admin-tab="questions">408 题库</button>
          <button class="admin-tab ${state.tab === 'build' ? 'is-active' : ''}" type="button" data-admin-tab="build">构建日志</button>
        </div>
        <div class="admin-panel" data-admin-panel="posts">${renderPosts()}</div>
        <div class="admin-panel" data-admin-panel="questions" ${state.tab === 'questions' ? '' : 'hidden'}>${renderQuestions()}</div>
        <div class="admin-panel" data-admin-panel="build" ${state.tab === 'build' ? '' : 'hidden'}>${renderBuild()}</div>
      </div>`;
  }

  /* ---------------- 文章 ---------------- */

  function renderPosts() {
    if (state.current) return renderEditor();
    const items = state.posts.map((post) => `
      <tr>
        <td><strong>${esc(post.title)}</strong><br><span class="admin-muted">/posts/${esc(post.slug)}.html</span></td>
        <td>${esc(post.date || '')}</td>
        <td>${esc(post.category || '')}</td>
        <td>${post.size >= 1024 ? (post.size / 1024).toFixed(1) + ' KB' : post.size + ' B'}</td>
        <td class="admin-actions">
          <button type="button" data-admin-edit="${esc(post.slug)}">编辑</button>
          <a href="${esc(post.path)}" target="_blank" rel="noopener">预览</a>
          <button type="button" class="is-danger" data-admin-delete="${esc(post.slug)}">删除</button>
        </td>
      </tr>`).join('');

    return `
      <div class="admin-toolbar">
        <h2>文章（${state.posts.length}）</h2>
        <button class="btn-read" type="button" data-admin-new>新建文章</button>
      </div>
      ${state.posts.length ? `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>标题</th><th>日期</th><th>分类</th><th>大小</th><th>操作</th></tr></thead>
            <tbody>${items}</tbody>
          </table>
        </div>` : '<p class="admin-muted">还没有文章，点「新建文章」开始。</p>'}
      <p class="admin-hint">保存只会写入 <code>content/posts/</code>；要让改动出现在页面上，还需要点右上角「重新构建站点」（或保存时用「保存并构建」）。</p>`;
  }

  function renderEditor() {
    const post = state.current;
    const meta = post.meta || {};
    const isNew = !post.existing;
    return `
      <div class="admin-editor">
        <div class="admin-toolbar">
          <h2>${isNew ? '新建文章' : '编辑：' + esc(meta.title || post.slug)}</h2>
          <button class="practice-back" type="button" data-admin-cancel>返回列表</button>
        </div>
        <form class="editor-form" id="editor-form">
          <div class="editor-grid">
            <label><span>slug（地址，英文字母/数字/-）</span>
              <input name="slug" value="${esc(post.slug || '')}" ${isNew ? '' : 'readonly'} required pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,79}">
            </label>
            <label><span>标题</span><input name="title" value="${esc(meta.title || '')}" required></label>
            <label><span>日期</span><input name="date" type="date" value="${esc(meta.date || today())}" required></label>
            <label><span>分类</span><input name="category" value="${esc(meta.category || '随笔')}" required></label>
            <label><span>标签（逗号分隔）</span><input name="tags" value="${esc((meta.tags || []).join(', '))}"></label>
            <label><span>阅读时长（分钟，可空）</span><input name="reading" type="number" min="1" max="999" value="${meta.reading || ''}"></label>
            <label><span>副标题</span><input name="subtitle" value="${esc(meta.subtitle || '')}"></label>
            <label><span>封面路径</span><input name="cover" value="${esc(meta.cover || '')}" placeholder="/assets/img/cover-horizon.svg"></label>
            <label><span>浏览量（展示用）</span><input name="views" value="${esc(meta.views || '')}" placeholder="1.2k"></label>
            <label class="editor-check"><input name="featured" type="checkbox" ${meta.featured ? 'checked' : ''}> <span>首页推荐</span></label>
          </div>
          <label class="editor-full"><span>摘要</span><textarea name="excerpt" rows="2">${esc(meta.excerpt || '')}</textarea></label>
          <label class="editor-full"><span>正文（HTML）</span><textarea name="body" rows="18" spellcheck="false">${esc(post.body || '')}</textarea></label>
          <div class="editor-actions">
            <button class="btn-read" type="button" data-admin-save="draft">保存</button>
            <button class="admin-build" type="button" data-admin-save="build">保存并构建</button>
            <span class="admin-muted" id="editor-status"></span>
          </div>
        </form>
      </div>`;
  }

  async function loadPosts() {
    state.loading = true;
    render();
    try {
      const result = await api('/api/admin/posts');
      state.posts = result.items || [];
    } catch (error) {
      auth.toast(error.message || '文章列表加载失败');
    } finally {
      state.loading = false;
      render();
    }
  }

  async function openEditor(slug) {
    if (!slug) {
      state.current = {
        existing: false,
        slug: '',
        meta: { date: today(), category: '随笔', tags: [] },
        body: '<p>正文从这里开始。</p>'
      };
      render();
      return;
    }
    try {
      const detail = await api('/api/admin/posts/' + encodeURIComponent(slug));
      state.current = {
        existing: true,
        slug: detail.slug,
        meta: detail.meta || {},
        body: detail.body || ''
      };
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      auth.toast(error.message || '文章读取失败');
    }
  }

  function collectEditor() {
    const form = $('#editor-form');
    const data = new FormData(form);
    const tags = String(data.get('tags') || '')
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const reading = Number(data.get('reading'));
    return {
      slug: String(data.get('slug') || '').trim(),
      title: String(data.get('title') || '').trim(),
      subtitle: String(data.get('subtitle') || '').trim(),
      date: String(data.get('date') || '').trim(),
      category: String(data.get('category') || '').trim(),
      tags,
      cover: String(data.get('cover') || '').trim(),
      excerpt: String(data.get('excerpt') || '').trim(),
      views: String(data.get('views') || '').trim(),
      reading: Number.isFinite(reading) && reading > 0 ? reading : null,
      featured: data.get('featured') === 'on',
      body: String(data.get('body') || '')
    };
  }

  async function savePost(andBuild) {
    const payload = collectEditor();
    const status = $('#editor-status');
    const buttons = $$('[data-admin-save]');
    buttons.forEach((button) => { button.disabled = true; });
    if (status) status.textContent = '保存中…';
    try {
      const existing = state.current && state.current.existing;
      if (!existing) {
        await api('/api/admin/posts', { method: 'POST', body: JSON.stringify(payload) });
      } else {
        await api('/api/admin/posts/' + encodeURIComponent(state.current.slug), {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      }
      state.current = null;
      await loadPosts();
      auth.toast('文章已保存');
      if (andBuild) await runBuild();
    } catch (error) {
      if (status) status.textContent = error.message || '保存失败';
      auth.toast(error.message || '保存失败');
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  async function deletePost(slug) {
    if (!window.confirm(`删除「${slug}」？文件会移到 content/backups/，不会真的丢。`)) return;
    try {
      await api('/api/admin/posts/' + encodeURIComponent(slug), { method: 'DELETE' });
      auth.toast('已移到 content/backups/');
      await loadPosts();
    } catch (error) {
      auth.toast(error.message || '删除失败');
    }
  }

  /* ---------------- 408 题库 ---------------- */

  function renderQuestions() {
    const rows = state.sets.map((set) => `
      <tr>
        <td><strong>${esc(set.title)}</strong><br><span class="admin-muted">${esc(set.source || '')}</span></td>
        <td>${esc(set.subjectLabel || SUBJECT_LABELS[set.subject] || set.subject)}</td>
        <td>${set.year || '—'}</td>
        <td>${set.questionCount}</td>
        <td>${set.published ? '<span class="admin-badge is-on">已发布</span>' : '<span class="admin-badge">隐藏</span>'}</td>
        <td class="admin-actions">
          <button type="button" data-admin-publish="${set.id}" data-published="${set.published ? '1' : '0'}">${set.published ? '隐藏' : '发布'}</button>
          <button type="button" class="is-danger" data-admin-delete-set="${set.id}">删除</button>
        </td>
      </tr>`).join('');

    return `
      <div class="admin-toolbar">
        <h2>408 题库（${state.sets.length} 套）</h2>
        <a class="btn-read" href="/practice.html" target="_blank" rel="noopener">打开练习页</a>
      </div>

      <section class="admin-import">
        <h3>导入题库</h3>
        <p class="admin-hint">JSON 格式：<code>{ title, subject, year, source, questions: [{ type, stem, options, answer, analysis }] }</code>；
          subject 可选 <code>ds</code> / <code>co</code> / <code>os</code> / <code>cn</code>。一次最多 500 题。</p>
        <div class="admin-import-tools">
          <label class="admin-file">选择 JSON 文件<input type="file" accept=".json,application/json" data-admin-import-file></label>
          <button class="practice-back" type="button" data-admin-sample>填入示例</button>
        </div>
        <textarea id="bank-json" rows="12" spellcheck="false" placeholder="把题库 JSON 粘贴到这里…">${esc(state.bankDraft || '')}</textarea>
        <div class="editor-actions">
          <button class="btn-read" type="button" data-admin-import>导入题库</button>
          <span class="admin-muted" id="bank-status"></span>
        </div>
      </section>

      ${state.sets.length ? `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>题库</th><th>科目</th><th>年份</th><th>题数</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>` : '<p class="admin-muted">还没有题库，导入一份试试。</p>'}
      <p class="admin-hint">删除题库会同时删除其中的题目和大家的答题记录，谨慎操作。</p>`;
  }

  async function loadSets() {
    try {
      const sets = await api('/api/admin/questions/sets');
      state.sets = Array.isArray(sets) ? sets : [];
    } catch (error) {
      auth.toast(error.message || '题库列表加载失败');
    }
    render();
  }

  async function importBank() {
    const textarea = $('#bank-json');
    const status = $('#bank-status');
    if (!textarea) return;
    let payload;
    try {
      payload = JSON.parse(textarea.value);
    } catch (error) {
      if (status) status.textContent = 'JSON 解析失败：' + error.message;
      return;
    }
    const button = $('[data-admin-import]');
    if (button) button.disabled = true;
    if (status) status.textContent = '导入中…';
    try {
      const result = await api('/api/admin/questions/import', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (status) status.textContent = `导入成功，题库 ID ${result.setId}`;
      textarea.value = '';
      state.bankDraft = '';
      await loadSets();
    } catch (error) {
      if (status) status.textContent = error.message || '导入失败';
    } finally {
      if (button) button.disabled = false;
    }
  }

  /* ---------------- 构建 ---------------- */

  function renderBuild() {
    return `
      <div class="admin-toolbar">
        <h2>构建日志</h2>
        <button class="admin-build" type="button" data-admin-build>${state.busy ? '构建中…' : '开始构建'}</button>
      </div>
      <p class="admin-hint">构建会运行项目根目录的 <code>node build.mjs</code>，把 <code>content/</code> 重新生成到 <code>public/</code>。文章保存后必须构建才会出现在页面上。</p>
      <pre class="admin-log" id="build-log">${esc(state.buildOutput || '还没有构建记录。')}</pre>`;
  }

  async function runBuild() {
    state.busy = true;
    state.buildOutput = '正在运行 node build.mjs…\n';
    state.tab = 'build';
    render();
    try {
      const result = await api('/api/admin/build', { method: 'POST' });
      state.buildOutput = `退出码：${result.ok ? '0（成功）' : '非 0（失败）'} · 用时 ${result.durationMs} ms\n\n${result.output || ''}`;
      auth.toast(result.ok ? '构建完成' : '构建失败，看看日志');
    } catch (error) {
      state.buildOutput = '构建请求失败：' + (error.message || '未知错误');
      auth.toast('构建失败');
    } finally {
      state.busy = false;
      render();
    }
  }

  /* ---------------- 事件 ---------------- */

  app.addEventListener('click', async (event) => {
    const tab = event.target.closest('[data-admin-tab]');
    if (tab) {
      state.tab = tab.dataset.adminTab;
      state.current = null;
      render();
      return;
    }
    if (event.target.closest('[data-admin-new]')) {
      openEditor('');
      return;
    }
    const edit = event.target.closest('[data-admin-edit]');
    if (edit) {
      openEditor(edit.dataset.adminEdit);
      return;
    }
    const del = event.target.closest('[data-admin-delete]');
    if (del) {
      deletePost(del.dataset.adminDelete);
      return;
    }
    if (event.target.closest('[data-admin-cancel]')) {
      state.current = null;
      render();
      return;
    }
    const save = event.target.closest('[data-admin-save]');
    if (save) {
      savePost(save.dataset.adminSave === 'build');
      return;
    }
    if (event.target.closest('[data-admin-build]')) {
      runBuild();
      return;
    }
    if (event.target.closest('[data-admin-logout]')) {
      await auth.logout();
      render();
      return;
    }
    const publish = event.target.closest('[data-admin-publish]');
    if (publish) {
      try {
        await api(`/api/admin/questions/sets/${publish.dataset.adminPublish}/publish`, {
          method: 'PATCH',
          body: JSON.stringify({ published: publish.dataset.published !== '1' })
        });
        await loadSets();
      } catch (error) {
        auth.toast(error.message || '操作失败');
      }
      return;
    }
    const deleteSet = event.target.closest('[data-admin-delete-set]');
    if (deleteSet) {
      if (!window.confirm('删除这套题库？题目和答题记录会一起删除。')) return;
      try {
        await api('/api/admin/questions/sets/' + deleteSet.dataset.adminDeleteSet, { method: 'DELETE' });
        auth.toast('题库已删除');
        await loadSets();
      } catch (error) {
        auth.toast(error.message || '删除失败');
      }
      return;
    }
    if (event.target.closest('[data-admin-sample]')) {
      const textarea = $('#bank-json');
      if (textarea) textarea.value = JSON.stringify(SAMPLE_BANK, null, 2);
      return;
    }
    if (event.target.closest('[data-admin-import]')) {
      importBank();
    }
  });

  app.addEventListener('change', (event) => {
    const file = event.target.closest('[data-admin-import-file]');
    if (!file || !file.files || !file.files[0]) return;
    const reader = new FileReader();
    reader.onload = () => {
      const textarea = $('#bank-json');
      if (textarea) textarea.value = String(reader.result || '');
    };
    reader.readAsText(file.files[0], 'utf-8');
  });

  if (auth) {
    auth.onChange(() => {
      render();
      if (auth.isAdmin()) {
        if (!state.posts.length) loadPosts();
        if (!state.sets.length) loadSets();
      }
    });
  } else {
    render();
  }
})();
