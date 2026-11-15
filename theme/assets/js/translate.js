/* 晚风小筑 · 翻译与释义
   优先用本地 CET-4 词库；整句 / 生词走免费的 MyMemory 接口（无需 key），
   Google 翻译作为备用。查询结果缓存在 localStorage，避免重复请求。 */
(() => {
  'use strict';

  const CACHE_PREFIX = 'wanfeng:translate:v1:';
  const MAX_CACHE = 240;
  const MIN_INTERVAL = 400;
  const translateMeta = document.querySelector('meta[name="blog-translate"]');
  const CUSTOM_ENDPOINT = translateMeta && translateMeta.content ? translateMeta.content.trim() : '';
  let lastRequest = 0;
  let chain = Promise.resolve();
  let wordsPromise = null;
  let wordsMap = null;

  const cache = {
    get(key) {
      try {
        return localStorage.getItem(CACHE_PREFIX + key);
      } catch (error) {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(CACHE_PREFIX + key, value);
        trim();
      } catch (error) { /* 隐私模式忽略 */ }
    }
  };

  function trim() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) keys.push(key);
      }
      if (keys.length <= MAX_CACHE) return;
      keys.slice(0, keys.length - MAX_CACHE).forEach((key) => localStorage.removeItem(key));
    } catch (error) { /* noop */ }
  }

  function decodeEntities(text) {
    return String(text)
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ');
  }

  function throttle() {
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL - (now - lastRequest));
    lastRequest = now + wait;
    return new Promise((resolve) => setTimeout(resolve, wait));
  }

  async function viaCustom(text) {
    if (!CUSTOM_ENDPOINT) throw new Error('没有配置自定义翻译接口');
    const response = await fetch(CUSTOM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'en', target: 'zh', format: 'text' }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('自定义接口 HTTP ' + response.status);
    const data = await response.json();
    if (!data || !data.translatedText) throw new Error('自定义接口没有返回译文');
    return String(data.translatedText).trim();
  }

  async function viaMyMemory(text) {
    const url = 'https://api.mymemory.translated.net/get?mt=1&langpair=en|zh-CN&q='
      + encodeURIComponent(text);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('MyMemory HTTP ' + response.status);
    const data = await response.json();
    const translated = data && data.responseData && data.responseData.translatedText;
    if (!translated || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(translated)) {
      throw new Error('MyMemory 未返回译文');
    }
    return decodeEntities(translated).trim();
  }

  async function viaGoogle(text) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh-CN&dt=t&q='
      + encodeURIComponent(text);
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('Google HTTP ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('Google 返回格式异常');
    return data[0].map((part) => (Array.isArray(part) ? part[0] : '')).join('').trim();
  }

  async function translate(text, options = {}) {
    const source = String(text || '').trim();
    if (!source) return '';
    if (source.length > 480) throw new Error('这段文本太长了，先取其中一句试试');
    const cacheKey = options.from === 'en' ? source : `auto:${source}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    // 串行 + 限速，避免触发免费额度限制
    const run = async () => {
      const fresh = cache.get(cacheKey);
      if (fresh) return fresh;
      await throttle();
      let result = '';
      let lastError = null;
      if (CUSTOM_ENDPOINT) {
        try {
          result = await viaCustom(source);
        } catch (error) {
          lastError = error;
        }
      }
      if (!result) {
        try {
          result = await viaMyMemory(source);
        } catch (error) {
          lastError = error;
        }
      }
      if (!result) {
        try {
          result = await viaGoogle(source);
        } catch (error) {
          lastError = error;
        }
      }
      if (!result) {
        throw new Error('翻译服务暂时不可用，稍后再试（' + (lastError && lastError.message ? lastError.message : '网络错误') + '）');
      }
      cache.set(cacheKey, result);
      return result;
    };

    chain = chain.then(run, run);
    return chain;
  }

  function loadWords() {
    if (!wordsPromise) {
      wordsPromise = fetch('/words.json')
        .then((response) => (response.ok ? response.json() : []))
        .then((list) => {
          const map = new Map();
          (Array.isArray(list) ? list : []).forEach((item) => {
            if (item && item.word) map.set(String(item.word).toLowerCase(), item);
          });
          wordsMap = map;
          return map;
        })
        .catch(() => new Map());
    }
    return wordsPromise;
  }

  async function meaningOf(word) {
    const key = String(word || '').trim().toLowerCase();
    if (!key) return { word: key, meaning: '' };
    const map = wordsMap || await loadWords();
    const entry = map.get(key);
    if (entry && entry.meaning) {
      return {
        word: entry.word || key,
        meaning: entry.meaning,
        phonetic: entry.phonetic || '',
        pos: entry.pos || '',
        source: '本地 CET-4 词库'
      };
    }
    const translation = await translate(key);
    return { word: key, meaning: translation, phonetic: '', pos: '', source: 'MyMemory 翻译' };
  }

  window.BlogTranslate = { translate, meaningOf, loadWords };
})();
