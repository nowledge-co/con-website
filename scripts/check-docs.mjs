import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'dist');
const SITE_URL = 'https://con.nowledge.co';

function localPathForUrl(urlPath) {
  const clean = urlPath.replace(/^\/+|\/+$/g, '');
  return path.join(OUT_DIR, clean || '.', clean ? 'index.html' : 'index.html');
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

async function readText(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function main() {
  const errors = [];
  const manifest = JSON.parse(await readText(path.join(OUT_DIR, 'assets', 'docs-manifest.json')));
  assert(manifest.version === 1, 'assets/docs-manifest.json must have version 1', errors);
  assert(Array.isArray(manifest.groups) && manifest.groups.length > 0, 'docs manifest must contain groups', errors);

  const sitemap = await readText(path.join(OUT_DIR, 'sitemap.xml'));
  const urls = [...sitemap.matchAll(/<loc>https:\/\/con\.nowledge\.co([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert(urls.includes('/docs/'), 'sitemap must include /docs/', errors);
  assert(urls.includes('/changelog/'), 'sitemap must include /changelog/', errors);
  assert(!urls.includes('/og-image/'), 'sitemap must not include /og-image/', errors);

  for (const urlPath of urls) {
    const filePath = localPathForUrl(urlPath);
    let html = '';
    try {
      html = await readText(filePath);
    } catch {
      errors.push(`sitemap URL ${urlPath} has no generated ${path.relative(OUT_DIR, filePath)}`);
      continue;
    }

    assert(html.includes(`<link rel="canonical" href="${SITE_URL}${urlPath}"/>`), `${urlPath} missing canonical`, errors);
    assert(/<meta name="description" content="[^"]{20,}"/.test(html), `${urlPath} missing useful description`, errors);
    assert(html.includes('<meta name="twitter:card" content="summary_large_image"/>'), `${urlPath} missing twitter card`, errors);
    assert(html.includes('<script type="application/ld+json">'), `${urlPath} missing JSON-LD`, errors);
    assert(!/href="(docs\/|\.\.\/|README\.md|CHANGELOG\.md|HACKING\.md|DESIGN\.md)/.test(html), `${urlPath} has unresolved relative doc href`, errors);
    assert(!/src="assets\//.test(html), `${urlPath} has unresolved relative asset src`, errors);
  }

  const og = await readText(path.join(OUT_DIR, 'og-image', 'index.html'));
  assert(og.includes('<meta name="robots" content="noindex, nofollow"/>'), '/og-image/ must be noindex', errors);

  if (errors.length) {
    for (const error of errors) console.error(`docs check error: ${error}`);
    process.exit(1);
  }

  console.log(`docs check ok: ${urls.length} sitemap URLs, ${manifest.groups.length} manifest groups`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
