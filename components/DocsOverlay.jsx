// Docs / Changelog overlay. Fetches markdown from con-terminal, renders it in-site,
// and resolves repo-relative documentation links without sending readers to GitHub.

const DOCS_REPO = 'nowledge-co/con-terminal';
const DOCS_BRANCH = 'main';
const DOCS_MANIFEST_URL = '/assets/docs-manifest.json';

const DOC_SOURCES = {
  docs: { title: 'Docs', initialFile: 'README.md' },
  changelog: { title: 'Changelog', initialFile: 'CHANGELOG.md' },
};

let DOC_NAV = [];
let DOC_NAV_ITEMS = [];
let KNOWN_DOC_PATHS = new Set(['README.md', 'CHANGELOG.md', 'LICENSE']);

function githubBlobUrl(path) {
  return `https://github.com/${DOCS_REPO}/blob/${DOCS_BRANCH}/${path}`;
}

function rawGithubUrl(path) {
  return `https://raw.githubusercontent.com/${DOCS_REPO}/${DOCS_BRANCH}/${path}`;
}

function applyDocsManifest(manifest) {
  const groups = (manifest?.groups || []).map((group) => ({
    group: group.label || group.group,
    items: group.items || [],
  }));
  const extra = manifest?.extra || [];
  DOC_NAV = groups;
  DOC_NAV_ITEMS = [...groups.flatMap((group) => group.items), ...extra];
  KNOWN_DOC_PATHS = new Set(DOC_NAV_ITEMS.map((item) => item.path));
  KNOWN_DOC_PATHS.add('README.md');
  KNOWN_DOC_PATHS.add('CHANGELOG.md');
  KNOWN_DOC_PATHS.add('LICENSE');
  return groups;
}

async function loadDocsManifest() {
  const urls = [
    DOCS_MANIFEST_URL,
    rawGithubUrl('docs/manifest.json'),
  ];
  let lastError = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return applyDocsManifest(await res.json());
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Could not load docs manifest');
}

function docDir(path) {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index + 1);
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

function isInternalDocPath(path) {
  return KNOWN_DOC_PATHS.has(path) || /\.(md|markdown)$/i.test(path);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function labelForDoc(path) {
  const navItem = DOC_NAV_ITEMS.find((item) => item.path === path && !item.hash)
    || DOC_NAV_ITEMS.find((item) => item.path === path);
  if (navItem) return navItem.label;
  if (path === 'README.md') return 'Overview';
  if (path === 'CHANGELOG.md') return 'Changelog';
  return path.split('/').pop().replace(/\.(md|markdown)$/i, '').replace(/[-_]/g, ' ');
}

function prepareMarkdown(md, currentPath) {
  const renderer = (window.marked?.parse) || miniMarkdown;
  const html = renderer(md);
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  const usedIds = new Map();
  const toc = [];

  root.querySelectorAll('h1, h2, h3, h4').forEach((heading) => {
    const base = heading.id || slugify(heading.textContent || 'section') || 'section';
    const count = usedIds.get(base) || 0;
    const id = count ? `${base}-${count}` : base;
    usedIds.set(base, count + 1);
    heading.id = id;
    if (heading.tagName === 'H2' || heading.tagName === 'H3') {
      toc.push({ id, text: heading.textContent.trim(), depth: heading.tagName === 'H2' ? 2 : 3 });
    }
    const anchor = doc.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = `#${id}`;
    anchor.setAttribute('aria-hidden', 'true');
    anchor.setAttribute('aria-label', `Link to ${heading.textContent.trim()}`);
    anchor.textContent = '';
    heading.appendChild(anchor);
  });

  root.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href');
    if (!href) return;

    if (href.startsWith('#')) {
      const hash = decodeURIComponent(href.slice(1));
      anchor.setAttribute('data-doc-path', currentPath);
      anchor.setAttribute('data-doc-hash', hash);
      return;
    }

    if (isExternalHref(href)) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noreferrer');
      return;
    }

    try {
      const { pathPart, hash } = splitHash(href);
      const resolvedPath = resolveRepoPath(pathPart, currentPath);
      if (isInternalDocPath(resolvedPath)) {
        anchor.setAttribute('href', `#doc=${encodeURIComponent(resolvedPath)}${hash ? `&section=${encodeURIComponent(hash)}` : ''}`);
        anchor.setAttribute('data-doc-path', resolvedPath);
        anchor.setAttribute('data-doc-hash', hash);
      } else {
        anchor.setAttribute('href', githubBlobUrl(resolvedPath));
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noreferrer');
      }
    } catch (e) {
      anchor.setAttribute('href', githubBlobUrl(currentPath));
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noreferrer');
    }
  });

  root.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return;
    if (!isExternalHref(src)) {
      try {
        img.setAttribute('src', rawGithubUrl(resolveRepoPath(src, currentPath)));
      } catch (e) {}
    }
    img.setAttribute('loading', 'lazy');
  });

  return { html: root.innerHTML, toc };
}

// Very small fallback markdown renderer if `marked` is not loaded.
function miniMarkdown(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  const out = [];
  let inCode = false;
  let codeBuf = [];
  let paraBuf = [];
  const flushPara = () => {
    if (!paraBuf.length) return;
    const text = esc(paraBuf.join(' '))
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    out.push(`<p>${text}</p>`);
    paraBuf = [];
  };
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        flushPara();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      flushPara();
      out.push(`<h${h[1].length}>${esc(h[2])}</h${h[1].length}>`);
      continue;
    }
    if (!line.trim()) {
      flushPara();
      continue;
    }
    paraBuf.push(line);
  }
  flushPara();
  return out.join('\n');
}

const DocsNav = ({ activePath, nav, toc, onOpenDoc }) => (
  <aside className="docs-sidebar" aria-label="Documentation navigation">
    <div className="docs-sidebar-scroll">
      {nav.map((group) => (
        <section className="docs-nav-group" key={group.group}>
          <div className="docs-nav-label">{group.group}</div>
          {group.items.map((item) => {
            const active = item.path === activePath && !item.hash;
            return (
              <button
                key={`${item.path}#${item.hash || ''}`}
                type="button"
                className={`docs-nav-item${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => onOpenDoc(item.path, item.hash || '')}
              >
                {item.label}
              </button>
            );
          })}
        </section>
      ))}

      {toc.length > 0 && (
        <section className="docs-nav-group docs-toc">
          <div className="docs-nav-label">On this page</div>
          {toc.slice(0, 10).map((item) => (
            <button
              key={item.id}
              type="button"
              className={`docs-toc-item depth-${item.depth}`}
              onClick={() => onOpenDoc(activePath, item.id)}
            >
              {item.text}
            </button>
          ))}
        </section>
      )}
    </div>
  </aside>
);

const DocsOverlay = ({ which, onClose }) => {
  const meta = DOC_SOURCES[which] || DOC_SOURCES.docs;
  const [activeDoc, setActiveDoc] = React.useState(meta.initialFile);
  const [pendingHash, setPendingHash] = React.useState('');
  const [state, setState] = React.useState({ loading: true, error: null, html: '', toc: [] });
  const [nav, setNav] = React.useState(DOC_NAV);
  const [manifestReady, setManifestReady] = React.useState(DOC_NAV.length > 0);
  const [manifestError, setManifestError] = React.useState(null);
  const bodyRef = React.useRef(null);
  const articleRef = React.useRef(null);
  const showNav = which === 'docs';
  const activeLabel = labelForDoc(activeDoc);
  const sourceUrl = githubBlobUrl(activeDoc);

  const scrollToHash = React.useCallback((hash) => {
    const body = bodyRef.current;
    if (!body) return;
    if (!hash) {
      body.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    const target = document.getElementById(hash);
    if (target && body.contains(target)) {
      body.scrollTo({ top: target.offsetTop - 18, behavior: 'smooth' });
    }
  }, []);

  const openDoc = React.useCallback((path, hash = '') => {
    setPendingHash(hash);
    if (path === activeDoc) {
      window.requestAnimationFrame(() => scrollToHash(hash));
    } else {
      setActiveDoc(path);
    }
  }, [activeDoc, scrollToHash]);

  React.useEffect(() => {
    setActiveDoc(meta.initialFile);
    setPendingHash('');
  }, [which]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loadedNav = await loadDocsManifest();
        if (!cancelled) {
          setNav(loadedNav);
          setManifestReady(true);
          setManifestError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setManifestReady(true);
          setManifestError(err.message);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (!manifestReady) return;
    let cancelled = false;
    setState({ loading: true, error: null, html: '', toc: [] });
    (async () => {
      try {
        const res = await fetch(rawGithubUrl(activeDoc));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const md = await res.text();
        const prepared = prepareMarkdown(md, activeDoc);
        if (!cancelled) setState({ loading: false, error: null, ...prepared });
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message, html: '', toc: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [activeDoc, manifestReady]);

  React.useEffect(() => {
    if (state.loading || state.error) return;
    window.requestAnimationFrame(() => scrollToHash(pendingHash));
  }, [state.html, state.loading, state.error, pendingHash, scrollToHash]);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, []);

  const handleArticleClick = (event) => {
    const anchor = event.target.closest?.('a[data-doc-path]');
    if (!anchor) return;
    event.preventDefault();
    openDoc(anchor.dataset.docPath, anchor.dataset.docHash || '');
  };

  return (
    <div className="docs-overlay" onClick={onClose}>
      <div className={`docs-panel${showNav ? ' docs-panel-with-nav' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="docs-head">
          <div className="docs-title">
            <span className="docs-kicker">{meta.title}</span>
            <span className="docs-current-path">
              {activeLabel}
              <span>{activeDoc}</span>
            </span>
          </div>
          <div className="docs-actions">
            <a className="docs-repo" href={sourceUrl} target="_blank" rel="noreferrer">Open source</a>
            <button className="docs-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>

        <div className={`docs-shell${showNav ? '' : ' docs-shell-single'}`}>
          {showNav && <DocsNav activePath={activeDoc} nav={nav} toc={state.toc} onOpenDoc={openDoc} />}
          <div className="docs-body" ref={bodyRef}>
            {!manifestReady && <div className="docs-loading">Loading docs manifest...</div>}
            {manifestError && (
              <div className="docs-error">Docs manifest warning: {manifestError}</div>
            )}
            {manifestReady && state.loading && <div className="docs-loading">Loading {activeDoc}...</div>}
            {state.error && (
              <div className="docs-error">
                Could not load {activeDoc} ({state.error}).
                <a href={sourceUrl} target="_blank" rel="noreferrer">Open on GitHub</a>
              </div>
            )}
            {!state.loading && !state.error && (
              <article
                className="docs-md"
                ref={articleRef}
                onClick={handleArticleClick}
                dangerouslySetInnerHTML={{ __html: state.html }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

window.DocsOverlay = DocsOverlay;
