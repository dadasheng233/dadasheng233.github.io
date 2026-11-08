const base = process.env.CHECK_BASE || 'http://127.0.0.1:4200';
const pages = [
  '/',
  '/page/2/',
  '/archives.html',
  '/categories.html',
  '/tags.html',
  '/words.html',
  '/about.html',
  '/404.html',
  '/posts/hello-live2d.html',
  '/posts/night-code-lamp.html',
  '/posts/autumn-city.html',
  '/posts/static-blog.html',
  '/posts/slow-reading.html',
  '/posts/new-season.html'
];

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

for (const asset of ['/assets/icons.svg', '/assets/icons.html', '/assets/css/site.css', '/assets/js/site.js', '/assets/js/cat.js', '/assets/js/edit-map.js', '/assets/js/words.js', '/vendor/live2d/waifu-tips.js', '/vendor/live2d/live2d.min.js', '/vendor/live2d/chunk/index.js', '/vendor/live2d/chunk/index2.js', '/live2d/tororo/tororo.model.json', '/live2d/tororo/moc/tororo.moc', '/live2d/waifu-tips.json', '/words.json', '/search.json', '/atom.xml', '/sitemap.xml']) {
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
