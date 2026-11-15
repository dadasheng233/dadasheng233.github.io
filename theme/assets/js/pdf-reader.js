/* 四级真题 PDF 阅读器 · PDF.js */
(() => {
  'use strict';

  const root = document.getElementById('pdf-reader');
  if (!root) return;

  const $ = (selector) => root.querySelector(selector);
  const canvas = $('#pdf-canvas');
  const stage = $('#pdf-stage');
  const status = $('#pdf-status');
  const title = $('#pdf-title');
  const pageInfo = $('#pdf-page-info');
  const zoomLabel = $('#pdf-zoom');
  const download = $('#pdf-download');
  const params = new URLSearchParams(location.search);

  const file = params.get('file') || '';
  const displayTitle = params.get('title') || 'PDF 阅读器';
  const back = params.get('back') || '/papers.html';
  const hashPage = Number((location.hash.match(/page=(\d+)/) || [])[1]);
  const initialPage = Math.max(1, Number(params.get('page')) || hashPage || 1);
  const highlightWord = String(params.get('word') || '').trim().toLowerCase();

  const safeFile = /^\/assets\/papers\/[A-Za-z0-9._/-]+\.pdf$/.test(file) && !file.includes('..');
  if (!safeFile) {
    showError('PDF 地址无效，请从真题库重新打开。');
    return;
  }

  root.querySelector('.pdf-back').setAttribute('href', back);
  title.textContent = displayTitle;
  document.title = displayTitle + ' | 真题库';
  download.setAttribute('href', file);
  download.setAttribute('download', file.split('/').pop() || 'paper.pdf');

  let pdf = null;
  let pageNumber = 1;
  let zoom = 1;
  let fitScale = 1;
  let rendering = false;
  let renderTask = null;
  let pendingPage = null;
  let wordBoxes = null;
  let lastPageData = null;

  const overlay = document.createElement('div');
  overlay.className = 'pdf-annotations';
  overlay.setAttribute('aria-hidden', 'true');
  stage.appendChild(overlay);

  const annotationNote = document.createElement('div');
  annotationNote.className = 'pdf-annotation-note';
  annotationNote.hidden = true;
  stage.parentNode.insertBefore(annotationNote, stage);

  const boxesUrl = (filePath) => {
    const match = /^\/assets\/papers\/(.+)\.pdf$/i.exec(filePath);
    return match ? '/paper-boxes/' + match[1] + '.json' : null;
  };

  async function ensureBoxes() {
    if (!highlightWord || wordBoxes) return;
    const url = boxesUrl(file);
    if (!url) {
      wordBoxes = { pages: [] };
      return;
    }
    try {
      const response = await fetch(url);
      wordBoxes = response.ok ? await response.json() : { pages: [] };
    } catch (error) {
      console.warn('[pdf] word boxes failed', error);
      wordBoxes = { pages: [] };
    }
  }

  const normalizeToken = (value) => String(value || '')
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, '');

  const drawAnnotations = (number) => {
    overlay.innerHTML = '';
    const oldPop = stage.querySelector('.pdf-hit-pop');
    if (oldPop) oldPop.remove();
    if (!highlightWord) return;
    const pageData = wordBoxes && wordBoxes.pages ? wordBoxes.pages[number - 1] : null;
    lastPageData = pageData;
    if (!pageData || !Array.isArray(pageData.words)) {
      annotationNote.hidden = true;
      return;
    }

    const tokens = pageData.words;
    let hits = tokens.filter((item) => normalizeToken(item[0]) === highlightWord);
    if (!hits.length) {
      hits = tokens.filter((item) => normalizeToken(item[0]).includes(highlightWord));
    }

    overlay.style.left = canvas.offsetLeft + 'px';
    overlay.style.top = canvas.offsetTop + 'px';
    overlay.style.width = canvas.clientWidth + 'px';
    overlay.style.height = canvas.clientHeight + 'px';

    if (!hits.length) {
      annotationNote.hidden = false;
      annotationNote.innerHTML = `本页没有找到 <b>${highlightWord}</b>，试试翻到结果中标注的页码。`;
      return;
    }

    hits.forEach((item, index) => {
      const mark = document.createElement('button');
      mark.type = 'button';
      mark.className = 'pdf-hit';
      mark.dataset.word = item[0];
      mark.dataset.index = String(index + 1);
      mark.style.left = (item[1] * 100) + '%';
      mark.style.top = (item[2] * 100) + '%';
      mark.style.width = ((item[3] - item[1]) * 100) + '%';
      mark.style.height = ((item[4] - item[2]) * 100) + '%';
      mark.setAttribute('aria-label', `标注：${item[0]}`);
      mark.title = item[0];
      overlay.appendChild(mark);
    });

    annotationNote.hidden = false;
    annotationNote.innerHTML = `已标注 <b>${hits.length}</b> 处「${highlightWord}」，点击高亮块看释义。`;
    const first = overlay.querySelector('.pdf-hit');
    if (first) {
      const top = first.offsetTop;
      if (top > stage.clientHeight * 0.6) stage.scrollTop = Math.max(0, top - 80);
    }
  };

  const openHitPopover = (mark) => {
    const existing = stage.querySelector('.pdf-hit-pop');
    if (existing) existing.remove();
    const pop = document.createElement('div');
    pop.className = 'pdf-hit-pop';
    pop.innerHTML = `<strong>${mark.dataset.word}</strong><p class="pdf-hit-meaning">正在查释义…</p>
      <a href="/words.html?tab=exam&q=${encodeURIComponent(highlightWord)}">在单词页查看真题出处 →</a>`;
    stage.appendChild(pop);
    const left = Math.min(Math.max(8, mark.offsetLeft + overlay.offsetLeft), stage.clientWidth - 240);
    const top = mark.offsetTop + overlay.offsetTop + mark.offsetHeight + 6;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';

    if (window.BlogTranslate) {
      window.BlogTranslate.meaningOf(highlightWord)
        .then((result) => {
          pop.querySelector('.pdf-hit-meaning').textContent = result.meaning || '暂无释义';
        })
        .catch((error) => {
          pop.querySelector('.pdf-hit-meaning').textContent = error.message || '释义获取失败';
        });
    } else {
      pop.querySelector('.pdf-hit-meaning').textContent = '翻译脚本没有加载';
    }
  };

  overlay.addEventListener('click', (event) => {
    const mark = event.target.closest('.pdf-hit');
    if (mark) openHitPopover(mark);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.pdf-hit') && !event.target.closest('.pdf-hit-pop')) {
      const pop = stage.querySelector('.pdf-hit-pop');
      if (pop) pop.remove();
    }
  });

  const setStatus = (text) => {
    if (!status) return;
    status.textContent = text;
    status.hidden = false;
  };

  const clearStatus = () => {
    if (status) status.hidden = true;
  };

  function showError(message) {
    setStatus(message);
    if (canvas) canvas.hidden = true;
  }

  const updateControls = () => {
    if (!pdf) return;
    if (pageInfo) pageInfo.textContent = `${pageNumber} / ${pdf.numPages}`;
    if (zoomLabel) zoomLabel.textContent = Math.round(zoom * 100) + '%';
    const prev = root.querySelector('[data-pdf-prev]');
    const next = root.querySelector('[data-pdf-next]');
    if (prev) prev.disabled = pageNumber <= 1;
    if (next) next.disabled = pageNumber >= pdf.numPages;
  };

  const measureFit = async () => {
    if (!pdf) return;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    fitScale = Math.max(0.3, Math.min(3, (stage.clientWidth - 48) / viewport.width));
  };

  const renderPage = async (number) => {
    if (!pdf) return;
    if (rendering) {
      pendingPage = number;
      return;
    }
    rendering = true;
    pageNumber = Math.max(1, Math.min(pdf.numPages, number));
    if (location.hash !== `#page=${pageNumber}`) {
      history.replaceState(null, '', `#page=${pageNumber}`);
    }
    updateControls();

    try {
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const effective = fitScale * zoom;
      const viewport = page.getViewport({ scale: effective });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.hidden = false;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';

      if (renderTask) {
        renderTask.cancel();
        renderTask = null;
      }

      const context = canvas.getContext('2d');
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, viewport.width, viewport.height);

      renderTask = page.render({ canvasContext: context, viewport });
      await renderTask.promise;
      renderTask = null;
      clearStatus();
      stage.scrollTop = 0;
      drawAnnotations(pageNumber);
    } catch (error) {
      if (error && error.name === 'RenderingCancelledException') {
        /* 上一页的渲染被取消，正常 */
      } else {
        console.error(error);
        setStatus('这一页渲染失败，试试刷新或下载 PDF。');
      }
    } finally {
      rendering = false;
      if (pendingPage !== null) {
        const next = pendingPage;
        pendingPage = null;
        renderPage(next);
      }
    }
  };

  const go = (delta) => {
    if (!pdf) return;
    const next = Math.max(1, Math.min(pdf.numPages, pageNumber + delta));
    if (next !== pageNumber) renderPage(next);
  };

  const setZoom = (value) => {
    zoom = Math.max(0.5, Math.min(3, value));
    renderPage(pageNumber);
  };

  const fit = () => {
    zoom = 1;
    measureFit().then(() => renderPage(pageNumber));
  };

  root.querySelector('[data-pdf-prev]').addEventListener('click', () => go(-1));
  root.querySelector('[data-pdf-next]').addEventListener('click', () => go(1));
  root.querySelector('[data-pdf-zoom-in]').addEventListener('click', () => setZoom(zoom * 1.2));
  root.querySelector('[data-pdf-zoom-out]').addEventListener('click', () => setZoom(zoom / 1.2));
  root.querySelector('[data-pdf-fit]').addEventListener('click', fit);
  root.querySelector('[data-pdf-fullscreen]').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen && stage.requestFullscreen();
  });

  document.addEventListener('keydown', (event) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
    if (event.key === '+' || event.key === '=') setZoom(zoom * 1.2);
    if (event.key === '-') setZoom(zoom / 1.2);
  });

  window.addEventListener('resize', () => {
    if (!pdf) return;
    measureFit().then(() => renderPage(pageNumber));
  });

  (async () => {
    try {
      setStatus('正在加载 PDF…');
      const pdfjs = await import('/assets/vendor/pdfjs/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/assets/vendor/pdfjs/pdf.worker.min.mjs';
      const task = pdfjs.getDocument({ url: file });
      task.onProgress = ({ loaded, total }) => {
        if (total) setStatus(`正在加载 PDF… ${Math.round((loaded / total) * 100)}%`);
        else setStatus('正在加载 PDF…');
      };
      pdf = await task.promise;
      await ensureBoxes();
      await measureFit();
      updateControls();
      await renderPage(Math.min(initialPage, pdf.numPages));
    } catch (error) {
      console.error(error);
      showError('PDF 加载失败，可能是文件过大或浏览器不支持。可以点右上角「下载」直接看。');
    }
  })();
})();
