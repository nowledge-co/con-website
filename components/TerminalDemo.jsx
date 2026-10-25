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
const FILE_TREE = [
  { name: 'con', kind: 'dir', children: [
    { name: 'crates', kind: 'dir', children: [
      { name: 'con-app', kind: 'dir', children: [
        { name: 'src', kind: 'dir', children: [
          { name: 'main.rs', kind: 'rust' },
          { name: 'agent_panel.rs', kind: 'rust' },
          { name: 'file_tree_view.rs', kind: 'rust' },
        ] },
      ] },
      { name: 'con-agent', kind: 'dir', children: [
        { name: 'src', kind: 'dir', children: [
          { name: 'provider.rs', kind: 'rust' },
        ] },
      ] },
      { name: 'con-core', kind: 'dir', children: [
        { name: 'src', kind: 'dir', children: [
          { name: 'lib.rs', kind: 'rust' },
        ] },
      ] },
    ] },
    { name: 'assets', kind: 'dir', children: [
      { name: 'themes', kind: 'dir', children: [
        { name: 'con-dark.json', kind: 'json' },
      ] },
    ] },
    { name: 'docs', kind: 'dir', children: [
      { name: 'quick-terminal.md', kind: 'md' },
      { name: 'quick-controls.md', kind: 'md' },
    ] },
    { name: 'Cargo.toml', kind: 'toml' },
    { name: 'README.md', kind: 'md' },
  ] },
];
const SEARCH_INDEX = [
  { file: 'README.md', line: 76, text: 'Show or hide Quick Terminal' },
  { file: 'docs/quick-terminal.md', line: 1, text: 'Quick Terminal drops a pane over the workspace.' },
  { file: 'docs/quick-controls.md', line: 12, text: 'Quick controls keep the terminal and the agent one shortcut apart.' },
  { file: 'crates/con-app/src/workspace/frame.rs', line: 18, text: 'const CARD_GAP: f32 = 5.0;' },
  { file: 'crates/con-app/src/agent_panel.rs', line: 123, text: 'Ask anything about your terminal, code, or system.' },
];
const PROVIDERS = [
  { id: 'kimi', label: 'Kimi', icon: '/assets/provider-icons/kimi-color.svg', models: ['kimi-k3.1-pro', 'kimi-k2.5'] },
  { id: 'claude', label: 'Claude', icon: '/assets/provider-icons/claude-color.svg', models: ['claude-sonnet-4.5', 'claude-opus-4.1'] },
  { id: 'openai', label: 'OpenAI', icon: '/assets/provider-icons/openai.svg', models: ['gpt-5', 'gpt-5-mini'] },
  { id: 'gemini', label: 'Gemini', icon: '/assets/provider-icons/gemini-color.svg', models: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
];
const SHELL_PATH = '~/dev/harbor';
const INITIAL_LOG = [
  { type: 'prompt', text: 'cargo test -p api --quiet' },
  { type: 'gap' },
  { type: 'output', text: 'test result: ok. 12 passed; 0 failed; 0 ignored', tone: 'add' },
];
const CODEX_SCENES = {
  release: {
    prompt: 'Draft the 1.4 release note from the changelog, and keep the voice of the last one.',
    task: 'Reading CHANGELOG.md',
    started: 6,
  },
  upgrade: {
    prompt: 'Write the upgrade notes for anyone still on 1.3.',
    task: 'Listing migrations/',
    started: 3,
  },
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
  const [showBottom, setShowBottom] = React.useState(true);
  const [showSidebar, setShowSidebar] = React.useState(false);
  const [mode, setMode] = React.useState(initialMode);
  const [paneCount, setPaneCount] = React.useState(2);
  const [splitDir, setSplitDir] = React.useState('right');
  const [sidebarSlot, setSidebarSlot] = React.useState('files');
  const [expanded, setExpanded] = React.useState(() => new Set(['con', 'con/crates', 'con/crates/con-app', 'con/crates/con-app/src']));
  const [activeFile, setActiveFile] = React.useState('con/crates/con-app/src/agent_panel.rs');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [contextMenu, setContextMenu] = React.useState(null);
  const [scope, setScope] = React.useState('all');
  const [focusedPane, setFocusedPane] = React.useState(1);
  const [scopeOpen, setScopeOpen] = React.useState(false);
  const [command, setCommand] = React.useState('');
  const [paneLogs, setPaneLogs] = React.useState([INITIAL_LOG, []]);
  const [paneDrafts, setPaneDrafts] = React.useState(['', '']);
  const [agentMessages, setAgentMessages] = React.useState([]);
  const [tabs, setTabs] = React.useState([
    { id: 'harbor', title: 'Harbor', icon: 'terminal', icons: ['codex', 'terminal'] },
    { id: 'codex', title: 'Codex', icon: 'codex', busy: true },
    { id: 'monitor', title: 'Monitor', icon: 'monitor' },
  ]);
  const [activeTab, setActiveTab] = React.useState('harbor');

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
    const presets = [
      { title: 'codex', icon: 'codex' },
      { title: 'editor', icon: 'code' },
      { title: 'shell', icon: 'terminal' },
    ];
    const preset = presets.find(item => !tabs.some(tab => tab.title === item.title))
      || { title: `shell ${tabs.length + 1}`, icon: 'terminal' };
    const id = `${preset.icon}-${tabs.length + 1}`;
    setTabs(current => [...current, { id, ...preset }]);
    setActiveTab(id);
  };
  const closeTab = (id) => {
    if (tabs.length < 2) return;
    const next = tabs.filter(tab => tab.id !== id);
    setTabs(next);
    if (activeTab === id) setActiveTab(next[0].id);
  };
  const activeSurface = tabs.find(tab => tab.id === activeTab) || tabs[0];
  const terminalSurface = activeSurface.icon === 'terminal';
  const showBroadcast = mode !== 'agent' && paneCount > 1 && terminalSurface;
  const raised = paneCount > 1 || showSidebar || showAgent || !terminalSurface;
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
    const scroller = e.target.closest?.('.agent-messages, .sb-scroll, .pane');
    if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) {
      const atTop = scroller.scrollTop <= 0 && e.deltaY < 0;
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1 && e.deltaY > 0;
      if (!atTop && !atBottom) return;
    }
    e.preventDefault();
    window.scrollBy({ top: e.deltaY, behavior: 'auto' });
  };
  const openPaneMenu = (paneIndex, e) => {
    e.preventDefault();
    const host = e.currentTarget.closest('.con-window');
    const bounds = host.getBoundingClientRect();
    setFocusedPane(paneIndex);
    setContextMenu({
      pane: paneIndex,
      x: Math.max(8, Math.min(e.clientX - bounds.left, bounds.width - 188)),
      y: Math.max(8, Math.min(e.clientY - bounds.top, bounds.height - 168)),
    });
  };
  const splitPane = (dir) => {
    setSplitDir(dir);
    setPaneCount(2);
    setContextMenu(null);
  };
  const closePane = (index) => {
    setContextMenu(null);
    if (paneCount < 2) return;
    if (index === 0) {
      setPaneLogs(current => [current[1], []]);
      setPaneDrafts(current => [current[1], '']);
    }
    setPaneCount(1);
    setFocusedPane(0);
  };
  const clearPane = (index) => {
    setPaneLogs(current => current.map((log, i) => (i === index ? [] : log)));
    setContextMenu(null);
  };
  const toggleDir = (path) => {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  React.useEffect(() => {
    if (!contextMenu) return undefined;
    const onDoc = (e) => {
      if (e.target.closest?.('.pane-menu')) return;
      setContextMenu(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setContextMenu(null); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);
  const splitClass = paneCount > 1 ? (splitDir === 'down' ? ' split split-down' : ' split') : '';
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
              className={`con-tab${t.id === activeTab ? ' active' : ''}${t.icons && t.icons.length > 1 && !t.busy ? ' stacked' : ''}`}
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
              <span className={`tab-icon${t.icons && t.icons.length > 1 && !t.busy ? ' stacked' : ''}`}>
                {t.busy
                  ? <TabSpinner />
                  : t.icons && t.icons.length > 1
                    ? <TabStack icons={t.icons} />
                    : <TabGlyph icon={t.icon || 'terminal'} />}
              </span>
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
          <Sidebar
            slot={sidebarSlot}
            setSlot={setSidebarSlot}
            onClose={() => setShowSidebar(false)}
            expanded={expanded}
            activeFile={activeFile}
            onToggle={toggleDir}
            onOpen={setActiveFile}
            query={searchQuery}
            setQuery={setSearchQuery}
          />
        )}
        <div className="con-main">
          <div className={`pane-grid${terminalSurface ? splitClass : ''}${raised ? ' cards' : ' flush'}`}>
            {terminalSurface ? (
              <>
                <div
                  className={`pane${focusedPane === 0 ? ' focused' : ''}`}
                  onClick={(e) => focusPane(0, e)}
                  onFocus={() => setFocusedPane(0)}
                  onContextMenu={(e) => openPaneMenu(0, e)}
                  onKeyDown={(e) => handlePaneKeyDown(0, e)}
                  onPaste={(e) => handlePanePaste(0, e)}
                  tabIndex={0}
                  role="textbox"
                  aria-label="Terminal pane 1"
                  aria-multiline="true"
                >
                  {paneCount > 1 && <PaneHead title="harbor" />}
                  <TerminalStreamLiveA entries={paneLogs[0]} draft={paneDrafts[0]} focused={focusedPane === 0} />
                </div>
                {paneCount > 1 && (
                  <div
                    className={`pane${focusedPane === 1 ? ' focused' : ''}`}
                    onClick={(e) => focusPane(1, e)}
                    onFocus={() => setFocusedPane(1)}
                    onContextMenu={(e) => openPaneMenu(1, e)}
                    onKeyDown={(e) => handlePaneKeyDown(1, e)}
                    onPaste={(e) => handlePanePaste(1, e)}
                    tabIndex={0}
                    role="textbox"
                    aria-label="Terminal pane 2"
                    aria-multiline="true"
                  >
                    <PaneHead title="Draft the release note | harbor" icon="codex" />
                    <CodexSurface scene="release" />
                  </div>
                )}
              </>
            ) : (
              <div className="pane focused" tabIndex={0}>
                {activeSurface.icon === 'monitor' ? <HtopSurface /> : activeSurface.icon === 'codex' ? <CodexSurface scene="upgrade" /> : <CliSurface kind={activeSurface.icon} title={activeSurface.title} />}
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
            onClear={() => setAgentMessages([])}
          />
        )}
      </div>
      {contextMenu && (
        <div className="pane-menu" style={{ left: contextMenu.x, top: contextMenu.y }} role="menu">
          <button type="button" onClick={() => { setShowAgent(true); setContextMenu(null); }}>Ask AI</button>
          <button type="button" onClick={() => clearPane(contextMenu.pane)}>Clear Terminal</button>
          <div className="pane-menu-rule" />
          <button type="button" onClick={() => splitPane('right')}>Split Right</button>
          <button type="button" onClick={() => splitPane('down')}>Split Down</button>
          <button type="button" onClick={() => closePane(contextMenu.pane)} disabled={paneCount < 2}>Close Pane</button>
        </div>
      )}
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
    ...canned.map(line => ({ type: line.dim ? 'dim' : 'output', text: line.text, tone: line.tone, parts: line.parts })),
  ];
};

const shellOutputFor = (text) => {
  if (text === 'pwd') return [{ text: '/Users/weyl/dev/con' }];
  if (text === 'ls') return [{ text: 'Cargo.toml  crates  docs  assets  README.md  CHANGELOG.md' }];
  if (text.startsWith('git status')) return [
    { text: '## main...origin/main', dim: true },
    { parts: [{ text: ' M ', tone: 'mod' }, { text: 'crates/con-app/src/workspace/frame.rs' }] },
    { parts: [{ text: ' M ', tone: 'mod' }, { text: 'crates/con-app/src/agent_panel.rs' }] },
    { parts: [{ text: '?? ', tone: 'add' }, { text: 'docs/quick-controls.md' }] },
  ];
  if (text.startsWith('git diff')) return [
    { text: 'diff --git a/crates/con-app/src/workspace/frame.rs', dim: true },
    { text: '@@ -12,6 +12,7 @@ pub struct PaneSurround', tone: 'hunk' },
    { text: '-const CARD_GAP: f32 = 4.0;', tone: 'del' },
    { text: '+const CARD_GAP: f32 = 5.0;', tone: 'add' },
    { text: '+const PANE_RADIUS: f32 = 8.0;', tone: 'add' },
  ];
  if (text.startsWith('git pull')) return [
    { text: 'Updating 7573d2b0..7df735de', dim: true },
    { text: 'Fast-forward', dim: true },
    { text: ' crates/con-app/src/agent_panel.rs | 18 +++++++++', tone: 'add' },
    { text: ' docs/quick-controls.md            |  6 +++---', tone: 'mod' },
    { text: ' 2 files changed, 21 insertions(+), 3 deletions(-)' },
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
const PaneHead = ({ title, icon }) => (
  <div className="pane-head">
    <span className="pane-id">
      {icon === 'codex'
        ? <CodexMark />
        : <img src="/assets/tab-terminal-refined.png" alt="" width="12" height="12" />}
    </span>
    <span className="pane-title">{title}</span>
    <span className="pane-head-actions">
      <button type="button" className="pane-act" title="Zoom pane" aria-label="Zoom pane">
        <CornersGlyph />
      </button>
      <button type="button" className="pane-act" title="Close pane" aria-label="Close pane">
        <PaneCloseGlyph />
      </button>
    </span>
  </div>
);

const TabGlyph = ({ icon }) => {
  if (icon === 'claude') return <ClaudeMark />;
  if (icon === 'codex') return <CodexMark />;
  const src = icon === 'monitor'
    ? '/assets/tab-monitor.png'
    : icon === 'code'
      ? '/assets/tab-code.png'
      : '/assets/tab-terminal-refined.png';
  return <img src={src} alt="" width="16" height="16" />;
};

const TabStack = ({ icons }) => (
  <span className="id-stack">
    {icons.map((icon, index) => (
      <span className={`id-card${index === 0 ? ' front' : ' back'}`} key={`${icon}-${index}`}>
        <TabGlyph icon={icon} />
      </span>
    ))}
  </span>
);

const TabSpinner = () => (
  <span className="tab-spinner" aria-label="Working">
    <i /><i /><i />
  </span>
);

const ClaudeMark = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path fill="currentColor" d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z" />
  </svg>
);

const CodexMark = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path fill="currentColor" d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 0 0-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 0 1 .476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 0 1 4.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 0 1-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 0 0 5.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0 0 10.205 0a5.947 5.947 0 0 0-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 0 0 4.162 1.713z" />
  </svg>
);

const HTOP_LEFT = [[98.2, 14], [91.4, 11], [86.0, 9], [72.5, 7], [44.2, 4], [28.6, 3], [12.4, 1], [6.1, 0]];
const HTOP_RIGHT = [[81.3, 10], [63.0, 6], [22.8, 2], [11.5, 1], [5.2, 0], [2.4, 0], [1.1, 0], [0.4, 0]];
const HTOP_ROWS = [
  ['41220', 'dev', '20', '0', '8124M', '842M', 'R', '186.4', '1.3', '0:18.22', 'cargo test -p api --quiet'],
  ['41288', 'dev', '20', '0', '6402M', '1104M', 'R', '142.1', '1.7', '0:11.04', 'rustc --crate-name harbor_api'],
  ['41804', 'dev', '20', '0', '2488M', '186M', 'S', '6.4', '0.3', '0:08.11', 'target/debug/harbor'],
  ['55102', 'dev', '20', '0', '1932M', '412M', 'S', '4.8', '0.6', '1:02.40', 'codex'],
  ['22011', 'dev', '20', '0', '1820M', '96M', 'S', '1.2', '0.1', '4:14.02', 'node vite'],
  ['902', 'dev', '17', '0', '96M', '28M', 'S', '0.8', '0.0', '12:03.11', 'con'],
  ['331', 'root', '20', '0', '612M', '84M', 'S', '0.6', '0.1', '6:41:02', 'WindowServer'],
  ['1', 'root', '20', '0', '240M', '14M', 'S', '0.4', '0.0', '18:12:44', 'kernel_task'],
  ['640', 'dev', '20', '0', '210M', '36M', 'S', '0.2', '0.0', '2:18.55', 'mds_stores'],
  ['88', 'dev', '20', '0', '18M', '4096K', 'S', '0.1', '0.0', '0:01.04', 'zsh'],
  ['1204', 'dev', '20', '0', '84M', '12M', 'S', '0.0', '0.0', '0:00.31', 'git'],
  ['77', 'root', '20', '0', '42M', '8192K', 'S', '0.0', '0.0', '1:04:18', 'logd'],
  ['204', 'dev', '20', '0', '156M', '22M', 'S', '0.0', '0.0', '0:44.02', 'coreaudiod'],
  ['3188', 'dev', '20', '0', '64M', '9M', 'S', '0.0', '0.0', '0:02.16', 'rg'],
  ['4410', 'dev', '20', '0', '980M', '140M', 'S', '0.0', '0.2', '8:22.10', 'Cursor'],
  ['512', 'root', '20', '0', '48M', '6M', 'S', '0.0', '0.0', '3:11:40', 'launchd'],
  ['880', 'dev', '20', '0', '320M', '54M', 'S', '0.0', '0.1', '0:19.44', 'node'],
  ['2290', 'dev', '20', '0', '72M', '11M', 'S', '0.0', '0.0', '0:00.08', 'zsh'],
  ['1602', 'dev', '20', '0', '188M', '27M', 'S', '0.0', '0.0', '1:02:33', 'distnoted'],
  ['2744', 'dev', '20', '0', '54M', '7M', 'S', '0.0', '0.0', '0:00.02', 'sleep'],
];
const Meter = ({ pct, sys = 0 }) => (
  <span className="ht-meter" aria-hidden="true">
    <span className="ht-used" style={{ width: `${Math.min(pct, 100)}%` }} />
    {sys > 0 && <span className="ht-sys" style={{ left: `${Math.max(pct - sys, 0)}%`, width: `${Math.min(sys, pct)}%` }} />}
  </span>
);
const HtopSurface = () => (
  <div className="tui htop">
    <div className="ht-top">
      <div className="ht-cpus">
        <div>
          {HTOP_LEFT.map(([pct, sys], index) => <CpuMeter key={index} n={index} pct={pct} sys={sys} />)}
        </div>
        <div>
          {HTOP_RIGHT.map(([pct, sys], index) => <CpuMeter key={index} n={index + 8} pct={pct} sys={sys} />)}
        </div>
      </div>
      <div className="ht-mem">
        <div className="ht-mems">
          <div className="ht-memline"><span className="ht-k">Mem[</span><Meter pct={38.4} /><span>24.6G/64G]</span></div>
          <div className="ht-memline"><span className="ht-k">Swp[</span><Meter pct={5} /><span>0.2G/4.0G]</span></div>
        </div>
        <div className="ht-load">
          <div>Tasks: 214, 980 thr; <span className="ht-g">6 running</span></div>
          <div>Load average: <span className="ht-g">9.40</span> 6.12 3.85</div>
          <div>Uptime: 6 days, 04:12:09</div>
        </div>
      </div>
    </div>
    <div className="ht-table">
      <div className="ht-row ht-head">
        <span>PID</span><span>USER</span><span>PRI</span><span>NI</span><span>VIRT</span><span>RES</span><span>S</span><span>CPU%</span><span>MEM%</span><span>TIME+</span><span>Command</span>
      </div>
      {HTOP_ROWS.map((row, index) => (
        <div className={`ht-row${index === 0 ? ' on' : ''}`} key={row[0]}>
          {row.map((cell, cellIndex) => <span key={cellIndex}>{cell}</span>)}
        </div>
      ))}
    </div>
    <div className="ht-foot">
      {[['F1', 'Help'], ['F2', 'Setup'], ['F3', 'Search'], ['F4', 'Filter'], ['F5', 'Tree'], ['F6', 'SortBy'], ['F7', 'Nice-'], ['F8', 'Nice+'], ['F9', 'Kill'], ['F10', 'Quit']].map(([key, label]) => (
        <span key={key}><b>{key}</b>{label}</span>
      ))}
    </div>
  </div>
);
const CpuMeter = ({ n, pct, sys }) => (
  <div className="ht-cpu">
    <span className="ht-id">{n}</span>
    <Meter pct={pct} sys={sys} />
    <span className="ht-pct">{pct.toFixed(1)}%</span>
  </div>
);

const CodexSurface = ({ scene = 'release' }) => {
  const story = CODEX_SCENES[scene] || CODEX_SCENES.release;
  const [seconds, setSeconds] = React.useState(story.started);
  React.useEffect(() => {
    setSeconds(story.started);
    const id = setInterval(() => setSeconds(value => (value >= 28 ? story.started : value + 1)), 1000);
    return () => clearInterval(id);
  }, [story.started]);
  return (
    <div className="tui codex">
      <div className="cx-banner">
        <div className="cx-title"><span className="cx-mark">&gt;_</span> OpenAI Codex <span className="cx-ver">(v0.164.0)</span></div>
        <div className="cx-cwd">{SHELL_PATH}</div>
      </div>
      <div className="cx-thread">
        <div className="cx-user"><span className="cx-gt">&gt;</span><span>{story.prompt}</span></div>
        <div className="cx-work">
          <div className="cx-status"><span className="cx-pulse" aria-hidden="true" />Working ({seconds}s · <b>esc</b> to interrupt)</div>
          <div className="cx-task"><span className="cx-elbow">└</span>{story.task}</div>
        </div>
      </div>
      <div className="cx-composer">
        <span className="cx-gt">&gt;</span>
        <span className="cx-caret" />
        <span className="cx-ph">Ask Codex to do anything</span>
      </div>
      <div className="cx-foot">
        <div><span className="cx-model">GPT-5.4 medium</span> <span className="cx-dir">· {SHELL_PATH}</span></div>
        <div className="cx-keys">
          <span>← for agents · ? for shortcuts</span>
          <span className="cx-meta"><span className="cx-warn">▲</span> 18% · f2</span>
        </div>
      </div>
    </div>
  );
};

const CliSurface = ({ title }) => (
  <pre className="ts">
    <PromptLines command={title} />
    <div className="tl-line dim"><span>changed 2 packages in 2s</span></div>
    <PromptLines focused />
  </pre>
);

const PromptLines = ({ command, draft, focused }) => (
  <>
    <div className="tl-line prompt-meta">
      <span className="tl-path">{SHELL_PATH}</span>
      <span className="tl-branch">main</span>
    </div>
    <div className="tl-line">
      <span className="tl-gt">❯</span>
      {command ? <span className="tl-cmd">{command}</span> : null}
      {draft ? <span className="tl-cmd">{draft}</span> : null}
      {focused ? <CursorBlink /> : null}
    </div>
  </>
);

const PromptBlock = ({ draft, focused }) => (
  <PromptLines draft={draft} focused={focused} />
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
        <PromptLines key={i} command={entry.text} />
      ) : entry.type === 'gap' ? (
        <div key={i} className="tl-line"><span> </span></div>
      ) : (
        <Line key={i} dim={entry.type === 'dim'} tone={entry.tone} parts={entry.parts}>{entry.text}</Line>
      )
    ))}
  </>
);

const Line = ({ dim, tone, parts, children }) => (
  <div className={`tl-line${dim ? ' dim' : ''}${tone ? ` tone-${tone}` : ''}`}>
    <span>
      {parts
        ? parts.map((part, index) => (
          <span key={index} className={part.tone ? `tone-${part.tone}` : ''}>{part.text}</span>
        ))
        : children}
    </span>
  </div>
);
const CursorBlink = () => <span className="tl-cursor" />;

// --------- agent side panel ----------
const AgentPanel = ({ showOwnInput, messages, onSubmit, onClear }) => {
  const [draft, setDraft] = React.useState('');
  const [providerId, setProviderId] = React.useState('kimi');
  const [modelName, setModelName] = React.useState('kimi-k3.1-pro');
  const [autoApprove, setAutoApprove] = React.useState(false);
  const [picker, setPicker] = React.useState(null);
  const messagesRef = React.useRef(null);
  const provider = PROVIDERS.find(item => item.id === providerId) || PROVIDERS[0];
  React.useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages.length]);
  React.useEffect(() => {
    if (!picker) return undefined;
    const onDoc = (e) => {
      if (e.target.closest?.('.agent-menu, .agent-provider, .agent-model, .icon-btn')) return;
      setPicker(null);
    };
    const onKey = (e) => { if (e.key === 'Escape') setPicker(null); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [picker]);
  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSubmit(text);
    setDraft('');
  };
  const chooseProvider = (next) => {
    setProviderId(next.id);
    setModelName(next.models[0]);
    setPicker(null);
  };
  return (
    <aside className={`agent${showOwnInput ? ' with-own-input' : ''}`}>
      <div className="agent-head">
        <div className="agent-pickers">
          <button
            type="button"
            className="agent-provider"
            title={`Provider: ${provider.label}`}
            aria-label={`Provider: ${provider.label}`}
            onClick={() => setPicker(current => current === 'provider' ? null : 'provider')}
          >
            <img src={provider.icon} alt="" width="14" height="14" />
          </button>
          <button
            type="button"
            className="agent-model"
            title={`Model: ${modelName}`}
            onClick={() => setPicker(current => current === 'model' ? null : 'model')}
          >
            <span>{modelName}</span>
            <CaretGlyph />
          </button>
        </div>
        <div className="agent-head-right">
          <button
            type="button"
            className={`icon-btn${autoApprove ? ' on' : ''}`}
            title={autoApprove ? 'Auto-approve on' : 'Auto-approve off'}
            aria-pressed={autoApprove}
            onClick={() => setAutoApprove(value => !value)}
          >
            <FastForwardGlyph />
          </button>
          <button
            type="button"
            className={`icon-btn${picker === 'history' ? ' on' : ''}`}
            title="History"
            aria-label="Conversation history"
            onClick={() => setPicker(current => current === 'history' ? null : 'history')}
          >
            <HistoryGlyph />
          </button>
          <button type="button" className="icon-btn" title="New conversation" aria-label="New conversation" onClick={() => { onClear(); setPicker(null); }}>
            <PlusGlyph />
          </button>
        </div>
      </div>
      {picker === 'provider' && (
        <div className="agent-menu" role="menu">
          {PROVIDERS.map(item => (
            <button type="button" key={item.id} className={`menu-item${item.id === providerId ? ' on' : ''}`} onClick={() => chooseProvider(item)}>
              <img src={item.icon} alt="" width="14" height="14" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
      {picker === 'model' && (
        <div className="agent-menu model" role="menu">
          {provider.models.map(name => (
            <button type="button" key={name} className={`menu-item${name === modelName ? ' on' : ''}`} onClick={() => { setModelName(name); setPicker(null); }}>
              <span>{name}</span>
            </button>
          ))}
        </div>
      )}
      {picker === 'history' && (
        <div className="agent-menu history" role="menu">
          <div className="menu-label">History</div>
          {messages.length === 0 ? (
            <div className="menu-empty">No earlier conversations</div>
          ) : (
            <button type="button" className="menu-item on" onClick={() => setPicker(null)}>
              <span>This workspace</span>
            </button>
          )}
        </div>
      )}

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
const CornersGlyph = () => (
  <svg viewBox="0 0 256 256" width="12" height="12" aria-hidden="true">
    <path fill="currentColor" d="M216,48V88a8,8,0,0,1-16,0V56H168a8,8,0,0,1,0-16h40A8,8,0,0,1,216,48ZM88,200H56V168a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H88a8,8,0,0,0,0-16Zm120-40a8,8,0,0,0-8,8v32H168a8,8,0,0,0,0,16h40a8,8,0,0,0,8-8V168A8,8,0,0,0,208,160ZM88,40H48a8,8,0,0,0-8,8V88a8,8,0,0,0,16,0V56H88a8,8,0,0,0,0-16Z" />
  </svg>
);
const PaneCloseGlyph = () => (
  <svg viewBox="0 0 256 256" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" aria-hidden="true">
    <line x1="200" y1="56" x2="56" y2="200" />
    <line x1="200" y1="200" x2="56" y2="56" />
  </svg>
);
const CloseGlyph = () => (
  <svg viewBox="0 0 256 256" width="9" height="9" aria-hidden="true">
    <path fill="currentColor" d="M202.83,197.17a4,4,0,0,1-5.66,5.66L128,133.66,58.83,202.83a4,4,0,0,1-5.66-5.66L122.34,128,53.17,58.83a4,4,0,0,1,5.66-5.66L128,122.34l69.17-69.17a4,4,0,1,1,5.66,5.66L133.66,128Z"/>
  </svg>
);
const HistoryGlyph = () => (
  <svg viewBox="0 0 256 256" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="128 80 128 128 168 152" />
    <polyline points="72 104 32 104 32 64" />
    <path d="M67.6,192A88,88,0,1,0,65.77,65.77C54,77.69,44.28,88.93,32,104" />
  </svg>
);
const FastForwardGlyph = () => (
  <svg viewBox="0 0 256 256" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M40,71.85v112.3a7.91,7.91,0,0,0,12.18,6.59l88.19-56.15a7.8,7.8,0,0,0,0-13.18L52.18,65.26A7.91,7.91,0,0,0,40,71.85Z" />
    <path d="M144,71.85v112.3a7.91,7.91,0,0,0,12.18,6.59l88.19-56.15a7.8,7.8,0,0,0,0-13.18L156.18,65.26A7.91,7.91,0,0,0,144,71.85Z" />
  </svg>
);
const CaretGlyph = () => (
  <svg viewBox="0 0 256 256" width="10" height="10" fill="currentColor" aria-hidden="true">
    <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
  </svg>
);
const SearchGlyph = () => (
  <svg viewBox="0 0 256 256" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" aria-hidden="true">
    <circle cx="112" cy="112" r="80" />
    <line x1="168.57" y1="168.57" x2="224" y2="224" />
  </svg>
);
const FolderGlyph = ({ open }) => (
  <svg viewBox="0 0 256 256" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {open ? (
      <>
        <path d="M32,208V64a8,8,0,0,1,8-8H93.33a8,8,0,0,1,4.8,1.6L128,80h72a8,8,0,0,1,8,8v24" />
        <path d="M32,208l30.18-90.53A8,8,0,0,1,69.77,112H232a8,8,0,0,1,7.59,10.53L211.09,208Z" />
      </>
    ) : (
      <>
        <path d="M216.89,208H39.38A7.4,7.4,0,0,1,32,200.62V80H216a8,8,0,0,1,8,8V200.89A7.11,7.11,0,0,1,216.89,208Z" />
        <path d="M32,80V56a8,8,0,0,1,8-8H92.69a8,8,0,0,1,5.65,2.34L128,80" />
      </>
    )}
  </svg>
);
const TreeCaret = ({ open, hidden }) => (
  <svg className={`tree-caret${hidden ? ' hidden' : ''}`} viewBox="0 0 256 256" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {open
      ? <polyline points="48 96 128 176 208 96" />
      : <polyline points="96 48 176 128 96 208" />}
  </svg>
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

const Sidebar = ({ slot, setSlot, onClose, expanded, activeFile, onToggle, onOpen, query, setQuery }) => (
  <aside className="con-sidebar" aria-label={slot === 'files' ? 'Files' : 'Search'}>
    <div className="sb-bar">
      <div className="sb-slots">
        <button type="button" className={`sb-slot${slot === 'files' ? ' on' : ''}`} onClick={() => setSlot('files')}>
          <FolderGlyph />
          <span>Files</span>
        </button>
        <button type="button" className={`sb-slot${slot === 'search' ? ' on' : ''}`} onClick={() => setSlot('search')}>
          <SearchGlyph />
          <span>Search</span>
        </button>
      </div>
      <button type="button" className="sb-close" aria-label="Close sidebar" onClick={onClose}>
        <CloseGlyph />
      </button>
    </div>
    {slot === 'files' ? (
      <div className="sb-scroll">
        <FileRows nodes={FILE_TREE} parent="" depth={0} expanded={expanded} activeFile={activeFile} onToggle={onToggle} onOpen={onOpen} />
      </div>
    ) : (
      <SearchPanel query={query} setQuery={setQuery} onOpen={onOpen} />
    )}
  </aside>
);

const FileRows = ({ nodes, parent, depth, expanded, activeFile, onToggle, onOpen }) => (
  nodes.map(node => {
    const path = parent ? `${parent}/${node.name}` : node.name;
    const isDir = node.kind === 'dir';
    const open = expanded.has(path);
    return (
      <React.Fragment key={path}>
        <button
          type="button"
          className={`file-row${activeFile === path ? ' on' : ''}`}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => (isDir ? onToggle(path) : onOpen(path))}
        >
          <TreeCaret open={open} hidden={!isDir} />
          <span className={`file-ic kind-${node.kind}`}>
            {isDir ? <FolderGlyph open={open} /> : <FileGlyph />}
          </span>
          <span className="file-name">{node.name}</span>
        </button>
        {isDir && open && node.children?.length > 0 && (
          <FileRows nodes={node.children} parent={path} depth={depth + 1} expanded={expanded} activeFile={activeFile} onToggle={onToggle} onOpen={onOpen} />
        )}
      </React.Fragment>
    );
  })
);

const SearchPanel = ({ query, setQuery, onOpen }) => {
  const needle = query.trim().toLowerCase();
  const hits = needle
    ? SEARCH_INDEX.filter(item => item.text.toLowerCase().includes(needle) || item.file.toLowerCase().includes(needle))
    : [];
  const groups = [];
  hits.forEach(hit => {
    const group = groups.find(item => item.file === hit.file);
    if (group) group.hits.push(hit);
    else groups.push({ file: hit.file, hits: [hit] });
  });
  return (
    <div className="sb-search">
      <label className="sb-query">
        <SearchGlyph />
        <input
          value={query}
          placeholder="Search"
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search workspace"
        />
      </label>
      <div className="sb-scroll">
        {!needle && <p className="sb-empty">Search files in this workspace.</p>}
        {needle && groups.length === 0 && <p className="sb-empty">No results</p>}
        {groups.map(group => (
          <div key={group.file} className="sr-group">
            <button type="button" className="sr-file" onClick={() => onOpen(group.file)}>
              <FileGlyph />
              <span>{group.file.split('/').pop()}</span>
              <span className="sr-count">{group.hits.length}</span>
            </button>
            {group.hits.map(hit => (
              <button type="button" key={`${hit.file}:${hit.line}`} className="sr-hit" onClick={() => onOpen(hit.file)}>
                <span className="sr-ln">{hit.line}</span>
                <span className="sr-text">{highlightMatch(hit.text, needle)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const highlightMatch = (text, needle) => {
  const index = text.toLowerCase().indexOf(needle);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
};

window.TerminalDemo = TerminalDemo;
