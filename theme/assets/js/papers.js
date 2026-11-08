/* 四级真题库：按年份筛选 */
(() => {
  const app = document.getElementById('papers-app');
  if (!app) return;

  const filters = Array.from(app.querySelectorAll('[data-paper-filter]'));
  const cards = Array.from(app.querySelectorAll('[data-paper-year]'));
  const count = app.querySelector('#paper-count');
  const empty = app.querySelector('#paper-empty');

  const apply = (year) => {
    let visible = 0;
    filters.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.paperFilter === year);
    });
    cards.forEach((card) => {
      const show = year === 'all' || card.dataset.paperYear === year;
      card.hidden = !show;
      if (show) visible++;
    });
    if (count) count.textContent = visible + ' 套';
    if (empty) empty.hidden = visible > 0;
  };

  filters.forEach((button) => {
    button.addEventListener('click', () => apply(button.dataset.paperFilter));
  });
})();
