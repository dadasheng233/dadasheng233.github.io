export const escapeHtml = (str = '') => String(str)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');



/*这个地方是替换html的格式的，方便直接从代码里拉去出来*/
export const stripTags = (html = '') => String(html)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();
/*去掉首尾的空白字符串*/

export const slugify = (text = '') => {
  const value = stripTags(text)
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}\-]+/gu, '')
    .replace(/^-+|-+$/g, '');
  return value || 'section';
};

export const dateParts = (iso = '') => {
  const [year, month, day] = String(iso).split('-');
  return { year: year || '', month: month || '', day: day || '', short: `${month}-${day}` };
};

export const formatDate = (iso = '') => {
  const { year, month, day } = dateParts(iso);
  return `${year}-${month}-${day}`;
};

export const isoDateTime = (iso = '') => `${iso}T00:00:00+08:00`;

export const toAbsolute = (siteUrl = '', path = '/') => {
  if (/^https?:\/\//i.test(path)) return path;
  return String(siteUrl).replace(/\/$/, '') + (String(path).startsWith('/') ? path : '/' + path);
};
