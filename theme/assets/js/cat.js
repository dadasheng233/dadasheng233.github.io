/* 晚风小筑 · 左下角的小猫
   模型来自 Live2D Tororo，加载器是 live2d-widget（GPL-3.0）。

   显示规则（避免出现两只猫）：
   1. 窄屏、系统开启「减少动态效果」、或者没有 WebGL：只显示静态猫图；
   2. 其余情况先不显示任何猫，等模型真正画到 canvas 上再显示 Live2D；
   3. 只有模型加载失败或超时才退回静态猫图。 */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = window.matchMedia('(max-width: 1180px)').matches;

const showFallbackOnly = () => {
  const fallback = document.getElementById('cat-fallback');
  if (fallback) fallback.classList.add('is-visible');
  document.body.classList.remove('cat-ready', 'cat-loading');
  document.body.classList.add('cat-fallback-mode');
};

const showLiveCat = () => {
  const fallback = document.getElementById('cat-fallback');
  if (fallback) fallback.classList.remove('is-visible');
  document.body.classList.remove('cat-fallback-mode', 'cat-loading');
  document.body.classList.add('cat-ready');
};

const canUseWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (error) {
    return false;
  }
};

const liveCatReady = () => {
  const waifu = document.getElementById('waifu');
  if (!waifu || waifu.classList.contains('waifu-hidden')) return false;
  const canvas = waifu.querySelector('#live2d canvas');
  return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
};

const waitUntilReady = (started = Date.now()) => {
  if (document.body.classList.contains('cat-ready')) return;
  if (liveCatReady()) {
    showLiveCat();
    return;
  }
  if (Date.now() - started > 10000) {
    console.warn('[cat] Live2D 加载超时，已切换到静态猫图。');
    showFallbackOnly();
    return;
  }
  window.setTimeout(() => waitUntilReady(started), 250);
};

const boot = async () => {
  if (reduceMotion || narrow || !canUseWebGL()) {
    return;
  }

  document.body.classList.add('cat-loading');

  try {
    await import('/vendor/live2d/waifu-tips.js');
    if (typeof window.initWidget !== 'function') throw new Error('initWidget is unavailable');

    window.initWidget({
      waifuPath: '/live2d/waifu-tips.json',
      cubism2Path: '/vendor/live2d/live2d.min.js',
      logLevel: 'warn',
      drag: false
    });

    waitUntilReady();
  } catch (error) {
    console.warn('[cat] Live2D 没有成功启动。', error);
    document.body.classList.remove('cat-loading');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

