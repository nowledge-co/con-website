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

function markdownUrlForPage(urlPath) {
  if (urlPath === '/') return '/home.md';
  if (urlPath === '/docs/') return '/docs.md';
  if (urlPath === '/changelog/') return '/changelog.md';
  return `${urlPath.replace(/\/$/, '')}.md`;
}

function assetPathForUrl(urlPath) {
  return path.join(OUT_DIR, urlPath.replace(/^\/+/, ''));
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
  assert(!urls.some((urlPath) => urlPath.endsWith('.md')), 'sitemap must not include markdown mirrors', errors);
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
    assert(html.includes(`<link rel="alternate" type="text/markdown" href="${SITE_URL}${markdownUrlForPage(urlPath)}"`), `${urlPath} missing markdown alternate`, errors);
    assert(/<meta name="description" content="[^"]{20,}"/.test(html), `${urlPath} missing useful description`, errors);
    assert(html.includes('<meta name="twitter:card" content="summary_large_image"/>'), `${urlPath} missing twitter card`, errors);
    assert(html.includes('<script type="application/ld+json">'), `${urlPath} missing JSON-LD`, errors);
    assert(!/href="(docs\/|\.\.\/|README\.md|CHANGELOG\.md|HACKING\.md|DESIGN\.md)/.test(html), `${urlPath} has unresolved relative doc href`, errors);
    assert(!/src="assets\//.test(html), `${urlPath} has unresolved relative asset src`, errors);

    const markdownPath = assetPathForUrl(markdownUrlForPage(urlPath));
    let markdown = '';
    try {
      markdown = await readText(markdownPath);
    } catch {
      errors.push(`${urlPath} has no generated markdown mirror ${path.relative(OUT_DIR, markdownPath)}`);
      continue;
    }
    assert(markdown.includes(`canonical: "${SITE_URL}${urlPath}"`), `${markdownUrlForPage(urlPath)} missing canonical header`, errors);
    assert(/^---\ntitle: /m.test(markdown), `${markdownUrlForPage(urlPath)} missing frontmatter title`, errors);
  }

  const robots = await readText(path.join(OUT_DIR, 'robots.txt'));
  assert(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`), 'robots.txt missing sitemap', errors);
  assert(robots.includes(`LLMS: ${SITE_URL}/llms.txt`), 'robots.txt missing llms.txt pointer', errors);
  assert(robots.includes('User-agent: GPTBot'), 'robots.txt missing explicit AI crawler policy', errors);

  const llms = await readText(path.join(OUT_DIR, 'llms.txt'));
  assert(llms.includes(`[Docs](${SITE_URL}/docs/)`), 'llms.txt missing docs URL', errors);
  assert(llms.includes(`[Changelog](${SITE_URL}/changelog/)`), 'llms.txt missing changelog URL', errors);
  assert(llms.includes(`[Full Markdown bundle](${SITE_URL}/llms-full.txt)`), 'llms.txt missing full bundle URL', errors);
  const llmsFull = await readText(path.join(OUT_DIR, 'llms-full.txt'));
  assert(llmsFull.includes('Generated from nowledge-co/con-terminal@'), 'llms-full.txt missing source header', errors);

  const agentCorpus = JSON.parse(await readText(path.join(OUT_DIR, 'assets', 'docs-agent-corpus.json')));
  assert(agentCorpus.version === 1, 'docs-agent-corpus.json must have version 1', errors);
  assert(Array.isArray(agentCorpus.documents) && agentCorpus.documents.length >= urls.length, 'docs-agent-corpus.json missing documents', errors);
  assert(agentCorpus.documents.some((doc) => doc.scope === 'product_context'), 'docs-agent-corpus.json missing product context', errors);
  assert(agentCorpus.documents.some((doc) => doc.scope === 'developer_notes_safe'), 'docs-agent-corpus.json missing safe developer notes', errors);
  assert(agentCorpus.documents.every((doc) => doc.path && doc.title && doc.url && Array.isArray(doc.sections)), 'docs-agent-corpus.json has malformed document entries', errors);
  assert(agentCorpus.documents.some((doc) => doc.content.includes('PTY is canonical')), 'docs-agent-corpus.json missing terminal-first product thesis', errors);

  const agentMap = JSON.parse(await readText(path.join(OUT_DIR, 'assets', 'docs-agent-map.json')));
  assert(Array.isArray(agentMap.files) && agentMap.files.length === agentCorpus.documents.length, 'docs-agent-map.json file count must match corpus', errors);
  assert(agentMap.files.some((file) => file.path === 'docs/agent.md'), 'docs-agent-map.json missing docs/agent.md', errors);

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
