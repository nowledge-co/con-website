// Con terminal demo — mirrors the real product:
// - Tab bar hidden when there's only one tab
// - Title-bar actions: split, bottom-bar toggle, agent-panel toggle
// - Bottom bar carries: mode chip (smart | agent | shell), broadcast scope (shell + multi-pane), input, send
// - In shell mode with >1 pane, a Pane-scope popover lets the user broadcast input
// - Agent panel has its own input ONLY when the bottom bar is hidden

const MODES = ['smart', 'agent', 'shell'];
const MODE_LABEL = { smart: 'Smart mode', agent: 'Agent mode', shell: 'Shell mode' };
const MODE_PLACEHOLDER = {
  smart: 'Type a command or ask AI…',
  agent: 'Ask claude-sonnet-4 anything…',
  shell: 'Run a command…',
};

const TerminalDemo = ({ tweaks }) => {
  const initialMode = (tweaks.controlMode === 'cmd') ? 'shell'
                    : (tweaks.controlMode === 'auto') ? 'smart'
                    : (MODES.includes(tweaks.controlMode) ? tweaks.controlMode : 'smart');
  const [showAgent, setShowAgent] = React.useState(tweaks.showAgent ?? true);
  const [showBottom, setShowBottom] = React.useState(true);
  const [mode, setMode] = React.useState(initialMode);
  const [paneCount, setPaneCount] = React.useState(1);
  const [scope, setScope] = React.useState('all');
  const [scopeOpen, setScopeOpen] = React.useState(false);
  const [tabs] = React.useState([{ id: 'zsh', title: 'zsh' }]);

  React.useEffect(() => { setShowAgent(tweaks.showAgent ?? true); }, [tweaks.showAgent]);
  React.useEffect(() => {
    if (!tweaks.controlMode) return;
    const next = (tweaks.controlMode === 'cmd') ? 'shell'
              : (tweaks.controlMode === 'auto') ? 'smart'
              : tweaks.controlMode;
    if (MODES.includes(next)) setMode(next);
  }, [tweaks.controlMode]);

  const cycleMode = () => setMode(m => MODES[(MODES.indexOf(m) + 1) % MODES.length]);
  const toggleSplit = () => setPaneCount(c => (c === 1 ? 2 : 1));
  const showBroadcast = mode === 'shell' && paneCount > 1;
  const showTabs = tabs.length > 1;

  return (
    <div className="con-window">
      {/* Title bar */}
      <div className={`con-titlebar${showTabs ? '' : ' no-tabs'}`}>
        <div className="traffic">
          <span className="tl tl-close" />
          <span className="tl tl-min" />
          <span className="tl tl-max" />
        </div>
        {showTabs ? (
          <div className="con-tabs">
            {tabs.map(t => (
              <div key={t.id} className="con-tab active">
                <span className="tab-dot" />
                <span>{t.title}</span>
                <span className="tab-x">×</span>
              </div>
            ))}
            <button className="tab-new" aria-label="New tab">+</button>
          </div>
        ) : <div className="titlebar-spacer" />}
        <div className="con-win-actions">
          <button
            title={paneCount > 1 ? 'Close split' : 'Split pane'}
            className={paneCount > 1 ? 'active' : ''}
            onClick={toggleSplit}
          >
            <SplitGlyph/>
          </button>
          <button
            title={showBottom ? 'Hide bottom bar' : 'Show bottom bar'}
            className={showBottom ? 'active' : ''}
            onClick={() => setShowBottom(v => !v)}
          >
            <BottomPanelGlyph/>
          </button>
          <button
            title={showAgent ? 'Hide agent panel' : 'Show agent panel'}
            className={showAgent ? 'active' : ''}
            onClick={() => setShowAgent(v => !v)}
          >
            <AgentPanelGlyph/>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={`con-body${showAgent ? '' : ' no-agent'}`}>
        <div className="con-main">
          <div className={`pane-grid${paneCount > 1 ? ' split' : ''}`}>
            <div className={`pane${paneCount > 1 ? ' focused' : ''}`}>
              <TerminalStreamA />
            </div>
            {paneCount > 1 && (
              <div className="pane">
                <TerminalStreamB />
              </div>
            )}
          </div>
        </div>

        {showAgent && <AgentPanel showOwnInput={!showBottom} />}
      </div>

      {/* Bottom bar */}
      {showBottom && (
        <div className={`con-bottombar mode-${mode}`}>
          <div className="bb-mode-wrap">
            <button
              className={`bb-mode-btn mode-${mode}`}
              onClick={cycleMode}
              title="Cycle mode · ⌘K"
              aria-label={MODE_LABEL[mode]}
            >
              <ModeIcon mode={mode} />
            </button>
            <span className={`bb-mode-tooltip mode-${mode}`}>{MODE_LABEL[mode]}</span>
          </div>

          {showBroadcast && (
            <div className="bb-broadcast-wrap">
              <button
                className={`bb-broadcast${scopeOpen ? ' open' : ''}`}
                onClick={() => setScopeOpen(o => !o)}
                title="Pane scope · ⌘'"
              >
                <BroadcastGlyph/>
                <span>{scope === 'all' ? 'All panes' : 'Focused'}</span>
              </button>
              {scopeOpen && (
                <PaneScopePopover
                  scope={scope}
                  setScope={setScope}
                  paneCount={paneCount}
                  onClose={() => setScopeOpen(false)}
                />
              )}
            </div>
          )}

          <div className="bb-input-wrap">
            <input
              className={`bb-input mode-${mode}`}
              placeholder={MODE_PLACEHOLDER[mode]}
            />
          </div>

          <button className="bb-send" aria-label="Send"><ArrowUpGlyph/></button>
        </div>
      )}
    </div>
  );
};

// ---------- pane scope popover ----------
const PaneScopePopover = ({ scope, setScope, paneCount, onClose }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.bb-broadcast')) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, []);
  return (
    <div className="pane-scope" ref={ref}>
      <div className="ps-head">
        <div>
          <div className="ps-title">Pane scope</div>
          <div className="ps-sub">Choose where command-mode input is sent</div>
        </div>
        <div className="ps-kbd">
          <KeyCap>⌘</KeyCap><KeyCap>'</KeyCap><span className="ps-range">1-9</span>
        </div>
      </div>
      <div className="ps-tabs">
        <button className={`ps-tab${scope === 'all' ? ' active' : ''}`} onClick={() => setScope('all')}>All panes</button>
        <button className={`ps-tab${scope === 'focused' ? ' active' : ''}`} onClick={() => setScope('focused')}>Focused</button>
      </div>
      <div className="ps-minimap">
        {Array.from({ length: paneCount }).map((_, i) => (
          <div key={i} className={`ps-pane${(scope === 'focused' && i === 0) || scope === 'all' ? ' on' : ''}`}>
            <span className="ps-dot" />
            <span className="ps-tilde">~</span>
            <span className="ps-num">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --------- terminal streams ----------
const TerminalStreamA = () => (
  <pre className="ts">
    <Line dim>Last login: Thu Apr 23 14:02 on ttys004</Line>
    <Line/>
    <Line prompt>neofetch</Line>
    <div className="neofetch">
      <pre className="ascii">{`                   'c.
                ,xNMM.
              .OMMMMo
              OMMM0,
    .;loddo:' loolloddol;.
  cKMMMMMMMMMMNWMMMMMMMMMM0:
.KMMMMMMMMMMMMMMMMMMMMMMMWd.
XMMMMMMMMMMMMMMMMMMMMMMMX.
;MMMMMMMMMMMMMMMMMMMMMMMM:
:MMMMMMMMMMMMMMMMMMMMMMMM:
.MMMMMMMMMMMMMMMMMMMMMMMMX.
kMMMMMMMMMMMMMMMMMMMMMMMMWd.
.XMMMMMMMMMMMMMMMMMMMMMMMMMMk
 .XMMMMMMMMMMMMMMMMMMMMMMMMK.
   kMMMMMMMMMMMMMMMMMMMMMMd
    ;KMMMMMMMWXXWMMMMMMMk.
      .cooc,.    .,coo:.`}</pre>
      <div className="fetch">
        <div><span className="k">OS:</span> macOS 15.7.2 arm64</div>
        <div><span className="k">Host:</span> MacBook Pro</div>
        <div><span className="k">Kernel:</span> 24.6.0</div>
        <div><span className="k">Shell:</span> zsh 5.9</div>
        <div><span className="k">Terminal:</span> con 0.1.0-beta</div>
        <div><span className="k">CPU:</span> Apple M2 Max</div>
        <div><span className="k">Memory:</span> 16 / 96 GiB</div>
        <div className="swatch-row">
          <span style={{background:'#4a4a4a'}}/><span style={{background:'#d64747'}}/><span style={{background:'#74a96b'}}/><span style={{background:'#d4a84b'}}/>
          <span style={{background:'#5b86d6'}}/><span style={{background:'#a06bd4'}}/><span style={{background:'#5bb6b0'}}/><span style={{background:'#c7c7c7'}}/>
        </div>
      </div>
    </div>
    <Line/>
    <Line prompt><CursorBlink/></Line>
  </pre>
);

const TerminalStreamB = () => (
  <pre className="ts">
    <Line dim>Last login: Thu Apr 23 14:08 on ttys005</Line>
    <Line/>
    <Line prompt>kubectl get pods -n prod</Line>
    <Line dim>NAME                       READY   STATUS    RESTARTS   AGE</Line>
    <Line>api-7c4b9d8f5-2rxqv         1/1     Running   0          4d</Line>
    <Line>api-7c4b9d8f5-h8mpz         1/1     Running   0          4d</Line>
    <Line>worker-9f2c1b6e4-xj4kl      1/1     Running   1          2d</Line>
    <Line/>
    <Line prompt><CursorBlink/></Line>
  </pre>
);

const Line = ({ prompt, dim, children }) => (
  <div className={`tl-line${dim ? ' dim' : ''}`}>
    {prompt && <span className="tl-prompt">❯&nbsp;</span>}
    <span>{children}</span>
  </div>
);
const CursorBlink = () => <span className="tl-cursor" />;

// --------- agent side panel ----------
const AgentPanel = ({ showOwnInput }) => (
  <aside className="agent">
    <div className="agent-head">
      <div className="agent-head-left">
        <button className="icon-btn" title="New chat"><PlusGlyph/></button>
        <button className="icon-btn" title="History"><HistoryGlyph/></button>
      </div>
      <div className="agent-head-right">
        <Dropdown label="Anthropic" />
        <Dropdown label="claude-sonnet-4" />
      </div>
    </div>

    <div className="agent-messages">
      <div className="ag-msg user">
        <div className="ag-body">Find where we set max_tokens, bump it to 8192.</div>
      </div>

      <div className="ag-msg assistant">
        <div className="ag-body">Reading <code>crates/con-core/src/config.rs</code>…</div>
      </div>

      <div className="tool-card done">
        <div className="tool-head">
          <FileGlyph/>
          <span className="tool-name">file_read</span>
          <span className="tool-arg">config.rs</span>
          <span className="tool-ok">✓</span>
        </div>
      </div>

      <div className="ag-msg assistant">
        <div className="ag-body">
          Line 47, currently <code>4096</code>. I'll patch it.
        </div>
      </div>

      <div className="tool-card approval">
        <div className="tool-head">
          <EditGlyph/>
          <span className="tool-name">edit_file</span>
          <span className="tool-arg">config.rs · 1 change</span>
        </div>
        <pre className="diff">
          <div className="d-line remove">- max_tokens = 4096</div>
          <div className="d-line add">+ max_tokens = 8192</div>
        </pre>
        <div className="tool-actions">
          <button className="deny">Deny</button>
          <button className="allow">Allow</button>
        </div>
      </div>
    </div>

    {showOwnInput && (
      <div className="agent-input">
        <input placeholder="Ask anything…" />
        <button className="send"><ArrowUpGlyph/></button>
      </div>
    )}
  </aside>
);

// --------- small bits ----------
const Dropdown = ({ label }) => (
  <button className="dd">
    {label}
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4 L5 7 L8 4"/></svg>
  </button>
);
const KeyCap = ({ children }) => <span className="keycap">{children}</span>;

// ---- mode icons ----
const ModeIcon = ({ mode }) => {
  if (mode === 'smart') return <SmartGlyph/>;
  if (mode === 'agent') return <AgentModeGlyph/>;
  return <ShellGlyph/>;
};
const SmartGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 13 L11.5 4.5"/>
    <path d="M11.5 4.5 L13 3 L13.5 4.5 L13 6 L11.5 4.5 Z" fill="currentColor"/>
    <path d="M5 4 L5 6 M4 5 L6 5"/>
    <path d="M13 10 L13 12 M12 11 L14 11"/>
  </svg>
);
const AgentModeGlyph = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
    <rect x="2.5" y="3" width="11" height="10" rx="2"/>
    <path d="M2.5 5.5 H13.5"/>
    <circle cx="4.5" cy="4.25" r="0.4" fill="currentColor" stroke="none"/>
    <circle cx="6"   cy="4.25" r="0.4" fill="currentColor" stroke="none"/>
  </svg>
);
const ShellGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 5 L6.5 8 L3 11"/>
    <path d="M8 12 H13"/>
  </svg>
);

const SplitGlyph = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="2" y="3.5" width="12" height="9" rx="1.6"/>
    <path d="M8 3.5 V12.5"/>
  </svg>
);
const AgentPanelGlyph = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="2" y="3.5" width="12" height="9" rx="1.6"/>
    <rect x="9.5" y="3.5" width="4.5" height="9" rx="0" fill="currentColor" opacity="0.35" stroke="none"/>
    <path d="M9.5 3.5 V12.5"/>
  </svg>
);
const BottomPanelGlyph = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="2" y="3.5" width="12" height="9" rx="1.6"/>
    <rect x="2" y="9.5" width="12" height="3" rx="0" fill="currentColor" opacity="0.35" stroke="none"/>
    <path d="M2 9.5 H14"/>
  </svg>
);
const BroadcastGlyph = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/>
    <path d="M5.5 5.5 A3.5 3.5 0 0 0 5.5 10.5"/>
    <path d="M10.5 5.5 A3.5 3.5 0 0 1 10.5 10.5"/>
    <path d="M3.6 3.6 A6 6 0 0 0 3.6 12.4"/>
    <path d="M12.4 3.6 A6 6 0 0 1 12.4 12.4"/>
  </svg>
);
const PlusGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M8 3 V13 M3 8 H13"/></svg>
);
const HistoryGlyph = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="5.5"/><path d="M8 5 V8 L10 9.5"/></svg>
);
const FileGlyph = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 2 H9.5 L12 4.5 V14 H4 Z M9.5 2 V4.5 H12"/></svg>
);
const EditGlyph = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M3 13 L3 10.5 L10.5 3 L13 5.5 L5.5 13 Z"/></svg>
);
const ArrowUpGlyph = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 13 V3 M4 7 L8 3 L12 7"/></svg>
);

window.TerminalDemo = TerminalDemo;
