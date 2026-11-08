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
      await measureFit();
      updateControls();
      await renderPage(1);
    } catch (error) {
      console.error(error);
      showError('PDF 加载失败，可能是文件过大或浏览器不支持。可以点右上角「下载」直接看。');
    }
  })();
})();
