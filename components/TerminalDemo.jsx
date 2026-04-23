// Con terminal demo — mirrors the real product:
// - Two title-bar toggles: [bottom-bar] on the left, [agent panel] on the right
// - Agent panel has its own input ONLY when the bottom bar is hidden
// - When the bottom bar is visible, it carries the mode chip + unified input

const TerminalDemo = ({ tweaks }) => {
  const [showAgent, setShowAgent] = React.useState(tweaks.showAgent ?? true);
  const [showBottom, setShowBottom] = React.useState(true);
  const [mode, setMode] = React.useState(tweaks.controlMode || 'agent');

  React.useEffect(() => { setShowAgent(tweaks.showAgent ?? true); }, [tweaks.showAgent]);
  React.useEffect(() => { if (tweaks.controlMode) setMode(tweaks.controlMode); }, [tweaks.controlMode]);

  return (
    <div className="con-window">
      {/* Title bar */}
      <div className="con-titlebar">
        <div className="traffic">
          <span className="tl tl-close" />
          <span className="tl tl-min" />
          <span className="tl tl-max" />
        </div>
        <div className="con-tabs">
          <div className="con-tab active">
            <span className="tab-dot" />
            <span>zsh</span>
            <span className="tab-x">×</span>
          </div>
          <button className="tab-new" aria-label="New tab">+</button>
        </div>
        <div className="con-win-actions">
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
          <div className="pane-content">
            <TerminalStreamA />
          </div>
        </div>

        {showAgent && <AgentPanel showOwnInput={!showBottom} />}
      </div>

      {/* Bottom bar */}
      {showBottom && (
        <div className="con-bottombar">
          <div className="bb-left">
            <span className="bb-path">~/src/con</span>
            <span className="bb-sep" />
            <span className="bb-git"><GitGlyph/> main · 3↑</span>
          </div>

          <div className="bb-center">
            <div className="bb-input-wrap">
              <span className={`bb-mode-chip ${mode}`}>{mode}</span>
              <input
                placeholder={
                  mode === 'agent' ? 'Ask claude-sonnet-4 anything…' :
                  mode === 'cmd'   ? 'Enter a shell command…' :
                                     'Type to run or ask. ⌘K cycles mode.'
                }
              />
            </div>
          </div>

          <div className="bb-right">
            <span className="bb-item"><KeyCap>⌘</KeyCap><KeyCap>K</KeyCap> mode</span>
          </div>
        </div>
      )}
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
const GitGlyph = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="4" r="1.5"/><circle cx="5" cy="12" r="1.5"/><circle cx="11" cy="8" r="1.5"/><path d="M5 5.5 V10.5 M5.8 11.3 C 8 10.5 8.5 9.5 9.5 8.5"/></svg>
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
