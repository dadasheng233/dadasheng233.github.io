/* 晚风小筑 · 英文词形变化
   让 abandon / abandons / abandoned / abandoning 互相命中，
   目前覆盖规则变化：-s/-es/-ies、-ed/-ied、-ing/-ying、短词双写。 */
(() => {
  'use strict';

  const cache = new Map();
  const WORD_RE = /^[a-z]+$/;

  function build(word) {
    const w = word;
    const set = new Set([w]);
    const add = (value) => {
      if (value && value.length >= 2) set.add(value);
    };

    if (WORD_RE.test(w)) {
      if (w.length >= 3) {
        add(w + 's');
        add(w + 'es');
        if (/[^aeiou]y$/.test(w)) {
          add(w.slice(0, -1) + 'ies');
          add(w.slice(0, -1) + 'ied');
        }
        add(/e$/.test(w) ? w + 'd' : w + 'ed');
        if (/ie$/.test(w)) add(w.slice(0, -2) + 'ying');
        else if (/e$/.test(w)) add(w.slice(0, -1) + 'ing');
        else add(w + 'ing');

        // stop -> stopped / stopping，只对短词双写，避免 visit -> visitting
        if (w.length <= 6 && /[^aeiou][aeiou][bcdfgklmnprstvz]$/.test(w)) {
          const doubled = w + w.slice(-1);
          add(doubled + 'ed');
          add(doubled + 'ing');
        }
      }

      // 反向：从变形猜原形
      const bases = [];
      if (/ies$/.test(w)) bases.push(w.slice(0, -3) + 'y');
      if (/(?:s|x|z|ch|sh)es$/.test(w)) bases.push(w.slice(0, -2));
      else if (/s$/.test(w) && !/(ss|us|is)$/.test(w)) bases.push(w.slice(0, -1));
      if (/ied$/.test(w)) bases.push(w.slice(0, -3) + 'y');
      else if (/ed$/.test(w)) {
        bases.push(w.slice(0, -2));
        bases.push(w.slice(0, -1));
      }
      if (/ying$/.test(w)) bases.push(w.slice(0, -4) + 'ie');
      else if (/ing$/.test(w)) {
        bases.push(w.slice(0, -3));
        bases.push(w.slice(0, -3) + 'e');
      }
      for (const base of [...bases]) {
        if (/([bcdfgklmnprstvz])\1$/.test(base)) bases.push(base.slice(0, -1));
      }
      for (const base of bases) {
        if (!base || base.length < 3) continue;
        add(base);
        add(base + 's');
        add(base + 'es');
        add(/e$/.test(base) ? base + 'd' : base + 'ed');
        add(/e$/.test(base) ? base.slice(0, -1) + 'ing' : base + 'ing');
      }
    }

    return set;
  }

  function forms(word) {
    const key = String(word || '').toLowerCase().trim();
    if (!key) return new Set();
    const cached = cache.get(key);
    if (cached) return cached;
    const value = build(key);
    if (cache.size > 8000) cache.clear();
    cache.set(key, value);
    return value;
  }

  function match(first, second) {
    const a = forms(first);
    const b = String(second || '').toLowerCase().trim();
    if (a.has(b)) return true;
    for (const item of forms(b)) {
      if (a.has(item)) return true;
    }
    return false;
  }

  const api = { forms, match };
  if (typeof window !== 'undefined') window.WordForms = api;
  if (typeof globalThis !== 'undefined') globalThis.WordForms = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
