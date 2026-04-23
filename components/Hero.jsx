// Con landing — Tasklayer-inspired composition with OS-detecting install card, pilot center, providers strip.

const REPO = 'nowledge-co/con-terminal';
const INSTALL_CMDS = {
  macOS:   'curl -fsSL https://nowled.ge/con-sh | sh',
  Windows: 'irm https://nowled.ge/con-ps1 | iex',
  Linux:   'curl -fsSL https://nowled.ge/con-sh | sh',
};
const OS_STATUS = {
  macOS:   { chip: null,    label: 'Apple Silicon · Intel Metal' },
  Windows: { chip: 'early', label: 'Windows (early)' },
  Linux:   { chip: 'early', label: 'Linux x86_64 (early)' },
};
const WINDOWS_SVG = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23f7f1ea"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>'.replace(/%23/g,'#'))}`;
const OS_CDN = {
  macOS:   'https://cdn.simpleicons.org/apple/f7f1ea',
  Windows: WINDOWS_SVG,
  Linux:   'https://cdn.simpleicons.org/linux/f7f1ea',
};

function detectOS() {
  if (typeof navigator === 'undefined') return 'macOS';
  const p = (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || '').toLowerCase();
  if (p.includes('mac')) return 'macOS';
  if (p.includes('win')) return 'Windows';
  if (p.includes('linux') || p.includes('x11')) return 'Linux';
  return 'macOS';
}

const Page = ({ tweaks }) => {
  const headline = tweaks.headline;
  const [h1, h2Pre, h2Italic, h2Post] = headline.split('||');
  const [detected] = React.useState(() => detectOS());
  const [osTab, setOsTab] = React.useState(detected);
  const [overlay, setOverlay] = React.useState(null);
  const [repoMeta, setRepoMeta] = React.useState({ stars: '2.4k', version: 'v0.4' });

  React.useEffect(() => {
    (async () => {
      try {
        const [repoRes, relRes] = await Promise.allSettled([
          fetch(`https://api.github.com/repos/${REPO}`),
          fetch(`https://api.github.com/repos/${REPO}/releases/latest`),
        ]);
        const next = { ...repoMeta };
        if (repoRes.status === 'fulfilled' && repoRes.value.ok) {
          const d = await repoRes.value.json();
          if (typeof d.stargazers_count === 'number') {
            next.stars = d.stargazers_count >= 1000
              ? (d.stargazers_count / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
              : String(d.stargazers_count);
          }
        }
        if (relRes.status === 'fulfilled' && relRes.value.ok) {
          const d = await relRes.value.json();
          if (d.tag_name) next.version = d.tag_name.startsWith('v') ? d.tag_name : `v${d.tag_name}`;
        }
        setRepoMeta(next);
      } catch (e) { /* keep fallback */ }
    })();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="world">
      <div className="sky" style={{ backgroundImage: `url(${tweaks.bgImage})` }}>

      {/* NAV */}
      <header className="nav">
        <div className="brand">
          <img src="assets/icon_con_black.png" alt="con" className="brand-icon" />
          <span className="brand-name">con</span>
          <span className="brand-version">{repoMeta.version}</span>
        </div>
        <nav className="nav-links">
          <button className="nav-link-btn" onClick={() => setOverlay('docs')}>Docs</button>
          <button className="nav-link-btn" onClick={() => setOverlay('changelog')}>Changelog</button>
        </nav>
        <a className="gh-pill" href={`https://github.com/${REPO}`} target="_blank" rel="noreferrer">
          <GitHubGlyph />
          <span className="gh-label">GitHub</span>
          <span className="gh-sep" />
          <span className="gh-star"><StarGlyph /> {repoMeta.stars}</span>
        </a>
      </header>

      {/* HERO: copy (left) + install card (right), pilot centered below, providers at foot */}
      <section className="hero" data-screen-label="01 Hero">
        <div className="hero-top">
          <div className="hero-copy">
            <h1 className="headline">
              <span>{h1}</span>
              <span>{h2Pre}<em>{h2Italic}</em>{h2Post}</span>
            </h1>
            <p className="subhead">
              A fast, humane terminal for the agent era.
            </p>
          </div>

          <InstallCard detected={detected} osTab={osTab} setOsTab={setOsTab} />
        </div>

        {/* vertical breathing room — the raccoon lives in the background image */}
        <div className="hero-spacer" aria-hidden="true" />

        <div className="providers-strip" id="providers">
          <span className="providers-label">Works with</span>
          <div className="providers-row">
            <Provider id="claude-color"  label="Anthropic" />
            <Provider id="openai"        label="OpenAI" />
            <Provider id="gemini-color"  label="Gemini" />
            <Provider id="ollama"        label="Ollama" />
            <Provider id="openrouter"    label="OpenRouter" />
            <Provider id="kimi-color"    label="Moonshot" />
            <Provider id="minimax-color" label="MiniMax" />
            <Provider id="zhipu-color"   label="Z.ai" />
          </div>
        </div>
      </section>
      </div>{/* /sky */}

      {/* TERMINAL DEMO */}
      <div className="ground">
      <section className="demo" id="terminal" data-screen-label="02 Terminal">
        <div className="section-eyebrow">The terminal</div>
        <h2 className="section-title">
          <span>Just a terminal that works,</span>
          <em>until you ask for help.</em>
        </h2>
        <p className="section-sub">Then an agent that understands where you are.</p>
        <TerminalDemo tweaks={tweaks} />
      </section>

      <footer className="site-foot" id="footer">
        <div className="foot-inner">
          <div className="foot-brand">
            <div className="foot-brand-row">
              <img src="assets/icon_con_black.png" alt="" className="foot-icon" />
              <span className="foot-name">con</span>
              <span className="foot-version">{repoMeta.version}</span>
            </div>
            <p className="foot-tag">A fast, humane terminal for the agent era.</p>
            <div className="foot-badges">
              <span className="foot-badge">MIT</span>
              <span className="foot-badge">Rust</span>
              <span className="foot-badge">libGhostty Powered</span>
            </div>
          </div>

          <div className="foot-cols">
            <div className="foot-col">
              <div className="foot-col-label">Product</div>
              <a href={`https://github.com/${REPO}/releases/latest`} target="_blank" rel="noreferrer">Download</a>
              <button className="foot-link-btn" onClick={() => setOverlay('docs')}>Docs</button>
              <button className="foot-link-btn" onClick={() => setOverlay('changelog')}>Changelog</button>
              <a href={`https://github.com/${REPO}/issues`} target="_blank" rel="noreferrer">Roadmap</a>
            </div>
            <div className="foot-col">
              <div className="foot-col-label">Source</div>
              <a href={`https://github.com/${REPO}`} target="_blank" rel="noreferrer">GitHub</a>
              <a href={`https://github.com/${REPO}/issues/new/choose`} target="_blank" rel="noreferrer">Report a bug</a>
              <a href={`https://github.com/${REPO}/blob/main/HACKING.md`} target="_blank" rel="noreferrer">Contribute</a>
              <a href={`https://github.com/${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">License</a>
            </div>
            <div className="foot-col">
              <div className="foot-col-label">Nowledge Labs</div>
              <a href="https://nowledge-labs.ai" target="_blank" rel="noreferrer">Homepage</a>
              <a href="https://nowledge-labs.ai/blog" target="_blank" rel="noreferrer">Blog</a>
              <a href="https://mem.nowledge.co/" target="_blank" rel="noreferrer" className="foot-link-strong">Nowledge Mem</a>
              <a href="https://x.com/nowledgelabs" target="_blank" rel="noreferrer">X / Twitter</a>
            </div>
          </div>
        </div>
        <div className="foot-legal">
          <a className="foot-maker" href="https://nowledge-labs.ai" target="_blank" rel="noreferrer">
            <img src="assets/nowledge-labs-icon.png" alt="" className="foot-maker-icon" />
            <span className="foot-maker-copy">
              <span className="foot-maker-name">Nowledge Labs</span>
              <span className="foot-maker-slogan">we build the knowledge layer.</span>
            </span>
          </a>
          <span>© 2026</span>
          <span>Built in the open</span>
        </div>
      </footer>
      </div>{/* /ground */}
      {overlay ? <DocsOverlay which={overlay} onClose={() => setOverlay(null)} /> : null}
    </div>
  );
};

// ---------- Install card ----------
const InstallCard = ({ detected, osTab, setOsTab }) => {
  const [copied, setCopied] = React.useState(false);
  const cmd = INSTALL_CMDS[osTab];
  const status = OS_STATUS[osTab];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (e) {}
  };
  return (
    <div className="install-card">
      <div className="install-card-head">
        <span className="label">Install</span>
        <span className="install-head-right">{status.label}</span>
      </div>
      <div className="os-tabs">
        {['macOS', 'Windows', 'Linux'].map((os) => {
          const isActive = osTab === os;
          const isDetected = detected === os;
          const chip = OS_STATUS[os].chip;
          return (
            <button
              key={os}
              className={`os-tab${isActive ? ' active' : ''}${isDetected ? ' detected' : ''}`}
              onClick={() => setOsTab(os)}
            >
              <img src={OS_CDN[os]} alt="" className="os-icon" />
              <span>{os}</span>
              {chip ? <span className={`os-chip ${chip}`}>{chip}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="install-cmd-row">
        <span className="dollar">$</span>
        <code>{cmd}</code>
        <button className="copy-btn" onClick={copy}>
          <CopyGlyph/> {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <div className="install-cta-row">
        <a className="cta-primary" href={`https://github.com/${REPO}/releases/latest`} target="_blank" rel="noreferrer">
          Download for {osTab}
        </a>
        <a className="cta-secondary" href="#terminal">See it in action</a>
      </div>
    </div>
  );
};

// Provider uses lobehub CDN icons
const Provider = ({ id, label }) => (
  <span className="provider" data-provider={id}>
    <img
      src={`https://unpkg.com/@lobehub/icons-static-svg@latest/icons/${id}.svg`}
      onError={(e) => { const mono = id.replace(/-color$/, ''); if (e.currentTarget.src.includes(`${mono}.svg`)) return; e.currentTarget.src = `https://unpkg.com/@lobehub/icons-static-svg@latest/icons/${mono}.svg`; }}
      alt=""
      className="provider-logo"
    />
    {label}
  </span>
);

// --- chrome glyphs ---
const GitHubGlyph = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 .5C5.73.5.75 5.48.75 11.76c0 4.96 3.22 9.16 7.69 10.65.56.1.76-.24.76-.54 0-.27-.01-1.17-.02-2.12-3.13.68-3.79-1.33-3.79-1.33-.51-1.31-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.94.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.11 1.16.9-.25 1.87-.37 2.83-.38.96 0 1.93.13 2.83.38 2.16-1.46 3.1-1.16 3.1-1.16.62 1.55.23 2.7.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.32-2.64 5.28-5.15 5.56.4.35.76 1.03.76 2.08 0 1.5-.01 2.72-.01 3.09 0 .3.2.65.77.54 4.46-1.49 7.68-5.69 7.68-10.65C23.25 5.48 18.27.5 12 .5z"/></svg>
);
const StarGlyph = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 1.8l1.95 3.95 4.36.63-3.15 3.07.74 4.33L8 11.75l-3.9 2.05.74-4.33L1.69 6.4l4.36-.63z"/></svg>
);
const AppleGlyph = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M16.37 1.43c0 1.14-.41 2.24-1.23 3.06-.99 1.01-2.21 1.6-3.35 1.5-.15-1.09.41-2.24 1.23-3.14.99-1.08 2.32-1.6 3.35-1.42zM20.5 17.03c-.52 1.21-.77 1.75-1.45 2.83-.94 1.51-2.27 3.39-3.92 3.4-1.47.01-1.85-.95-3.83-.94-1.98.01-2.4.96-3.88.95-1.65-.01-2.91-1.71-3.85-3.22-2.64-4.23-2.92-9.19-1.29-11.83.94-1.57 2.51-2.49 3.96-2.49 1.47 0 2.39.96 3.83.96 1.39 0 2.25-.96 3.93-.96 1.27 0 2.62.69 3.58 1.89-3.15 1.72-2.64 6.22.92 7.41z"/></svg>
);
const WindowsGlyph = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M2 4.57L10 3.43V11.5H2V4.57zm0 7.93h8v7.43l-8-1.14V12.5zm9-9.22L22 1.86V11.5H11V3.28zM11 12.5h11v9.64l-11-1.64V12.5z"/></svg>
);
const LinuxGlyph = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2c-2.5 0-4 2-4 5 0 1.7.5 3 1 4-1 1-2.5 2.5-2.5 4.5 0 .8-.3 1.5-.8 2-.7.7-.7 1.8 0 2.5.5.5 1.2.6 1.8.3.4.7 1.2 1.2 2 1.2h5c.8 0 1.6-.5 2-1.2.6.3 1.3.2 1.8-.3.7-.7.7-1.8 0-2.5-.5-.5-.8-1.2-.8-2 0-2-1.5-3.5-2.5-4.5.5-1 1-2.3 1-4 0-3-1.5-5-4-5zm-1.5 4c.3 0 .5.2.5.5s-.2.5-.5.5-.5-.2-.5-.5.2-.5.5-.5zm3 0c.3 0 .5.2.5.5s-.2.5-.5.5-.5-.2-.5-.5.2-.5.5-.5zm-1.5 3c.8 0 1.5.7 1.5 1.5S12.8 12 12 12s-1.5-.7-1.5-1.5S11.2 9 12 9z"/></svg>
);
const CopyGlyph = () => (
  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>
);

window.Page = Page;
