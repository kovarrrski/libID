import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { indexableEntry } from './src/sitemap.mjs';

const dist = new URL('./dist/', import.meta.url);
const files = (await readdir(dist, { recursive: true })).filter((path) => path.endsWith('.html'));
assert.ok(files.length > 1, 'Build the site before testing its generated HTML.');
const canonicals = [];
const titles = new Set();
const descriptions = new Set();
for (const file of files) {
  const html = await readFile(new URL(file.replace(/\\/g, '/'), dist), 'utf8');
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  assert.ok(head, file);
  // Copy buttons contain literal HTML snippets inside quoted attributes.
  // Tokenize whole tags so those snippets are not counted as page landmarks.
  const tags = html.match(/<(?:[^"'<>]|"[^"]*"|'[^']*')*>/g) || [];
  assert.equal(tags.filter((tag) => /^<main(?:\s|>)/i.test(tag)).length, 1, `${file}: one main`);
  assert.equal(tags.filter((tag) => /^<h1(?:\s|>)/i.test(tag)).length, 1, `${file}: one h1`);
  assert.equal((head.match(/<title>/g) || []).length, 1, file);
  if (file === '404.html') {
    assert.match(head, /name="robots" content="noindex"/);
    assert.doesNotMatch(head, /rel="canonical"/);
    continue;
  }
  const title = head.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = head.match(/name="description" content="([^"]+)"/)?.[1];
  assert.ok(title && description, `${file}: static metadata`);
  assert.ok(!titles.has(title), `${file}: unique title`);
  assert.ok(!descriptions.has(description), `${file}: unique description`);
  titles.add(title);
  descriptions.add(description);
  const canonical = head.match(/rel="canonical" href="([^"]+)"/)?.[1];
  assert.equal((head.match(/rel="canonical"/g) || []).length, 1, file);
  const expected = `https://lib.id/${file.replace(/\\/g, '/').replace(/index\.html$/, '')}`;
  assert.equal(canonical, expected, `${file}: self canonical`);
  canonicals.push(canonical);
  for (const key of ['og:title', 'og:description', 'og:url', 'og:type', 'og:image',
    'og:image:width', 'og:image:height', 'og:image:type', 'og:image:alt',
    'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt']) {
    assert.equal((head.match(new RegExp(`(?:name|property)="${key}"`, 'g')) || []).length, 1, `${file}: ${key}`);
  }
  assert.match(head, /name="twitter:card" content="summary_large_image"/);
  assert.match(head, /property="og:image" content="https:\/\/lib.id\/og.png"/);
  const json = head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(JSON.parse(json)['@graph'].some((item) => item.name === 'libID'), file);
  assert.equal((await indexableEntry({ url: canonical }, dist))?.url, canonical);
}
const sitemap = await readFile(new URL('sitemap-0.xml', dist), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url);
assert.deepEqual(urls.sort(), canonicals.sort());
assert.doesNotMatch(sitemap, /<lastmod>/);
const robots = await readFile(new URL('robots.txt', dist), 'utf8');
assert.match(robots, /ai-train=yes/);
assert.match(robots, /Sitemap: https:\/\/lib.id\/sitemap-index.xml/);
assert.doesNotMatch(robots, /Disallow:\s*\//);
const png = await readFile(new URL('og.png', dist));
assert.equal(png.subarray(1, 4).toString(), 'PNG');
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);

// A future non-Starlight noindex page (such as a launcher) is excluded too.
const temporary = await mkdtemp(join(tmpdir(), 'libid-sitemap-'));
try {
  await mkdir(join(temporary, 'launcher'));
  const page = join(temporary, 'launcher', 'index.html');
  const item = { url: 'https://lib.id/launcher/' };
  const directory = pathToFileURL(`${temporary}/`);
  for (const meta of [
    '<meta content="noindex,follow" name="robots">',
    '<meta name="robots" content="none">',
    '<meta http-equiv="refresh" content="0;url=/">',
  ]) {
    await writeFile(page, `<head><link rel="canonical" href="${item.url}">${meta}</head>`);
    assert.equal(await indexableEntry(item, directory), undefined);
  }
  await writeFile(page, '<head><link rel="canonical" href="https://lib.id/other/"></head>');
  assert.equal(await indexableEntry(item, directory), undefined);
  assert.equal(await indexableEntry({ url: 'https://lib.id/missing/' }, directory), undefined);
} finally {
  // `temporary` is the directory returned by mkdtemp above, never user input.
  await rm(temporary, { recursive: true });
}
console.log(`SEO checks passed for ${canonicals.length} indexable pages and 404.`);
