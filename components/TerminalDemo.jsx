// Con terminal demo — mirrors the current app:
// - Tab strip stays visible. Titles use the terminal glyph.
// - Title-bar actions: new tab, left sidebar, input bar, agent panel.
// - Bottom bar: mode icon, pane scope when more than one pane is open, input, send.
// - Agent panel has its own input only when the bottom bar is hidden.

const MODES = ['smart', 'agent', 'shell'];
const MODE_LABEL = { smart: 'Smart mode', agent: 'Agent mode', shell: 'Shell mode' };
const MODE_PLACEHOLDER = {
  smart: 'Type a command or ask AI…',
  agent: 'Ask anything…',
  shell: 'Run a command…',
};
const MODE_ICON = {
  smart: '/assets/input-mode-smart.png',
  shell: '/assets/input-mode-shell.png',
  agent: '/assets/input-mode-agent.png',
};
const BASE_AGENT_MESSAGES = [
  { kind: 'user', body: 'What am I looking at in this workspace?' },
  { kind: 'tool-context' },
  { kind: 'assistant', body: <>You are in <code>~/dev/con</code> on <code>main</code>. I can read the visible pane and prepare the next command before anything runs.</> },
  { kind: 'tool-doc' },
  { kind: 'assistant', body: <>Quick controls are active: <code>⌘I</code> moves focus, <code>⌘L</code> shows the agent panel, and shell mode can target one pane or every split pane.</> },
];
const prefersCompactDemo = () => (
  typeof window !== 'undefined' && window.matchMedia('(max-width: 560px)').matches
);

const TerminalDemo = ({ tweaks }) => {
  const initialMode = (tweaks.controlMode === 'cmd') ? 'shell'
                    : (tweaks.controlMode === 'auto') ? 'smart'
                    : (MODES.includes(tweaks.controlMode) ? tweaks.controlMode : 'smart');
  const [showAgent, setShowAgent] = React.useState(() => (
    prefersCompactDemo() ? false : (tweaks.showAgent ?? false)
  ));
  const [showBottom, setShowBottom] = React.useState(false);
  const [showSidebar, setShowSidebar] = React.useState(false);
  const [mode, setMode] = React.useState(initialMode);
  const [paneCount] = React.useState(1);
  const [scope, setScope] = React.useState('all');
  const [focusedPane, setFocusedPane] = React.useState(0);
  const [scopeOpen, setScopeOpen] = React.useState(false);
  const [command, setCommand] = React.useState('');
  const [paneLogs, setPaneLogs] = React.useState([[], []]);
  const [paneDrafts, setPaneDrafts] = React.useState(['', '']);
  const [agentMessages, setAgentMessages] = React.useState([]);
  const [tabs, setTabs] = React.useState([
    { id: 'con', title: 'con' },
  ]);
  const [activeTab, setActiveTab] = React.useState('con');

  React.useEffect(() => {
    if (!prefersCompactDemo()) setShowAgent(tweaks.showAgent ?? false);
  }, [tweaks.showAgent]);
  React.useEffect(() => {
    document.querySelectorAll('.con-window .pane').forEach((pane) => {
      pane.scrollTop = pane.scrollHeight;
    });
  }, [paneLogs[0].length, paneLogs[1].length, paneCount]);
  React.useEffect(() => {
    if (!tweaks.controlMode) return;
    const next = (tweaks.controlMode === 'cmd') ? 'shell'
              : (tweaks.controlMode === 'auto') ? 'smart'
              : tweaks.controlMode;
    if (MODES.includes(next)) setMode(next);
  }, [tweaks.controlMode]);

  const cycleMode = () => setMode(m => MODES[(MODES.indexOf(m) + 1) % MODES.length]);
  const addTab = () => {
    const id = `shell-${tabs.length + 1}`;
    setTabs(current => [...current, { id, title: 'shell' }]);
    setActiveTab(id);
  };
  const closeTab = (id) => {
    if (tabs.length < 2) return;
    const next = tabs.filter(tab => tab.id !== id);
    setTabs(next);
    if (activeTab === id) setActiveTab(next[0].id);
  };
  const showBroadcast = mode !== 'agent' && paneCount > 1;
  const raised = paneCount > 1 || showSidebar || showAgent;
  const appendToPanes = (paneIndexes, lines) => {
    setPaneLogs(current => current.map((log, i) => (
      paneIndexes.includes(i) ? [...log, ...lines] : log
    )));
  };
  const appendAgentExchange = (text, source = 'agent') => {
    const reply = buildAgentReply(text, source);
    setAgentMessages(current => [
      ...current,
      { kind: 'user', body: text },
      { kind: 'assistant', body: reply },
    ]);
  };
  const runShellCommand = (raw) => {
    const text = raw.trim();
    if (!text) return;
    const targets = paneCount > 1 && scope === 'all'
      ? Array.from({ length: paneCount }, (_, i) => i)
      : [focusedPane];
    if (text === 'clear') {
      setPaneLogs(current => current.map((log, i) => (targets.includes(i) ? [] : log)));
      return;
    }
    appendToPanes(targets, buildShellLines(text));
  };
  const runPaneCommand = (paneIndex) => {
    const text = paneDrafts[paneIndex].trim();
    if (!text) return;
    if (text === 'clear') {
      setPaneLogs(current => current.map((log, i) => (i === paneIndex ? [] : log)));
    } else {
      appendToPanes([paneIndex], buildShellLines(text));
    }
    setPaneDrafts(current => current.map((draft, i) => (i === paneIndex ? '' : draft)));
  };
  const handlePaneKeyDown = (paneIndex, e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      runPaneCommand(paneIndex);
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      setPaneDrafts(current => current.map((draft, i) => (
        i === paneIndex ? draft.slice(0, -1) : draft
      )));
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setPaneDrafts(current => current.map((draft, i) => (i === paneIndex ? '' : draft)));
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      setPaneDrafts(current => current.map((draft, i) => (
        i === paneIndex ? draft + e.key : draft
      )));
    }
  };
  const handlePanePaste = (paneIndex, e) => {
    const text = e.clipboardData?.getData('text');
    if (!text) return;
    e.preventDefault();
    const oneLine = text.replace(/\r?\n/g, ' ');
    setPaneDrafts(current => current.map((draft, i) => (
      i === paneIndex ? draft + oneLine : draft
    )));
  };
  const focusPane = (paneIndex, e) => {
    setFocusedPane(paneIndex);
    e.currentTarget.focus();
  };
  const passWheelToPage = (e) => {
    if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    window.scrollBy({ top: e.deltaY, behavior: 'auto' });
  };
  const submitCommand = () => {
    const text = command.trim();
    if (!text) return;
    if (mode === 'shell') {
      runShellCommand(text);
    } else if (mode === 'agent') {
      setShowAgent(true);
      appendAgentExchange(text, 'bottom bar');
    } else if (looksLikeShell(text)) {
      runShellCommand(text);
    } else {
      setShowAgent(true);
      appendAgentExchange(text, 'smart mode');
    }
    setCommand('');
    setScopeOpen(false);
  };
  return (
    <div className="con-window" onWheelCapture={passWheelToPage}>
      {/* Title bar */}
      <div className="con-titlebar">
        <div className="traffic" aria-hidden="true">
          <span className="tl tl-close" />
          <span className="tl tl-min" />
          <span className="tl tl-max" />
        </div>
        <div className="con-tabs" role="tablist" aria-label="Terminal tabs">
          {tabs.map(t => (
            <div
              key={t.id}
              className={`con-tab${t.id === activeTab ? ' active' : ''}`}
              role="tab"
              aria-selected={t.id === activeTab}
              tabIndex={0}
              onClick={() => setActiveTab(t.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveTab(t.id);
                }
              }}
            >
              <TerminalGlyph/>
              <span className="tab-title">{t.title}</span>
              <button
                type="button"
                className="tab-x"
                aria-label={`Close ${t.title}`}
                onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
              >
                <CloseGlyph/>
              </button>
            </div>
          ))}
        </div>
        <div className="con-win-actions">
          <button type="button" title="New tab" aria-label="New tab" onClick={addTab}>
            <PlusGlyph/>
          </button>
          <button
            type="button"
            title={showSidebar ? 'Hide left sidebar' : 'Show left sidebar'}
            aria-label={showSidebar ? 'Hide left sidebar' : 'Show left sidebar'}
            aria-pressed={showSidebar}
            className={showSidebar ? 'active' : ''}
            onClick={() => setShowSidebar(v => !v)}
          >
            <SidebarGlyph/>
          </button>
          <button
            type="button"
            title={showBottom ? 'Hide input bar' : 'Show input bar'}
            aria-label={showBottom ? 'Hide input bar' : 'Show input bar'}
            aria-pressed={showBottom}
            className={showBottom ? 'active' : ''}
            onClick={() => setShowBottom(v => !v)}
          >
            <InputBarGlyph/>
          </button>
          <button
            type="button"
            title={showAgent ? 'Hide agent panel' : 'Show agent panel'}
            aria-label={showAgent ? 'Hide agent panel' : 'Show agent panel'}
            aria-pressed={showAgent}
            className={showAgent ? 'active' : ''}
            onClick={() => setShowAgent(v => !v)}
          >
            <AgentPanelGlyph/>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className={`con-body${showAgent ? '' : ' no-agent'}${showSidebar ? ' with-sidebar' : ''}${raised ? ' raised' : ''}`}>
        {showSidebar && (
          <aside className="con-sidebar" aria-label="Files">
            <div className="sb-head">Files</div>
            <div className="sb-item dir">crates</div>
            <div className="sb-item">README.md</div>
            <div className="sb-item">Cargo.toml</div>
            <div className="sb-item dir">docs</div>
          </aside>
        )}
        <div className="con-main">
          <div className={`pane-grid${paneCount > 1 ? ' split' : ''}${raised ? ' cards' : ' flush'}`}>
            <div
              className={`pane${focusedPane === 0 ? ' focused' : ''}`}
              onClick={(e) => focusPane(0, e)}
              onFocus={() => setFocusedPane(0)}
              onKeyDown={(e) => handlePaneKeyDown(0, e)}
              onPaste={(e) => handlePanePaste(0, e)}
              tabIndex={0}
              role="textbox"
              aria-label="Terminal pane 1"
              aria-multiline="true"
            >
              {paneCount > 1 && <PaneHead title="con" />}
              <TerminalStreamLiveA entries={paneLogs[0]} draft={paneDrafts[0]} focused={focusedPane === 0} />
            </div>
            {paneCount > 1 && (
              <div
                className={`pane${focusedPane === 1 ? ' focused' : ''}`}
                onClick={(e) => focusPane(1, e)}
                onFocus={() => setFocusedPane(1)}
                onKeyDown={(e) => handlePaneKeyDown(1, e)}
                onPaste={(e) => handlePanePaste(1, e)}
                tabIndex={0}
                role="textbox"
                aria-label="Terminal pane 2"
                aria-multiline="true"
              >
                <PaneHead title="con" />
                <TerminalStreamLiveB entries={paneLogs[1]} draft={paneDrafts[1]} focused={focusedPane === 1} />
              </div>
            )}
          </div>

          {showBottom && (
            <div className={`con-bottombar mode-${mode}`}>
              <div className="bb-mode-wrap">
                <button
                  type="button"
                  className={`bb-mode-btn mode-${mode}`}
                  onClick={cycleMode}
                  title="Cycle mode · ⌘;"
                  aria-label={MODE_LABEL[mode]}
                >
                  <img src={MODE_ICON[mode]} alt="" width="22" height="22" />
                </button>
              </div>

              {showBroadcast && (
                <div className="bb-broadcast-wrap">
                  <button
                    className={`bb-broadcast${scopeOpen ? ' open' : ''}`}
                    onClick={() => setScopeOpen(o => !o)}
                    title="Pane scope · ⌘'"
                  >
                    <BroadcastGlyph/>
                    <span>{scope === 'all' ? 'All panes' : `Pane ${focusedPane + 1}`}</span>
                  </button>
                  {scopeOpen && (
                    <PaneScopePopover
                      scope={scope}
                      setScope={setScope}
                      paneCount={paneCount}
                      focusedPane={focusedPane}
                      setFocusedPane={setFocusedPane}
                      onClose={() => setScopeOpen(false)}
                    />
                  )}
                </div>
              )}

              <div className="bb-input-wrap">
                <input
                  className={`bb-input mode-${mode}`}
                  placeholder={MODE_PLACEHOLDER[mode]}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitCommand(); }}
                />
              </div>

              <button type="button" className={`bb-send${command.trim() ? ' ready' : ''}`} aria-label="Send" onClick={submitCommand}><ArrowUpGlyph/></button>
            </div>
          )}
        </div>

        {showAgent && (
          <AgentPanel
            showOwnInput={!showBottom}
            messages={agentMessages}
            onSubmit={(text) => appendAgentExchange(text, 'agent panel')}
          />
        )}
      </div>
    </div>
  );
};

// ---------- pane scope popover ----------
const PaneScopePopover = ({ scope, setScope, paneCount, focusedPane, setFocusedPane, onClose }) => {
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
          <button
            key={i}
            className={`ps-pane${(scope === 'focused' && i === focusedPane) || scope === 'all' ? ' on' : ''}`}
            onClick={() => { setFocusedPane(i); setScope('focused'); }}
            type="button"
          >
            <span className="ps-dot" />
            <span className="ps-tilde">~</span>
            <span className="ps-num">{i + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const looksLikeShell = (text) => /^(brew|cargo|cd|clear|con-cli|curl|git|just|kubectl|ls|npm|pnpm|pwd|rg|ssh|vim|yarn)(\s|$)/.test(text.trim());

const buildShellLines = (text) => {
  const canned = shellOutputFor(text);
  return [
    { type: 'prompt', text },
    ...canned.map(line => ({ type: line.dim ? 'dim' : 'output', text: line.text })),
  ];
};

const shellOutputFor = (text) => {
  if (text === 'pwd') return [{ text: '/Users/weyl/dev/con' }];
  if (text === 'ls') return [{ text: 'Cargo.toml  crates  docs  assets  README.md  CHANGELOG.md' }];
  if (text.startsWith('git status')) return [
    { text: '## main...origin/main' },
    { text: 'nothing to commit, working tree clean', dim: true },
  ];
  if (text.startsWith('rg "Quick Terminal"')) return [
    { text: 'README.md:76: Show or hide Quick Terminal  ⌘ Backslash', dim: true },
    { text: 'docs/quick-terminal.md:1:# Quick Terminal' },
    { text: 'docs/quick-controls.md:12:Quick controls keep terminal and agent focus one shortcut away.' },
  ];
  if (text.startsWith('con-cli panes list')) return [
    { text: 'PANE  SURFACE   CWD          RUNTIME     STATE', dim: true },
    { text: '1     shell     ~/dev/con    zsh         focused' },
    { text: '2     logs      ~/dev/con    cargo test  running' },
  ];
  if (text.startsWith('con-cli surfaces list')) return [
    { text: 'SURFACE  PANE  TITLE          OWNER', dim: true },
    { text: 'shell    1     ~/dev/con      human' },
    { text: 'agent    1     review notes   agent panel' },
  ];
  if (text.startsWith('cargo test')) return [
    { text: 'running 18 tests', dim: true },
    { text: 'test workspace::restore_layout ... ok' },
    { text: 'test workspace::pane_scope_targets ... ok' },
    { text: 'test result: ok. 18 passed; 0 failed; finished in 0.42s' },
  ];
  if (text.startsWith('just dev')) return [
    { text: 'cargo run -p con-app --features dev', dim: true },
    { text: 'watching crates/con-app, crates/con-core, assets' },
    { text: 'app ready · GPU surface attached' },
  ];
  if (text.startsWith('kubectl')) return [
    { text: 'NAME                       READY   STATUS    RESTARTS   AGE', dim: true },
    { text: 'api-7c4b9d8f5-rxqv         1/1     Running   0          4d' },
    { text: 'worker-9f2c1b6e4-xj4kl      1/1     Running   1          2d' },
  ];
  return [{ text: `ran: ${text}` }];
};

const buildAgentReply = (text, source) => {
  const lower = text.toLowerCase();
  if (lower.includes('focused pane') || lower.includes('current pane') || lower.includes('workspace')) {
    return <>The focused pane is a clean <code>zsh</code> session in <code>~/dev/con</code>. A safe next move is <code>git status --short --branch</code>, then inspect <code>README.md</code> or <code>docs/quick-controls.md</code> before changing anything.</>;
  }
  if (lower.includes('quick terminal') || lower.includes('shortcut') || lower.includes('control')) {
    return <>Use quick controls when you want the terminal to stay primary: <code>⌘I</code> toggles focus, <code>⌘L</code> opens the agent panel, and <code>⌘\</code> shows Quick Terminal after it is enabled in Settings.</>;
  }
  if (lower.includes('pane') || lower.includes('broadcast') || lower.includes('split')) {
    return <>Split panes share the same terminal model. In shell mode, pane scope lets you send a command to the focused pane or broadcast it across every visible pane.</>;
  }
  if (looksLikeShell(text)) {
    return source === 'smart mode'
      ? <>That looks like shell input, so smart mode routed it to the focused pane.</>
      : <>That looks like shell input. Switch to shell or smart mode to route it to a pane, or keep discussing it here.</>;
  }
  return <>I can work from the terminal state you can already see: read the pane, check docs, propose a command, or ask before editing files.</>;
};

// --------- terminal streams ----------
const PaneHead = ({ title }) => (
  <div className="pane-head">
    <TerminalGlyph />
    <span>{title}</span>
  </div>
);

const PromptBlock = ({ draft, focused }) => (
  <>
    <div className="tl-line prompt-meta">
      <span className="tl-path">~/dev/con</span>
      <span className="tl-branch">main</span>
    </div>
    <div className="tl-line">
      <span className="tl-gt">&gt;</span>
      {draft ? <span className="tl-cmd">{draft}</span> : null}
      {focused && <CursorBlink/>}
    </div>
  </>
);

const TerminalStreamLiveA = ({ entries, draft, focused }) => (
  <pre className="ts">
    <TerminalEntries entries={entries} />
    <PromptBlock draft={draft} focused={focused} />
  </pre>
);

const TerminalStreamLiveB = ({ entries, draft, focused }) => (
  <pre className="ts">
    <TerminalEntries entries={entries} />
    <PromptBlock draft={draft} focused={focused} />
  </pre>
);

const TerminalEntries = ({ entries }) => (
  <>
    {entries.map((entry, i) => (
      entry.type === 'prompt' ? (
        <React.Fragment key={i}>
          <div className="tl-line prompt-meta">
            <span className="tl-path">~/dev/con</span>
            <span className="tl-branch">main</span>
          </div>
          <div className="tl-line">
            <span className="tl-gt">&gt;</span>
            <span className="tl-cmd">{entry.text}</span>
          </div>
        </React.Fragment>
      ) : (
        <Line key={i} dim={entry.type === 'dim'}>{entry.text}</Line>
      )
    ))}
  </>
);

const Line = ({ dim, children }) => (
  <div className={`tl-line${dim ? ' dim' : ''}`}>
    <span>{children}</span>
  </div>
);
const CursorBlink = () => <span className="tl-cursor" />;

// --------- agent side panel ----------
const AgentPanel = ({ showOwnInput, messages, onSubmit }) => {
  const [draft, setDraft] = React.useState('');
  const messagesRef = React.useRef(null);
  React.useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages.length]);
  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSubmit(text);
    setDraft('');
  };
  return (
    <aside className={`agent${showOwnInput ? ' with-own-input' : ''}`}>
      <div className="agent-head">
        <Dropdown label="Agent" />
        <div className="agent-head-right">
          <button type="button" className="icon-btn" title="History"><HistoryGlyph/></button>
          <button type="button" className="icon-btn" title="New chat"><PlusGlyph/></button>
        </div>
      </div>

      <div className="agent-messages" ref={messagesRef}>
        {messages.length === 0 ? (
          <p className="agent-empty">Ask anything about your terminal, code, or system. The agent can read files, run commands, and search your workspace.</p>
        ) : messages.map((message, i) => <AgentMessage key={i} message={message} />)}
      </div>

      {showOwnInput && (
        <div className="agent-input">
          <input
            placeholder="Ask anything…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          />
          <button className="send" onClick={send} aria-label="Send to agent"><ArrowUpGlyph/></button>
        </div>
      )}
    </aside>
  );
};

const AgentMessage = ({ message }) => {
  if (message.kind === 'tool-context') {
    return (
      <div className="tool-card done">
        <div className="tool-head">
          <TerminalGlyph/>
          <span className="tool-name">read_pane</span>
          <span className="tool-arg">visible output · cwd · git</span>
          <span className="tool-ok">✓</span>
        </div>
      </div>
    );
  }
  if (message.kind === 'tool-doc') {
    return (
      <div className="tool-card done">
        <div className="tool-head">
          <FileGlyph/>
          <span className="tool-name">read_docs</span>
          <span className="tool-arg">README.md · quick-controls</span>
          <span className="tool-ok">✓</span>
        </div>
      </div>
    );
  }
  return (
    <div className={`ag-msg ${message.kind}`}>
      <div className="ag-body">{message.body}</div>
    </div>
  );
};

// --------- small bits ----------
const Dropdown = ({ label }) => (
  <button className="dd">
    {label}
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4 L5 7 L8 4"/></svg>
  </button>
);
const KeyCap = ({ children }) => <span className="keycap">{children}</span>;

const PlusGlyph = () => (
  <svg viewBox="0 0 256 256" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" aria-hidden="true">
    <line x1="40" y1="128" x2="216" y2="128"/>
    <line x1="128" y1="40" x2="128" y2="216"/>
  </svg>
);
const SidebarGlyph = () => (
  <svg viewBox="0 0 256 256" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="88" y1="48" x2="88" y2="208"/>
    <rect x="32" y="48" width="192" height="160" rx="8"/>
    <line x1="32" y1="80" x2="56" y2="80"/>
    <line x1="32" y1="112" x2="56" y2="112"/>
    <line x1="32" y1="144" x2="56" y2="144"/>
  </svg>
);
const InputBarGlyph = () => (
  <svg viewBox="0 0 256 256" width="13" height="13" aria-hidden="true">
    <path fill="currentColor" d="M200,40H56A16,16,0,0,0,40,56V200a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40Zm0,16v72H56V56Z"/>
  </svg>
);
const AgentPanelGlyph = () => (
  <svg viewBox="0 0 256 256" width="13" height="13" aria-hidden="true">
    <path fill="currentColor" d="M200,40H56A16,16,0,0,0,40,56V200a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V56A16,16,0,0,0,200,40ZM56,56h72V200H56Z"/>
  </svg>
);
const BroadcastGlyph = () => (
  <svg viewBox="0 0 256 256" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" aria-hidden="true">
    <circle cx="128" cy="128" r="32" fill="currentColor" opacity="0.2" stroke="none"/>
    <circle cx="128" cy="128" r="32"/>
    <path d="M181.67,80a71.94,71.94,0,0,1,0,96"/>
    <path d="M74.33,176a71.94,71.94,0,0,1,0-96"/>
  </svg>
);
const CloseGlyph = () => (
  <svg viewBox="0 0 256 256" width="9" height="9" aria-hidden="true">
    <path fill="currentColor" d="M202.83,197.17a4,4,0,0,1-5.66,5.66L128,133.66,58.83,202.83a4,4,0,0,1-5.66-5.66L122.34,128,53.17,58.83a4,4,0,0,1,5.66-5.66L128,122.34l69.17-69.17a4,4,0,1,1,5.66,5.66L133.66,128Z"/>
  </svg>
);
const HistoryGlyph = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="5.5"/><path d="M8 5 V8 L10 9.5"/></svg>
);
const FileGlyph = () => (
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 2 H9.5 L12 4.5 V14 H4 Z M9.5 2 V4.5 H12"/></svg>
);
const TerminalGlyph = () => (
  <svg viewBox="0 0 256 256" width="13" height="13" aria-hidden="true">
    <path fill="currentColor" d="M117.31,134l-72,64a8,8,0,1,1-10.63-12L100,128,34.69,70A8,8,0,1,1,45.32,58l72,64a8,8,0,0,1,0,12ZM216,184H120a8,8,0,0,0,0,16h96a8,8,0,0,0,0-16Z"/>
  </svg>
);
const ArrowUpGlyph = () => (
  <svg viewBox="0 0 256 256" width="14" height="14" aria-hidden="true">
    <path fill="currentColor" d="M205.66,117.66a8,8,0,0,1-11.32,0L136,59.31V216a8,8,0,0,1-16,0V59.31L61.66,117.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0l72,72A8,8,0,0,1,205.66,117.66Z"/>
  </svg>
);

window.TerminalDemo = TerminalDemo;
