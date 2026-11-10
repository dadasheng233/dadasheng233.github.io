const base = process.env.CHECK_BASE || 'http://127.0.0.1:4200';
const pages = [
  '/',
  '/archives.html',
  '/categories.html',
  '/tags.html',
  '/words.html',
  '/papers.html',
  '/paper.html',
  '/learn.html',
  '/visual.html',
  '/about.html',
  '/404.html'
];

try {
  const index = await (await fetch(base + '/search.json')).json();
  pages.push(...index.map((post) => post.url));
} catch (error) {
  console.log('could not read search.json; checking static pages only');
}

const seen = new Map();
const bad = [];

const check = async (url) => {
  if (seen.has(url)) return seen.get(url);
  const promise = fetch(url, { redirect: 'follow' }).then((response) => {
    if (!response.ok) bad.push([url, response.status]);
    return response;
  }).catch((error) => {
    bad.push([url, error.message]);
    return null;
  });
  seen.set(url, promise);
  return promise;
};

for (const page of pages) {
  const response = await check(base + page);
  if (!response || !response.ok) continue;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) continue;
  const html = await response.text();
  const urls = new Set();
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const raw = match[1];
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('javascript:') || raw.startsWith('http')) continue;
    const resolved = new URL(raw, base + page);
    resolved.hash = '';
    urls.add(resolved.href);
  }
  for (const url of urls) await check(url);
}

for (const asset of ['/assets/icons.svg', '/assets/icons.html', '/assets/css/site.css', '/assets/js/site.js', '/assets/js/cat.js', '/assets/js/edit-map.js', '/assets/js/words.js', '/assets/js/papers.js', '/assets/js/pdf-reader.js', '/assets/js/dsa.js', '/assets/js/visual.js', '/assets/companion-demo.html', '/assets/companion-single.html', '/assets/vendor/pdfjs/pdf.min.mjs', '/assets/vendor/pdfjs/pdf.worker.min.mjs', '/assets/papers/2024-06/set1-paper.pdf', '/dsa.json', '/vendor/live2d/waifu-tips.js', '/vendor/live2d/live2d.min.js', '/vendor/live2d/chunk/index.js', '/vendor/live2d/chunk/index2.js', '/live2d/tororo/tororo.model.json', '/live2d/tororo/moc/tororo.moc', '/live2d/waifu-tips.json', '/words.json', '/search.json', '/atom.xml', '/sitemap.xml']) {
  await check(base + asset);
}

console.log(`checked ${seen.size} URLs`);
if (bad.length) {
  console.log(`\n${bad.length} problem(s):`);
  bad.forEach(([url, reason]) => console.log(`  ${reason}  ${url}`));
  process.exitCode = 1;
} else {
  console.log('all internal links and live assets look good.');
}
