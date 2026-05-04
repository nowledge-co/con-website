import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'dist');
const REPO = 'nowledge-co/con-terminal';
const BRANCH = process.env.CON_TERMINAL_REF || 'main';
const SITE_URL = 'https://con.nowledge.co';
const OG_IMAGE = `${SITE_URL}/assets/og-con.jpg?v=20260504`;
const LOCAL_CON_DIR = process.env.CON_TERMINAL_DIR || path.resolve(ROOT, '..', 'con');
const LOCAL_MANIFEST = process.env.CON_DOCS_MANIFEST || path.join(LOCAL_CON_DIR, 'docs', 'manifest.json');
const BUNDLED_MANIFEST = path.join(ROOT, 'assets', 'docs-manifest.json');
const STATIC_ENTRIES = [
  'assets',
  'components',
  'index.html',
  'LICENSE',
  'og-image',
  'styles.css',
];

let DOC_MANIFEST = null;
let DOC_NAV = [];
let DOC_ITEMS = [];
let DOC_PATHS = [];
let KNOWN_DOC_PATHS = new Set();
let EXPLICIT_URLS = new Map();

function rawGithubUrl(repoPath) {
  return `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${repoPath}`;
}

function githubBlobUrl(repoPath) {
  return `https://github.com/${REPO}/blob/${BRANCH}/${repoPath}`;
}

function docDir(repoPath) {
  const index = repoPath.lastIndexOf('/');
  return index === -1 ? '' : repoPath.slice(0, index + 1);
}

function splitHash(href) {
  const index = href.indexOf('#');
  if (index === -1) return { pathPart: href, hash: '' };
  return {
    pathPart: href.slice(0, index),
    hash: decodeURIComponent(href.slice(index + 1)),
  };
}

function resolveRepoPath(pathPart, currentPath) {
  const base = `https://con-docs.local/${docDir(currentPath)}`;
  return new URL(pathPart || currentPath, base).pathname.replace(/^\/+/, '');
}

function isExternalHref(href) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');
}

function isInternalDocPath(repoPath) {
  return KNOWN_DOC_PATHS.has(repoPath) || /\.(md|markdown)$/i.test(repoPath);
}

function pageUrlForDoc(repoPath) {
  if (EXPLICIT_URLS.has(repoPath)) return EXPLICIT_URLS.get(repoPath);
  let clean = repoPath.replace(/^docs\//, '').replace(/\.(md|markdown)$/i, '');
  if (clean.endsWith('/README')) clean = clean.slice(0, -'/README'.length);
  return `/docs/${clean}/`.replace(/\/+/g, '/');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeManifest(manifest) {
  if (!manifest || manifest.version !== 1) {
    throw new Error('docs manifest must have version 1');
  }
  if (!Array.isArray(manifest.groups) || manifest.groups.length === 0) {
    throw new Error('docs manifest must include groups');
  }
  return {
    ...manifest,
    groups: manifest.groups.map((group) => ({
      label: group.label,
      items: (group.items || []).map((item) => ({ ...item })),
    })),
    extra: (manifest.extra || []).map((item) => ({ ...item })),
  };
}

function applyManifest(manifest) {
  DOC_MANIFEST = normalizeManifest(manifest);
  DOC_NAV = DOC_MANIFEST.groups;
  DOC_ITEMS = [...DOC_NAV.flatMap((group) => group.items), ...DOC_MANIFEST.extra];
  DOC_PATHS = [...new Set(DOC_ITEMS.map((item) => item.path))];
  KNOWN_DOC_PATHS = new Set(DOC_PATHS);
  EXPLICIT_URLS = new Map(
    DOC_ITEMS
      .filter((item) => item.route && !item.hash)
      .map((item) => [item.path, item.route]),
  );
}

async function loadManifest() {
  let manifest;
  let source;
  if (await fileExists(LOCAL_MANIFEST)) {
    manifest = JSON.parse(await fs.readFile(LOCAL_MANIFEST, 'utf8'));
    source = LOCAL_MANIFEST;
  } else {
    try {
      manifest = JSON.parse(await fetchText(rawGithubUrl('docs/manifest.json')));
      source = rawGithubUrl('docs/manifest.json');
    } catch (error) {
      if (!(await fileExists(BUNDLED_MANIFEST))) throw error;
      manifest = JSON.parse(await fs.readFile(BUNDLED_MANIFEST, 'utf8'));
      source = BUNDLED_MANIFEST;
    }
  }
  applyManifest(manifest);
  return source;
}

function outputPathForUrl(urlPath) {
  const clean = urlPath.replace(/^\/+|\/+$/g, '');
  return path.join(OUT_DIR, clean, 'index.html');
}

async function copyStaticEntry(entry) {
  const source = path.join(ROOT, entry);
  const target = path.join(OUT_DIR, entry);
  if (!(await fileExists(source))) return;
  await fs.cp(source, target, {
    recursive: true,
    filter: (src) => !src.endsWith(`${path.sep}docs-manifest.json`),
  });
}

async function prepareOutputDirectory() {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const entry of STATIC_ENTRIES) {
    await copyStaticEntry(entry);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(value) {
  return String(value).replace(/<[^>]+>/g, '');
}

function slugify(text) {
  return stripHtml(text)
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function labelForDoc(repoPath) {
  const navItem = DOC_ITEMS.find((item) => item.path === repoPath && !item.hash)
    || DOC_ITEMS.find((item) => item.path === repoPath);
  if (navItem) return navItem.label;
  if (repoPath === 'README.md') return 'Overview';
  return repoPath.split('/').pop().replace(/\.(md|markdown)$/i, '').replace(/[-_]/g, ' ');
}

function titleFromMarkdown(markdown, repoPath) {
  const heading = markdown.match(/^#\s+(.+)$/m);
  if (!heading) return labelForDoc(repoPath);
  const title = heading[1].replace(/[`*_#[\]]/g, '').trim();
  return title.toLowerCase() === 'con' ? 'con documentation' : title;
}

function descriptionFromMarkdown(markdown, fallback) {
  const cleaned = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]+\)/g, (match) => match.match(/\[([^\]]+)]/)?.[1] || ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[`*_>#+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentence = cleaned.split(/(?<=[.!?])\s+/).find((part) => part.length > 70) || cleaned;
  return (sentence || fallback).slice(0, 158);
}

function resolveDocHref(href, currentPath) {
  if (!href || href.startsWith('#') || href.startsWith('/') || isExternalHref(href)) return href;
  const { pathPart, hash } = splitHash(href);
  const resolvedPath = resolveRepoPath(pathPart, currentPath);
  if (isInternalDocPath(resolvedPath)) {
    return `${pageUrlForDoc(resolvedPath)}${hash ? `#${encodeURIComponent(hash)}` : ''}`;
  }
  return githubBlobUrl(resolvedPath);
}

function resolveImageSrc(src, currentPath) {
  if (!src || src.startsWith('#') || src.startsWith('/') || src.startsWith('data:') || isExternalHref(src)) return src;
  return rawGithubUrl(resolveRepoPath(src, currentPath));
}

function rewriteRawHtmlLinks(html, currentPath) {
  return html.replace(/\s(href|src)=("([^"]*)"|'([^']*)')/gi, (match, attr, quoted, doubleValue, singleValue) => {
    const value = doubleValue ?? singleValue ?? '';
    const quote = quoted[0];
    try {
      const next = attr.toLowerCase() === 'href'
        ? resolveDocHref(value, currentPath)
        : resolveImageSrc(value, currentPath);
      return ` ${attr}=${quote}${escapeHtml(next)}${quote}`;
    } catch (error) {
      return match;
    }
  });
}

function renderMarkdown(markdown, currentPath) {
  const toc = [];
  const usedIds = new Map();
  const renderer = new marked.Renderer();

  renderer.heading = (text, level, raw) => {
    const base = slugify(raw || text) || 'section';
    const count = usedIds.get(base) || 0;
    const id = count ? `${base}-${count}` : base;
    usedIds.set(base, count + 1);
    if (level === 2 || level === 3) toc.push({ id, text: stripHtml(text), depth: level });
    return `<h${level} id="${id}">${text}<a class="heading-anchor" href="#${id}" aria-hidden="true" aria-label="Link to ${escapeHtml(stripHtml(text))}"></a></h${level}>`;
  };

  renderer.link = (href, title, text) => {
    if (!href) return text;
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    if (href.startsWith('#')) {
      return `<a href="${escapeHtml(href)}"${titleAttr}>${text}</a>`;
    }
    if (isExternalHref(href)) {
      return `<a href="${escapeHtml(href)}"${titleAttr} target="_blank" rel="noreferrer">${text}</a>`;
    }
    try {
      const { pathPart, hash } = splitHash(href);
      const resolvedPath = resolveRepoPath(pathPart, currentPath);
      if (isInternalDocPath(resolvedPath)) {
        const target = `${pageUrlForDoc(resolvedPath)}${hash ? `#${encodeURIComponent(hash)}` : ''}`;
        return `<a href="${escapeHtml(target)}"${titleAttr}>${text}</a>`;
      }
      return `<a href="${escapeHtml(githubBlobUrl(resolvedPath))}"${titleAttr} target="_blank" rel="noreferrer">${text}</a>`;
    } catch (error) {
      return `<a href="${escapeHtml(githubBlobUrl(currentPath))}"${titleAttr} target="_blank" rel="noreferrer">${text}</a>`;
    }
  };

  renderer.image = (href, title, text) => {
    if (!href) return '';
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    const src = isExternalHref(href) || href.startsWith('data:')
      ? href
      : rawGithubUrl(resolveRepoPath(href, currentPath));
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text || '')}"${titleAttr} loading="lazy">`;
  };

  const html = rewriteRawHtmlLinks(marked.parse(markdown, { renderer, gfm: true }), currentPath);
  return { html, toc };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'con-website-docs-build',
      'Accept': 'text/plain, text/markdown, */*',
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.text();
}

function renderDocNav(activePath) {
  return DOC_NAV.map((group) => `
    <section class="static-docs-nav-group">
      <div class="docs-nav-label">${escapeHtml(group.group)}</div>
      ${group.items.map((item) => {
        const href = `${pageUrlForDoc(item.path)}${item.hash ? `#${item.hash}` : ''}`;
        const active = item.path === activePath && !item.hash ? ' active' : '';
        return `<a class="docs-nav-item${active}" href="${escapeHtml(href)}">${escapeHtml(item.label)}</a>`;
      }).join('')}
    </section>
  `).join('');
}

function renderToc(toc) {
  if (!toc.length) return '';
  return `
    <aside class="static-docs-toc" aria-label="On this page">
      <div class="docs-nav-label">On this page</div>
      ${toc.slice(0, 14).map((item) => `
        <a class="docs-toc-item depth-${item.depth}" href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a>
      `).join('')}
    </aside>
  `;
}

function renderPage({ repoPath, title, description, html, toc }) {
  const urlPath = pageUrlForDoc(repoPath);
  const canonical = `${SITE_URL}${urlPath}`;
  const sourceUrl = githubBlobUrl(repoPath);
  const fullTitle = title.includes('con') ? `${title} | con` : `${title} | con docs`;
  const isChangelogPage = repoPath === 'CHANGELOG.md';
  const docsCurrent = isChangelogPage ? '' : ' class="active" aria-current="page"';
  const changelogCurrent = isChangelogPage ? ' class="active" aria-current="page"' : '';
  const schema = {
    '@context': 'https://schema.org',
    '@type': repoPath === 'CHANGELOG.md' ? 'WebPage' : 'TechArticle',
    headline: title,
    description,
    url: canonical,
    isPartOf: {
      '@type': 'WebSite',
      name: 'con',
      url: SITE_URL,
    },
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(fullTitle)}</title>
<meta name="description" content="${escapeHtml(description)}"/>
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1"/>
<link rel="canonical" href="${escapeHtml(canonical)}"/>
<meta property="og:title" content="${escapeHtml(fullTitle)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:url" content="${escapeHtml(canonical)}"/>
<meta property="og:site_name" content="con"/>
<meta property="og:type" content="article"/>
<meta property="og:image" content="${OG_IMAGE}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(fullTitle)}"/>
<meta name="twitter:description" content="${escapeHtml(description)}"/>
<meta name="twitter:image" content="${OG_IMAGE}"/>
<meta name="theme-color" content="#0b0b0d"/>
<link rel="icon" href="/assets/icon_con_black.png"/>
<link rel="apple-touch-icon" href="/assets/icon_con_black.png"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="/styles.css"/>
<script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body class="static-docs-page">
<header class="static-docs-top">
  <a class="static-docs-brand" href="/">
    <img src="/assets/icon_con_black.png" alt="" width="28" height="28"/>
    <span>con</span>
  </a>
  <nav class="static-docs-top-links" aria-label="Primary">
    <a href="/">Product</a>
    <a href="/docs/"${docsCurrent}>Docs</a>
    <a href="/changelog/"${changelogCurrent}>Changelog</a>
    <a href="https://github.com/${REPO}" target="_blank" rel="noreferrer">GitHub</a>
  </nav>
</header>
<main class="static-docs-layout">
  <aside class="static-docs-sidebar" aria-label="Documentation navigation">
    ${renderDocNav(repoPath)}
  </aside>
  <article class="docs-md static-docs-content">
    <div class="static-docs-source">
      <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(repoPath)}</a>
    </div>
    ${html}
  </article>
  ${renderToc(toc)}
</main>
</body>
</html>`;
}

function renderSitemap(urls) {
  const today = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((urlPath) => `  <url><loc>${SITE_URL}${urlPath}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;
}

async function writeFileEnsured(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
}

async function main() {
  const manifestSource = await loadManifest();
  await prepareOutputDirectory();
  await writeFileEnsured(
    path.join(OUT_DIR, 'assets', 'docs-manifest.json'),
    `${JSON.stringify(DOC_MANIFEST, null, 2)}\n`,
  );

  const pages = [];
  for (const repoPath of DOC_PATHS) {
    const markdown = await fetchText(rawGithubUrl(repoPath));
    const title = titleFromMarkdown(markdown, repoPath);
    const description = descriptionFromMarkdown(markdown, `${labelForDoc(repoPath)} for con, the terminal emulator with AI harness.`);
    const rendered = renderMarkdown(markdown, repoPath);
    const page = { repoPath, title, description, ...rendered };
    pages.push(page);
    await writeFileEnsured(outputPathForUrl(pageUrlForDoc(repoPath)), renderPage(page));
  }

  const sitemapUrls = ['/', ...pages.map((page) => pageUrlForDoc(page.repoPath))];
  await writeFileEnsured(path.join(OUT_DIR, 'sitemap.xml'), renderSitemap([...new Set(sitemapUrls)]));
  await writeFileEnsured(path.join(OUT_DIR, 'robots.txt'), `User-agent: *
Allow: /
Sitemap: ${SITE_URL}/sitemap.xml
`);

  console.log(`Generated ${pages.length} docs pages from ${REPO}@${BRANCH}.`);
  console.log(`Docs manifest: ${manifestSource}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
