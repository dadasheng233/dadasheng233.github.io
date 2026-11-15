/* 晚风小筑 · 账号与云同步
   负责：登录/注册弹窗、当前用户、学习进度推送与拉取。
   其它脚本通过 window.BlogAuth / window.BlogSync 使用，不依赖框架。 */
(() => {
  'use strict';

  const meta = document.querySelector('meta[name="blog-api"]');
  const configured = meta && meta.content ? meta.content.trim() : '';
  const API = configured || (location.port === '4200' ? 'http://127.0.0.1:8080' : '');

  const state = { user: null, ready: false };
  const listeners = new Set();
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const response = await fetch(API + path, {
      credentials: 'include',
      ...options,
      headers
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = { error: text };
      }
    }
    if (!response.ok) {
      const error = new Error((data && data.error) || '请求失败');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  function setUser(user) {
    state.user = user || null;
    state.ready = true;
    listeners.forEach((fn) => {
      try { fn(state.user); } catch (error) { /* noop */ }
    });
    document.documentElement.classList.toggle('is-signed-in', Boolean(state.user));
    updateTriggers();
  }

  function onChange(fn) {
    listeners.add(fn);
    if (state.ready) {
      try { fn(state.user); } catch (error) { /* noop */ }
    }
  }

  function updateTriggers() {
    document.querySelectorAll('[data-account-trigger]').forEach((node) => {
      const label = node.querySelector('.account-label');
      if (label) label.textContent = state.user ? displayName(state.user) : '登录';
      node.classList.toggle('is-user', Boolean(state.user));
      node.setAttribute('title', state.user
        ? `${displayName(state.user)} · 账号与同步`
        : '登录 / 注册，开启学习进度云同步');
    });
  }

  function displayName(user) {
    return (user && (user.displayName || user.username)) || '账号';
  }

  /* ---------------- 弹窗 ---------------- */

  let modal = null;
  let mode = 'login';
  let pending = [];

  function buildModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'account-modal';
    modal.id = 'account-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    modal.setAttribute('aria-labelledby', 'account-title');
    modal.innerHTML = `
      <div class="account-backdrop" data-account-close></div>
      <div class="account-panel">
        <button class="account-close" type="button" data-account-close aria-label="关闭">×</button>
        <div class="account-body" id="account-body"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-account-close]')) close();
    });
    return modal;
  }

  function renderSignedOut(errorMessage = '') {
    const tabs = `
      <div class="account-tabs" role="tablist">
        <button type="button" class="account-tab ${mode === 'login' ? 'is-active' : ''}" data-account-mode="login" role="tab">登录</button>
        <button type="button" class="account-tab ${mode === 'register' ? 'is-active' : ''}" data-account-mode="register" role="tab">注册</button>
      </div>`;
    const loginForm = `
      <form class="account-form" data-account-form="login" novalidate>
        <label class="account-field"><span>用户名</span>
          <input name="username" autocomplete="username" required maxlength="20" placeholder="3-20 位，可用中英文">
        </label>
        <label class="account-field"><span>密码</span>
          <input name="password" type="password" autocomplete="current-password" required placeholder="至少 8 位">
        </label>
        <p class="account-error" role="alert"></p>
        <button class="account-submit" type="submit">登录</button>
        <p class="account-hint">登录后，单词进度和数据结构答题记录会同步到服务器，换设备也能接着学。</p>
      </form>`;
    const registerForm = `
      <form class="account-form" data-account-form="register" novalidate>
        <label class="account-field"><span>用户名</span>
          <input name="username" autocomplete="username" required maxlength="20" placeholder="3-20 位，可用中英文">
        </label>
        <label class="account-field"><span>昵称（可选）</span>
          <input name="displayName" autocomplete="nickname" maxlength="24" placeholder="显示在页面上的名字">
        </label>
        <label class="account-field"><span>密码</span>
          <input name="password" type="password" autocomplete="new-password" required placeholder="至少 8 位">
        </label>
        <p class="account-error" role="alert"></p>
        <button class="account-submit" type="submit">注册并登录</button>
        <p class="account-hint">注册不需要邮箱，账号只保存在这台服务器上。</p>
      </form>`;
    document.querySelector('#account-body').innerHTML = `
      <p class="account-kicker">晚风小筑</p>
      <h2 class="account-title" id="account-title">${mode === 'login' ? '欢迎回来' : '创建一个账号'}</h2>
      ${tabs}
      ${mode === 'login' ? loginForm : registerForm}
      <p class="account-error account-error-global">${escapeHtml(errorMessage)}</p>`;

    document.querySelectorAll('[data-account-mode]').forEach((tab) => {
      tab.addEventListener('click', () => {
        mode = tab.dataset.accountMode;
        renderSignedOut();
      });
    });
    const form = document.querySelector('[data-account-form="' + mode + '"]');
    if (form) form.addEventListener('submit', (event) => handleSubmit(event, form));
  }

  function renderSignedIn() {
    const user = state.user;
    const adminLink = user && user.admin
      ? `<a class="account-link" href="/admin.html">后台管理</a>`
      : '';
    document.querySelector('#account-body').innerHTML = `
      <p class="account-kicker">已登录</p>
      <h2 class="account-title" id="account-title">${escapeHtml(displayName(user))}</h2>
      <p class="account-username">@${escapeHtml(user.username)}</p>
      <div class="account-sync">
        <span class="account-dot" aria-hidden="true"></span>
        学习进度云同步已开启
      </div>
      <div class="account-links">
        <a class="account-link" href="/practice.html">408 练习</a>
        <a class="account-link" href="/words.html">单词本</a>
        ${adminLink}
      </div>
      <button class="account-logout" type="button" data-account-logout>退出登录</button>
      <p class="account-hint">退出后，本机仍保留一份离线进度。</p>`;
    const logout = document.querySelector('[data-account-logout]');
    if (logout) logout.addEventListener('click', async () => {
      logout.disabled = true;
      try {
        await api('/api/auth/logout', { method: 'POST' });
      } catch (error) { /* 忽略网络错误，本地照样退出 */ }
      setUser(null);
      renderSignedOut();
      toast('已退出登录');
    });
  }

  async function handleSubmit(event, form) {
    event.preventDefault();
    const submit = form.querySelector('.account-submit');
    const errorNode = form.querySelector('.account-error');
    const data = Object.fromEntries(new FormData(form).entries());
    errorNode.textContent = '';
    submit.disabled = true;
    submit.dataset.label = submit.textContent;
    submit.textContent = '请稍候…';
    try {
      const result = await api(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      setUser(result.user);
      renderSignedIn();
      pending.splice(0).forEach((resolve) => resolve(result.user));
      toast(mode === 'login' ? '登录成功，云同步已开启' : '注册成功，已自动登录');
    } catch (error) {
      errorNode.textContent = error.message || '操作失败，请稍后再试';
      if (error.status === 0 || error.message === 'Failed to fetch') {
        errorNode.textContent = '连不上后端服务，请先在 server 目录运行 Spring Boot。';
      }
    } finally {
      submit.disabled = false;
      submit.textContent = submit.dataset.label || '提交';
    }
  }

  function open(nextMode = 'login') {
    mode = nextMode;
    buildModal();
    document.body.classList.add('account-open');
    modal.setAttribute('aria-hidden', 'false');
    if (state.user) renderSignedIn(); else renderSignedOut();
    const firstInput = modal.querySelector('input');
    if (firstInput) setTimeout(() => firstInput.focus(), 30);
  }

  function close() {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('account-open');
    pending.splice(0).forEach((resolve) => resolve(null));
  }

  function requireLogin(nextMode = 'login') {
    if (state.user) return Promise.resolve(state.user);
    open(nextMode);
    return new Promise((resolve) => pending.push(resolve));
  }

  function toast(message) {
    let node = document.querySelector('.account-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'account-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('is-visible');
    clearTimeout(node._timer);
    node._timer = setTimeout(() => node.classList.remove('is-visible'), 2600);
  }

  /* ---------------- 进度同步 ---------------- */

  const timers = new Map();
  const lastPushed = new Map();
  const syncing = new Set();

  function push(kind, data) {
    if (!state.user) return;
    const payload = JSON.stringify(data);
    if (lastPushed.get(kind) === payload) return;
    clearTimeout(timers.get(kind));
    timers.set(kind, setTimeout(async () => {
      timers.delete(kind);
      syncing.add(kind);
      try {
        await api('/api/progress/' + encodeURIComponent(kind), {
          method: 'PUT',
          body: payload
        });
        lastPushed.set(kind, payload);
        document.dispatchEvent(new CustomEvent('blog:synced', { detail: { kind, ok: true } }));
      } catch (error) {
        document.dispatchEvent(new CustomEvent('blog:synced', { detail: { kind, ok: false, error } }));
      } finally {
        syncing.delete(kind);
      }
    }, 700));
  }

  async function pull(kind) {
    if (!state.user) return null;
    try {
      const data = await api('/api/progress/' + encodeURIComponent(kind));
      return data && data.exists ? data : null;
    } catch (error) {
      return null;
    }
  }

  /* ---------------- 启动 ---------------- */

  function bindTrigger() {
    document.querySelectorAll('[data-account-trigger]').forEach((node) => {
      node.addEventListener('click', (event) => {
        event.preventDefault();
        open();
      });
    });
    document.addEventListener('click', (event) => {
      const opener = event.target.closest('[data-account-open]');
      if (opener) {
        event.preventDefault();
        open();
      }
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal && modal.getAttribute('aria-hidden') === 'false') close();
    });
  }

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.BlogAuth = {
    API,
    ready,
    get user() { return state.user; },
    isAdmin() { return Boolean(state.user && state.user.admin); },
    displayName,
    onChange,
    open,
    close,
    requireLogin,
    login: (username, password) => api('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password })
    }).then((result) => { setUser(result.user); return result.user; }),
    logout: async () => {
      try { await api('/api/auth/logout', { method: 'POST' }); } catch (error) { /* noop */ }
      setUser(null);
    },
    api,
    toast
  };

  window.BlogSync = { push, pull, isSyncing: (kind) => syncing.has(kind) };

  bindTrigger();
  updateTriggers();

  api('/api/auth/me')
    .then((result) => setUser(result && result.authenticated ? result.user : null))
    .catch(() => setUser(null))
    .finally(() => resolveReady(state.user));
})();
