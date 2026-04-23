// Docs / Changelog overlay — fetches raw markdown from GitHub, renders with marked,
// rewrites relative links to absolute GH URLs so nothing breaks.

const REPO = 'nowledge-co/con-terminal';
const BRANCH = 'main';

const SOURCES = {
  docs:      { title: 'Docs',      file: 'README.md',    githubUrl: `https://github.com/${REPO}#readme` },
  changelog: { title: 'Changelog', file: 'CHANGELOG.md', githubUrl: `https://github.com/${REPO}/blob/${BRANCH}/CHANGELOG.md` },
};

function rewriteRelative(html) {
  // Make relative links absolute to GitHub, and relative images absolute to raw.githubusercontent.
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const base = `https://github.com/${REPO}/blob/${BRANCH}/`;
  const rawBase = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/`;

  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    if (href.startsWith('#')) {
      // anchor within doc — leave alone so our internal anchors work
      return;
    }
    if (/^[a-z]+:\/\//i.test(href) || href.startsWith('mailto:')) return;
    // Relative: point to GitHub blob view
    try {
      a.setAttribute('href', new URL(href, base).toString());
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noreferrer');
    } catch (e) {}
  });
  doc.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src');
    if (!src || /^[a-z]+:\/\//i.test(src) || src.startsWith('data:')) return;
    try {
      img.setAttribute('src', new URL(src, rawBase).toString());
      img.setAttribute('loading', 'lazy');
    } catch (e) {}
  });
  return doc.body.firstChild.innerHTML;
}

// Very small fallback markdown renderer if `marked` isn't loaded.
function miniMarkdown(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  let out = []; let inCode = false; let codeBuf = [];
  const flushPara = (buf) => {
    if (!buf.length) return;
    let text = esc(buf.join(' '))
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    out.push(`<p>${text}</p>`);
  };
  let paraBuf = [];
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) { out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`); codeBuf = []; inCode = false; }
      else { flushPara(paraBuf); paraBuf = []; inCode = true; }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) { flushPara(paraBuf); paraBuf = []; out.push(`<h${h[1].length}>${esc(h[2])}</h${h[1].length}>`); continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara(paraBuf); paraBuf = [];
      out.push(`<li>${esc(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }
    if (!line.trim()) { flushPara(paraBuf); paraBuf = []; continue; }
    paraBuf.push(line);
  }
  flushPara(paraBuf);
  return out.join('\n');
}

const DocsOverlay = ({ which, onClose }) => {
  const meta = SOURCES[which];
  const [state, setState] = React.useState({ loading: true, error: null, html: '' });
  const escRef = React.useRef();

  React.useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: null, html: '' });
    const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${meta.file}`;
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const md = await res.text();
        const renderer = (window.marked?.parse) || miniMarkdown;
        let html = renderer(md);
        html = rewriteRelative(html);
        if (!cancelled) setState({ loading: false, error: null, html });
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message, html: '' });
      }
    })();
    return () => { cancelled = true; };
  }, [which]);

  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="docs-overlay" onClick={onClose}>
      <div className="docs-panel" onClick={(e) => e.stopPropagation()}>
        <div className="docs-head">
          <div className="docs-title">
            <span className="docs-kicker">{meta.title}</span>
            <a className="docs-repo" href={meta.githubUrl} target="_blank" rel="noreferrer">
              nowledge-co/con-terminal · {meta.file}
            </a>
          </div>
          <button className="docs-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="docs-body">
          {state.loading && <div className="docs-loading">Loading {meta.file}…</div>}
          {state.error && (
            <div className="docs-error">
              Couldn't load {meta.file} ({state.error}).
              <a href={meta.githubUrl} target="_blank" rel="noreferrer"> Open on GitHub →</a>
            </div>
          )}
          {!state.loading && !state.error && (
            <article className="docs-md" dangerouslySetInnerHTML={{ __html: state.html }} />
          )}
        </div>
      </div>
    </div>
  );
};

window.DocsOverlay = DocsOverlay;
