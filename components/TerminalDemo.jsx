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
  { name: 'harbor', kind: 'dir', children: [
    { name: 'src', kind: 'dir', children: [
      { name: 'rollout.rs', kind: 'rust' },
      { name: 'health.rs', kind: 'rust' },
    ] },
    { name: 'api', kind: 'dir', children: [
      { name: 'main.rs', kind: 'rust' },
    ] },
    { name: 'docs', kind: 'dir', children: [
      { name: 'release-1.3.md', kind: 'md' },
      { name: 'release-1.4.md', kind: 'md' },
      { name: 'upgrade.md', kind: 'md' },
    ] },
  ] },
];
const SEARCH_INDEX = [
  { file: 'harbor/src/rollout.rs', line: 11, text: 'Hold the canary when p95 crosses the ceiling.' },
  { file: 'harbor/docs/release-1.4.md', line: 1, text: 'The window holds the work and the agents doing it.' },
  { file: 'harbor/docs/upgrade.md', line: 1, text: 'From 1.3, the notes move into their own panes.' },
];
const PROVIDERS = [
  { id: 'kimi', label: 'Kimi', icon: '/assets/provider-icons/kimi-color.svg', models: ['kimi-k3.1-pro', 'kimi-k2.5'] },
  { id: 'claude', label: 'Claude', icon: '/assets/provider-icons/claude-color.svg', models: ['claude-sonnet-4.5', 'claude-opus-4.1'] },
  { id: 'openai', label: 'OpenAI', icon: '/assets/provider-icons/openai.svg', models: ['gpt-5', 'gpt-5-mini'] },
  { id: 'gemini', label: 'Gemini', icon: '/assets/provider-icons/gemini-color.svg', models: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
];
const SHELL_PATH = '~/dev/harbor';
const WATCH_LOG = [
  { type: 'prompt', text: "cargo watch -x 'test -p harbor rollout --quiet'" },
  { type: 'gap' },
  { type: 'output', text: 'Finished `test` profile in 1.84s', tone: 'add' },
  { type: 'output', text: 'running 4 tests' },
  { type: 'output', text: 'test rollout::holds_when_the_tail_slows ... ok', tone: 'add' },
  { type: 'output', text: 'test rollout::promotes_on_a_quiet_window ... ok', tone: 'add' },
  { type: 'output', text: 'test result: ok. 4 passed; 0 failed; 0 ignored', tone: 'add' },
];
const ORCHESTRA = [
  { kind: 'user', body: 'Ship the 1.4 notes. Codex drafts them, Claude keeps the voice of the 1.3 note, and OpenCode writes the upgrade path. Watch all three.' },
  { kind: 'tool-watch' },
  { kind: 'assistant', body: <>The canary rule in <code>src/rollout.rs</code> now holds when p95 crosses the ceiling. Codex is drafting the note to match that behavior. Claude has both notes open and is comparing the voice. OpenCode is still listing <code>migrations/</code>, so the upgrade page is not written yet.</> },
  { kind: 'assistant', body: <>Claude flagged one line that still sounds like a changelog. I left that with Codex. OpenCode has the migration list and is writing the 1.3 to 1.4 steps.</> },
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
const iconsForTab = (tab, focusByTab) => {
  const focus = focusByTab[tab.id] ?? 0;
  if (tab.layout === 'harbor') return focus === 0 ? ['terminal', 'file'] : ['file', 'terminal'];
  if (tab.layout === 'fleet') return focus === 2 ? ['monitor', 'terminal'] : ['terminal', 'monitor'];
  return tab.icons || null;
};

const prefersCompactDemo = () => (
  typeof window !== 'undefined' && window.matchMedia('(max-width: 560px)').matches
);
const prefersPhoneDemo = () => (
  typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches
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
  const [paneCount, setPaneCount] = React.useState(2);
  const [splitDir, setSplitDir] = React.useState('right');
  const [sidebarSlot, setSidebarSlot] = React.useState('files');
  const [expanded, setExpanded] = React.useState(() => new Set(['harbor', 'harbor/src', 'harbor/docs']));
  const [activeFile, setActiveFile] = React.useState('harbor/src/rollout.rs');
  const [editorDoc, setEditorDoc] = React.useState('rust');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [contextMenu, setContextMenu] = React.useState(null);
  const [scope, setScope] = React.useState('all');
  const [focusedPane, setFocusedPane] = React.useState(0);
  const [focusByTab, setFocusByTab] = React.useState({ harbor: 0, monitor: 2 });
  const [scopeOpen, setScopeOpen] = React.useState(false);
  const [command, setCommand] = React.useState('');
  const [paneLogs, setPaneLogs] = React.useState([WATCH_LOG, [], []]);
  const [paneDrafts, setPaneDrafts] = React.useState(['', '', '']);
  const [threads, setThreads] = React.useState({ release: ORCHESTRA });
  const [tabs, setTabs] = React.useState([
    { id: 'harbor', title: 'Harbor', icon: 'terminal', layout: 'harbor' },
    { id: 'release', title: 'Release', icon: 'codex', icons: ['codex', 'claude', 'opencode'], layout: 'agents' },
    { id: 'monitor', title: 'Monitor', icon: 'monitor', layout: 'fleet' },
  ]);
  const [activeTab, setActiveTab] = React.useState('harbor');
  const [tabLayout, setTabLayout] = React.useState('quiet');
  const quiet = tabLayout === 'quiet';
  const verticalTabs = tabLayout === 'vertical' || tabLayout === 'compact';
  const compactTabs = tabLayout === 'compact';
  const chooseLayout = (id) => {
    if (prefersPhoneDemo() && (id === 'vertical' || id === 'compact')) return;
    setTabLayout(id);
    if (id === 'quiet') {
      setShowSidebar(false);
      setShowAgent(false);
      setShowBottom(false);
      return;
    }
    setShowBottom(true);
    if (prefersCompactDemo()) return;
    setShowAgent(activeTab === 'release');
    setShowSidebar(activeTab === 'harbor');
  };
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const snap = () => {
      if (!mq.matches) return;
      setTabLayout((cur) => (cur === 'vertical' || cur === 'compact' ? 'quiet' : cur));
    };
    snap();
    mq.addEventListener('change', snap);
    return () => mq.removeEventListener('change', snap);
  }, []);
  const selectTab = (id) => {
    setActiveTab(id);
    if (prefersCompactDemo()) return;
    setShowAgent(id === 'release');
    setShowSidebar(id === 'harbor');
  };
  const openWorkspaceFile = (path) => {
    setActiveFile(path);
    if (path.endsWith('rollout.rs')) setEditorDoc('rust');
    else if (path.endsWith('upgrade.md')) setEditorDoc('upgrade');
    else if (path.endsWith('.md')) setEditorDoc('note');
  };

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
    setTabs(current => [...current, { id, ...preset, layout: 'shell' }]);
    selectTab(id);
  };
  const closeTab = (id) => {
    if (tabs.length < 2) return;
    const next = tabs.filter(tab => tab.id !== id);
    setTabs(next);
    if (activeTab === id) selectTab(next[0].id);
  };
  const activeSurface = tabs.find(tab => tab.id === activeTab) || tabs[0];
  const terminalSurface = activeSurface.icon === 'terminal';
  const showBroadcast = mode !== 'agent' && paneCount > 1 && terminalSurface && activeSurface.layout !== 'harbor';
  const raised = !quiet && (paneCount > 1 || showSidebar || showAgent || !terminalSurface);
  const appendToPanes = (paneIndexes, lines) => {
    setPaneLogs(current => current.map((log, i) => (
      paneIndexes.includes(i) ? [...log, ...lines] : log
    )));
  };
  const agentMessages = threads[activeTab] || [];
  const appendAgentExchange = (text, source = 'agent') => {
    const reply = buildAgentReply(text, source);
    setThreads(current => ({
      ...current,
      [activeTab]: [...(current[activeTab] || []), { kind: 'user', body: text }, { kind: 'assistant', body: reply }],
    }));
  };
  const runShellCommand = (raw) => {
    const text = raw.trim();
    if (!text) return;
    const targets = activeSurface.layout === 'harbor'
      ? [0]
      : paneCount > 1 && scope === 'all'
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
    setFocusByTab(current => ({ ...current, [activeTab]: paneIndex }));
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
  const openTool = (slot) => {
    if (showSidebar && sidebarSlot === slot) setShowSidebar(false);
    else {
      setSidebarSlot(slot);
      setShowSidebar(true);
    }
  };
  return (
    <div className="demo-stage">
    <div className="layout-switch" role="radiogroup" aria-label="Tab layout">
      <div className="layout-tray">
        {[
          ['quiet', 'Single pane', <QuietLayoutGlyph key="q" />, false],
          ['horizontal', 'Horizontal tabs', <HorizontalLayoutGlyph key="h" />, false],
          ['vertical', 'Vertical tabs', <VerticalLayoutGlyph key="v" />, true],
          ['compact', 'Compact tabs', <CompactLayoutGlyph key="c" />, true],
        ].map(([id, label, glyph, desk]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={tabLayout === id}
            title={label}
            aria-label={label}
            className={`${tabLayout === id ? 'on' : ''}${desk ? ' desk' : ''}`}
            onClick={() => chooseLayout(id)}
          >
            {glyph}
          </button>
        ))}
      </div>
    </div>
    <div className={`con-window${verticalTabs ? ' vtabs' : ''}`} onWheelCapture={passWheelToPage}>
      {/* Title bar */}
      <div className="con-titlebar">
        <div className="traffic" aria-hidden="true">
          <span className="tl tl-close" />
          <span className="tl tl-min" />
          <span className="tl tl-max" />
        </div>
        {quiet || verticalTabs ? <div className="titlebar-spacer" /> : (
        <div className="con-tabs" role="tablist" aria-label="Terminal tabs">
          {tabs.map(t => {
            const icons = iconsForTab(t, focusByTab);
            const stacked = icons && icons.length > 1 && !t.busy;
            const stack3 = icons && icons.length > 2;
            return (
            <div
              key={t.id}
              className={`con-tab${t.id === activeTab ? ' active' : ''}${stacked ? ' stacked' : ''}${stack3 ? ' stack-3' : ''}`}
              role="tab"
              aria-selected={t.id === activeTab}
              tabIndex={0}
              onClick={() => selectTab(t.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectTab(t.id);
                }
              }}
            >
              <span className={`tab-icon${stacked ? ' stacked' : ''}${stack3 ? ' stack-3' : ''}`}>
                {t.busy
                  ? <TabSpinner />
                  : stacked
                    ? <TabStack icons={icons} />
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
            );
          })}
        </div>
        )}
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
      <div className={`con-body${showAgent ? '' : ' no-agent'}${showSidebar ? ' with-sidebar' : ''}${quiet ? ' quiet' : ''}${verticalTabs ? ' vtabs' : ''}${compactTabs ? ' vtabs-compact' : ''}${raised ? ' raised' : ''}`}>
        {verticalTabs && (
          <TabRail
            tabs={tabs}
            activeTab={activeTab}
            focusByTab={focusByTab}
            compact={compactTabs}
            filesOn={showSidebar && sidebarSlot === 'files'}
            searchOn={showSidebar && sidebarSlot === 'search'}
            onLayout={() => setTabLayout(compactTabs ? 'vertical' : 'compact')}
            onTool={openTool}
            onNew={addTab}
            onSelect={selectTab}
            onClose={closeTab}
          />
        )}
        {showSidebar && (
          <Sidebar
            slot={sidebarSlot}
            setSlot={setSidebarSlot}
            onClose={() => setShowSidebar(false)}
            expanded={expanded}
            activeFile={activeFile}
            onToggle={toggleDir}
            onOpen={openWorkspaceFile}
            query={searchQuery}
            setQuery={setSearchQuery}
          />
        )}
        <div className="con-main">
          {quiet ? (
            <div className="quiet-shell">
              <pre className="ts quiet-term"><PromptBlock draft="" focused /></pre>
            </div>
          ) : (
          <div className={`pane-grid${activeSurface.layout === 'harbor' ? ' harbor' : activeSurface.layout === 'fleet' ? ' fleet' : activeSurface.layout === 'agents' ? ' cols-3' : terminalSurface ? splitClass : ''}${raised ? ' cards' : ' flush'}`}>
            {activeSurface.layout === 'harbor' ? (
              <HarborWorkspace
                doc={editorDoc}
                entries={paneLogs[0]}
                draft={paneDrafts[0]}
                shellFocused={focusedPane === 0}
                editorFocused={focusedPane === 1}
                onShellFocus={(e) => focusPane(0, e)}
                onEditorFocus={(e) => focusPane(1, e)}
                onContextMenu={(e) => openPaneMenu(0, e)}
                onKeyDown={(e) => handlePaneKeyDown(0, e)}
                onPaste={(e) => handlePanePaste(0, e)}
              />
            ) : activeSurface.layout === 'agents' ? (
              <AgentWorkspace />
            ) : activeSurface.layout === 'fleet' ? (
              <FleetWorkspace
                focused={focusedPane === 2}
                onFocus={(e) => focusPane(2, e)}
              />
            ) : terminalSurface ? (
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
                    <PaneHead title="shell" />
                    <TerminalStreamLiveB entries={paneLogs[1] || []} draft={paneDrafts[1] || ''} focused={focusedPane === 1} />
                  </div>
                )}
              </>
            ) : (
              <div className="pane focused" tabIndex={0}>
                {activeSurface.icon === 'monitor' ? <HtopSurface /> : <CliSurface kind={activeSurface.icon} title={activeSurface.title} />}
              </div>
            )}
          </div>
          )}

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
            onClear={() => setThreads(current => ({ ...current, [activeTab]: [] }))}
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
    </div>
  );
};

const QuietLayoutGlyph = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
    <rect x="1.5" y="3" width="13" height="10" rx="2" fill="currentColor" />
  </svg>
);
const HorizontalLayoutGlyph = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
    <rect x="1" y="4.5" width="4.2" height="7" rx="1.4" fill="currentColor" />
    <rect x="5.9" y="4.5" width="4.2" height="7" rx="1.4" fill="currentColor" />
    <rect x="10.8" y="4.5" width="4.2" height="7" rx="1.4" fill="currentColor" />
  </svg>
);
const VerticalLayoutGlyph = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
    <rect x="1" y="1.5" width="3.2" height="3.2" rx="0.8" fill="currentColor" />
    <rect x="5.4" y="2.2" width="9.2" height="1.8" rx="0.9" fill="currentColor" />
    <rect x="1" y="6.4" width="3.2" height="3.2" rx="0.8" fill="currentColor" />
    <rect x="5.4" y="7.1" width="9.2" height="1.8" rx="0.9" fill="currentColor" />
    <rect x="1" y="11.3" width="3.2" height="3.2" rx="0.8" fill="currentColor" />
    <rect x="5.4" y="12" width="6.4" height="1.8" rx="0.9" fill="currentColor" />
  </svg>
);
const CompactLayoutGlyph = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
    <rect x="5" y="1" width="6" height="3.6" rx="1.1" fill="currentColor" />
    <rect x="5" y="6.2" width="6" height="3.6" rx="1.1" fill="currentColor" />
    <rect x="5" y="11.4" width="6" height="3.6" rx="1.1" fill="currentColor" />
  </svg>
);
const CaretRailGlyph = ({ expand }) => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path
      d={expand ? 'M6 3.2 L10.2 8 L6 12.8' : 'M10 3.2 L5.8 8 L10 12.8'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const TabRail = ({ tabs, activeTab, focusByTab, compact, filesOn, searchOn, onLayout, onTool, onNew, onSelect, onClose }) => (
  <aside className={`vtab-rail${compact ? ' compact' : ''}`} aria-label="Tabs">
    <div className="vtab-tools">
      <button type="button" className="vtab-tool" title={compact ? 'Expand tabs' : 'Compact tabs'} aria-label={compact ? 'Expand tabs' : 'Compact tabs'} onClick={onLayout}>
        <CaretRailGlyph expand={compact} />
      </button>
      <span className="vtab-div" />
      <button type="button" className={`vtab-tool${filesOn ? ' on' : ''}`} title="Files" aria-label="Files" aria-pressed={filesOn} onClick={() => onTool('files')}>
        <FolderGlyph />
      </button>
      <button type="button" className={`vtab-tool${searchOn ? ' on' : ''}`} title="Search" aria-label="Search" aria-pressed={searchOn} onClick={() => onTool('search')}>
        <SearchGlyph />
      </button>
      <span className="vtab-div" />
      <button type="button" className="vtab-tool" title="New tab" aria-label="New tab" onClick={onNew}>
        <PlusGlyph />
      </button>
    </div>
    <div className="vtab-list" role="tablist">
      {tabs.map(tab => {
        const icons = iconsForTab(tab, focusByTab);
        const stacked = icons && icons.length > 1 && !tab.busy;
        return (
          <div
            key={tab.id}
            className={`vtab-row${tab.id === activeTab ? ' on' : ''}`}
            role="tab"
            aria-selected={tab.id === activeTab}
            tabIndex={0}
            onClick={() => onSelect(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(tab.id);
              }
            }}
          >
            <span className="vtab-hit" aria-hidden="true" />
            <span className="vtab-brand">
              {tab.busy ? <TabSpinner /> : stacked ? <TabStack icons={icons} /> : <TabGlyph icon={tab.icon || 'terminal'} />}
            </span>
            {!compact && <span className="vtab-name">{tab.title}</span>}
            {!compact && (
              <button type="button" className="vtab-x" aria-label={`Close ${tab.title}`} onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}>
                <CloseGlyph />
              </button>
            )}
          </div>
        );
      })}
    </div>
  </aside>
);

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
      {icon === 'codex' ? <CodexMark />
        : icon === 'claude' ? <ClaudeMark />
        : icon === 'opencode' ? <OpenCodeMark />
        : icon === 'monitor' ? <img src="/assets/tab-monitor.png" alt="" width="12" height="12" />
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
  if (icon === 'opencode') return <OpenCodeMark />;
  const src = icon === 'monitor'
    ? '/assets/tab-monitor.png'
    : icon === 'code'
      ? '/assets/tab-code.png'
      : icon === 'file'
        ? '/assets/tab-file.png'
        : '/assets/tab-terminal-refined.png';
  return <img src={src} alt="" width="16" height="16" />;
};

const TabStack = ({ icons }) => {
  const shown = icons.slice(0, 3);
  const size = 16;
  const step = Math.round(size * 0.22);
  const width = size + 2 + step * (shown.length - 1);
  const height = size + 2;
  return (
    <span className="id-stack" style={{ width, height }}>
      {shown.map((icon, index) => {
        const card = size + (index === 0 ? 2 : 0);
        return (
          <span
            className={`id-card${index === 0 ? ' front' : ' back'}${index !== 0 && ['terminal', 'file', 'monitor', 'code'].includes(icon) ? ' bitmap' : ''}`}
            key={`${icon}-${index}`}
            style={{ left: index === 0 ? 0 : step * index + 2, top: (height - card) / 2, width: card, height: card, zIndex: shown.length - index }}
          >
            <TabGlyph icon={icon} />
          </span>
        );
      })}
    </span>
  );
};

const TabSpinner = () => (
  <span className="tab-spinner" aria-label="Working">
    <i /><i /><i />
  </span>
);

const OpenCodeMark = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path fill="currentColor" fillRule="evenodd" d="M2.4 0h19.2v24H2.4zm4.8 4.8h9.6v14.4H7.2z" />
    <path fill="currentColor" d="M7.2 9.6h9.6v9.6H7.2z" opacity="0.5" />
  </svg>
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

const HTOP_LEFT = [[46.2, 4], [31.8, 3], [18.4, 2], [12.6, 1], [8.1, 1], [4.4, 0], [2.1, 0], [0.8, 0]];
const HTOP_RIGHT = [[22.4, 2], [14.0, 1], [9.2, 1], [5.5, 0], [3.1, 0], [1.4, 0], [0.6, 0], [0.2, 0]];
const HTOP_ROWS = [
  ['41804', 'dev', '20', '0', '2488M', '186M', 'S', '6.4', '0.3', '14:08:11', 'harbor-api --canary 1.4'],
  ['41880', 'dev', '20', '0', '612M', '84M', 'S', '2.8', '0.1', '14:08:11', 'rollout'],
  ['41902', 'dev', '20', '0', '248M', '42M', 'S', '1.1', '0.1', '6:22:40', 'probe --regions 3'],
  ['902', 'dev', '17', '0', '96M', '28M', 'S', '0.8', '0.0', '12:03:11', 'con'],
  ['331', 'root', '20', '0', '612M', '84M', 'S', '0.6', '0.1', '6:41:02', 'WindowServer'],
  ['1', 'root', '20', '0', '240M', '14M', 'S', '0.4', '0.0', '18:12:44', 'kernel_task'],
  ['640', 'dev', '20', '0', '210M', '36M', 'S', '0.2', '0.0', '2:18:55', 'mds_stores'],
  ['77', 'root', '20', '0', '42M', '8192K', 'S', '0.1', '0.0', '1:04:18', 'logd'],
  ['88', 'dev', '20', '0', '18M', '4096K', 'S', '0.1', '0.0', '0:01:04', 'zsh'],
  ['512', 'root', '20', '0', '48M', '6M', 'S', '0.0', '0.0', '3:11:40', 'launchd'],
  ['1204', 'dev', '20', '0', '84M', '12M', 'S', '0.0', '0.0', '0:00:31', 'git'],
  ['204', 'dev', '20', '0', '156M', '22M', 'S', '0.0', '0.0', '0:44:02', 'coreaudiod'],
  ['3188', 'dev', '20', '0', '64M', '9M', 'S', '0.0', '0.0', '0:02:16', 'rg'],
  ['1602', 'dev', '20', '0', '188M', '27M', 'S', '0.0', '0.0', '1:02:33', 'distnoted'],
  ['2290', 'dev', '20', '0', '72M', '11M', 'S', '0.0', '0.0', '0:00:08', 'zsh'],
  ['2744', 'dev', '20', '0', '54M', '7M', 'S', '0.0', '0.0', '0:00:02', 'sleep'],
  ['880', 'dev', '20', '0', '320M', '54M', 'S', '0.0', '0.1', '0:19:44', 'node'],
  ['4410', 'dev', '20', '0', '980M', '140M', 'S', '0.0', '0.2', '8:22:10', 'ssh'],
  ['1501', 'root', '20', '0', '36M', '5M', 'S', '0.0', '0.0', '4:02:18', 'syslogd'],
  ['2660', 'dev', '20', '0', '128M', '18M', 'S', '0.0', '0.0', '0:12:44', 'distnoted'],
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
          <div className="ht-memline"><span className="ht-k">Mem[</span><Meter pct={28.8} /><span>18.4G/64G]</span></div>
          <div className="ht-memline"><span className="ht-k">Swp[</span><Meter pct={5} /><span>0.2G/4.0G]</span></div>
        </div>
        <div className="ht-load">
          <div>Tasks: 186, 640 thr; <span className="ht-g">2 running</span></div>
          <div>Load average: <span className="ht-g">1.84</span> 1.52 1.21</div>
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

const RUST_DOC = [
  { n: 1, parts: [{ c: 'kw', s: 'fn ' }, { c: 'fn', s: 'advance' }, { c: 'punct', s: '(canary: &' }, { c: 'ty', s: 'Canary' }, { c: 'punct', s: ', health: &' }, { c: 'ty', s: 'Health' }, { c: 'punct', s: ') -> ' }, { c: 'ty', s: 'Step' }, { c: 'punct', s: ' {' }] },
  { n: 2, parts: [{ c: 'kw', s: '    if ' }, { c: 'text', s: 'health.errors > canary.budget {' }] },
  { n: 3, parts: [{ c: 'kw', s: '        return ' }, { c: 'ty', s: 'Step' }, { c: 'punct', s: '::' }, { c: 'ty', s: 'Hold' }, { c: 'punct', s: ';' }] },
  { n: 4, parts: [{ c: 'punct', s: '    }' }] },
  { n: 5, added: true, cursor: 44, parts: [{ c: 'kw', s: '    if ' }, { c: 'text', s: 'health.p95_ms > canary.ceiling_ms' }, { c: 'caret' }, { c: 'text', s: ' {' }] },
  { n: 6, added: true, parts: [{ c: 'kw', s: '        return ' }, { c: 'ty', s: 'Step' }, { c: 'punct', s: '::' }, { c: 'ty', s: 'Hold' }, { c: 'punct', s: ';' }] },
  { n: 7, parts: [{ c: 'punct', s: '    }' }] },
  { n: 8, parts: [{ c: 'ty', s: '    Step' }, { c: 'punct', s: '::' }, { c: 'ty', s: 'Promote' }, { c: 'punct', s: ' { weight: canary.weight + ' }, { c: 'num', s: '15' }, { c: 'punct', s: ' }' }] },
  { n: 9, parts: [{ c: 'punct', s: '}' }] },
];
const NOTE_SOURCE = [
  { n: 1, cursor: 1, parts: [{ c: 'title', s: '# Harbor 1.4' }] },
  { n: 2, parts: [{ c: 'text', s: '' }] },
  { n: 3, parts: [{ c: 'text', s: 'The window holds the work and the agents doing it.' }] },
  { n: 4, parts: [{ c: 'text', s: '' }] },
  { n: 5, parts: [{ c: 'text', s: 'Codex drafts the note. Claude checks the voice.' }] },
];
const UPGRADE_SOURCE = [
  { n: 1, cursor: 1, parts: [{ c: 'title', s: '# From 1.3' }] },
  { n: 2, parts: [{ c: 'text', s: '' }] },
  { n: 3, parts: [{ c: 'text', s: 'The 1.3 note stays where it was.' }] },
  { n: 4, parts: [{ c: 'text', s: 'The 1.4 note is the one still being finished.' }] },
];
const EDITOR_DOCS = {
  rust: { name: 'rollout.rs', path: 'src/rollout.rs', lines: RUST_DOC },
  note: { name: 'release-1.4.md', path: 'docs/release-1.4.md', lines: NOTE_SOURCE },
  upgrade: { name: 'upgrade.md', path: 'docs/upgrade.md', lines: UPGRADE_SOURCE },
};

const EyeGlyph = () => (
  <svg viewBox="0 0 256 256" width="12" height="12" aria-hidden="true">
    <path fill="currentColor" d="M247.31,124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57,61.26,162.88,48,128,48S61.43,61.26,36.34,86.35C17.51,105.18,9,124,8.69,124.76a8,8,0,0,0,0,6.5c.35.79,8.82,19.57,27.65,38.4C61.43,194.74,93.12,208,128,208s66.57-13.26,91.66-38.34c18.83-18.83,27.3-37.61,27.65-38.4A8,8,0,0,0,247.31,124.76ZM128,192c-30.78,0-57.67-11.19-79.93-33.25A133.47,133.47,0,0,1,25,128,133.33,133.33,0,0,1,48.07,97.25C70.33,75.19,97.22,64,128,64s57.67,11.19,79.93,33.25A133.46,133.46,0,0,1,231.05,128C223.84,141.46,192.43,192,128,192Zm0-112a48,48,0,1,0,48,48A48.05,48.05,0,0,0,128,80Zm0,80a32,32,0,1,1,32-32A32,32,0,0,1,128,160Z"/>
  </svg>
);
const CodeGlyph = () => (
  <svg viewBox="0 0 256 256" width="12" height="12" aria-hidden="true">
    <path fill="currentColor" d="M69.12,94.15,28.5,128l40.62,33.85a8,8,0,1,1-10.24,12.29l-48-40a8,8,0,0,1,0-12.29l48-40a8,8,0,0,1,10.24,12.3Zm176,27.7-48-40a8,8,0,1,0-10.24,12.3L227.5,128l-40.62,33.85a8,8,0,1,0,10.24,12.29l48-40a8,8,0,0,0,0-12.29ZM162.73,32.48a8,8,0,0,0-10.25,4.79l-64,176a8,8,0,0,0,4.79,10.26A8.14,8.14,0,0,0,96,224a8,8,0,0,0,7.52-5.27l64-176A8,8,0,0,0,162.73,32.48Z"/>
  </svg>
);

const EditorPane = ({ doc, focused, onFocus }) => {
  const file = EDITOR_DOCS[doc] || EDITOR_DOCS.rust;
  const markdown = doc !== 'rust';
  const [preview, setPreview] = React.useState(markdown);
  React.useEffect(() => { setPreview(doc !== 'rust'); }, [doc]);
  const cursorLine = file.lines.find(line => line.cursor) || file.lines[0];
  return (
    <div className={`pane editor${focused ? ' focused' : ''}`} onClick={onFocus}>
      <div className="ed-bar">
        <div className="ed-tab">
          <FileGlyph />
          <span>{file.name}</span>
          <span className="ed-x" aria-hidden="true"><CloseGlyph /></span>
        </div>
        {markdown && (
          <button
            type="button"
            className="pane-act ed-mode"
            title={preview ? 'Edit Markdown' : 'Preview Markdown'}
            aria-label={preview ? 'Edit Markdown' : 'Preview Markdown'}
            onClick={(e) => { e.stopPropagation(); setPreview(value => !value); }}
          >
            {preview ? <CodeGlyph /> : <EyeGlyph />}
          </button>
        )}
        <span className="pane-head-actions">
          <button type="button" className="pane-act" title="Zoom pane" aria-label="Zoom pane"><CornersGlyph /></button>
          <button type="button" className="pane-act" title="Close pane" aria-label="Close pane"><PaneCloseGlyph /></button>
        </span>
      </div>
      {markdown && preview ? (
        <div className="ed-read">
          {doc === 'upgrade' ? (
            <>
              <div className="ed-kicker">Upgrade</div>
              <div className="ed-h">From 1.3</div>
              <p>The 1.3 note stays where it was. The 1.4 note is the one the agents are still finishing.</p>
            </>
          ) : (
            <>
              <div className="ed-kicker">Release</div>
              <div className="ed-h">Harbor 1.4</div>
              <p>The window holds the work and the agents doing it.</p>
              <p>Codex drafts the note. Claude checks it against the 1.3 voice. OpenCode writes the way up from 1.3.</p>
            </>
          )}
        </div>
      ) : (
        <div className="ed-body">
          {file.lines.map(line => (
            <div className={`ed-line${line.added ? ' added' : ''}${line.cursor ? ' here' : ''}`} key={line.n}>
              <span className="ed-ln">{line.n}</span>
              <span className="ed-code">
                {line.parts.map((part, index) => (
                  part.c === 'caret' ? <span className="ed-caret" key={index} /> : <span className={`ed-${part.c}`} key={index}>{part.s}</span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="ed-status">
        <span>{file.path}</span>
        <span>Ln {cursorLine.n}, Col {cursorLine.cursor || 1}</span>
      </div>
    </div>
  );
};

const RUNTIME_LOG = [
  ['10:41:02', 'hold', 'p95 64ms', 'weight 10%'],
  ['10:41:18', 'quiet', 'p95 41ms', 'window open'],
  ['10:41:36', 'promote', '10% → 25%', 'ceiling clear'],
];

const HarborWorkspace = ({ doc, entries, draft, shellFocused, editorFocused, onShellFocus, onEditorFocus, onContextMenu, onKeyDown, onPaste }) => (
  <>
    <div
      className={`pane${shellFocused ? ' focused' : ''}`}
      onClick={onShellFocus}
      onContextMenu={onContextMenu}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      tabIndex={0}
      role="textbox"
      aria-label="Test pane"
      aria-multiline="true"
    >
      <PaneHead title="watch" />
      <pre className="ts devlog">
        <TerminalEntries entries={entries} />
        <PromptBlock draft={draft} focused={shellFocused} />
      </pre>
    </div>
    <EditorPane doc={doc} focused={editorFocused} onFocus={onEditorFocus} />
    <div className="pane span-rows">
      <PaneHead title="rollout" />
      <pre className="ts devlog">
        <div className="tl-line dim"><span>harbor-rollout  applying src/rollout.rs</span></div>
        <div className="tl-line"><span> </span></div>
        {RUNTIME_LOG.map(row => (
          <div className="tl-line" key={row[0]}>
            <span className="dim">{row[0]}</span>
            <span className={row[1] === 'hold' ? 'tone-mod' : row[1] === 'promote' ? 'tone-add' : 'tone-quiet'}>{row[1]}</span>
            <span>{row[2]}</span>
            <span className="dim">{row[3]}</span>
          </div>
        ))}
        <div className="tl-line"><CursorBlink /></div>
      </pre>
    </div>
  </>
);

const PROBES = [
  ['us-east', '38ms', '0.02%', 'ok'],
  ['eu-west', '44ms', '0.04%', 'ok'],
  ['ap-south', '51ms', '0.03%', 'ok'],
];
const JOURNAL = [
  ['10:41:02', 'hold', 'p95 64ms above 60ms'],
  ['10:41:18', 'quiet', 'p95 41ms, window open'],
  ['10:41:36', 'promote', 'us-east 10% → 25%'],
  ['10:42:01', 'quiet', 'errors inside budget'],
];

const FleetWorkspace = ({ focused, onFocus }) => (
  <>
    <div className="pane">
      <PaneHead title="probe" />
      <div className="ts board">
        <div className="probe-row head"><span>region</span><span>p95</span><span>err</span><span></span></div>
        {PROBES.map(row => (
          <div className="probe-row" key={row[0]}>
            <span>{row[0]}</span><span>{row[1]}</span><span className="dim">{row[2]}</span><span className="tone-add">{row[3]}</span>
          </div>
        ))}
        <div className="board-note"><span className="tone-quiet">canary 1.4</span><span className="dim">25% of us-east · quiet</span></div>
      </div>
    </div>
    <div className="pane">
      <PaneHead title="journal" />
      <div className="ts board">
        {JOURNAL.map(row => (
          <div className="jr-row" key={row[0]}>
            <span className="dim">{row[0]}</span>
            <span className={row[1] === 'hold' ? 'tone-mod' : row[1] === 'promote' ? 'tone-add' : 'tone-quiet'}>{row[1]}</span>
            <span>{row[2]}</span>
          </div>
        ))}
      </div>
    </div>
    <div className={`pane span-rows${focused ? ' focused' : ''}`} onClick={onFocus}>
      <PaneHead title="fleet" icon="monitor" />
      <HtopSurface />
    </div>
  </>
);

const AgentWorkspace = () => (
  <>
    <div className="pane">
      <PaneHead title="Draft the 1.4 note | harbor" icon="codex" />
      <CodexSurface scene="release" />
    </div>
    <div className="pane focused">
      <PaneHead title="Compare the voice | harbor" icon="claude" />
      <ClaudeSurface />
    </div>
    <div className="pane">
      <PaneHead title="Write the upgrade | harbor" icon="opencode" />
      <OpenCodeSurface />
    </div>
  </>
);

const ClaudeSurface = () => {
  const frames = ['✶', '✻', '✳', '✢'];
  const [frame, setFrame] = React.useState(0);
  const [seconds, setSeconds] = React.useState(8);
  React.useEffect(() => {
    const id = setInterval(() => {
      setFrame(value => (value + 1) % frames.length);
      setSeconds(value => (value >= 24 ? 8 : value + 1));
    }, 1000);
    return () => clearInterval(id);
  }, [frames.length]);
  return (
    <div className="tui claude">
      <div className="cc-thread">
        <div className="cc-user"><span>❯</span><span>Check the 1.4 note against the voice of the 1.3 note.</span></div>
        <div className="cc-tool">Read docs/release-1.3.md</div>
        <div className="cc-out">⎿  42 lines</div>
        <div className="cc-tool">Read docs/release-1.4.md</div>
        <div className="cc-out">⎿  one line still sounds like a changelog</div>
        <div className="cc-spin"><span>{frames[frame]}</span> Comparing… ({seconds}s)</div>
      </div>
      <div className="cc-rule" />
      <div className="cc-prompt"><span>❯</span></div>
      <div className="cc-rule" />
      <div className="cc-status">[Sonnet 4.6] │ harbor git:(main)</div>
      <div className="cc-mode">⏵⏵ accept edits on</div>
    </div>
  );
};

const OpenCodeSurface = () => (
  <div className="tui opencode">
    <div className="oc-word" aria-hidden="true"><span>open</span>code</div>
    <div className="oc-thread">
      <div className="oc-msg">Write the 1.3 → 1.4 upgrade notes.</div>
      <div className="oc-reply">I’ll list migrations/ and draft docs/upgrade.md in the same order as the 1.3 page.</div>
      <div className="oc-tool">Read migrations/001_sessions.sql</div>
      <div className="oc-tool">Read docs/upgrade-1.3.md</div>
    </div>
    <div className="oc-box">
      <div className="oc-ask"><span className="oc-caret" />Ask anything…</div>
      <div className="oc-agent"><b>Build</b> Claude Sonnet 4.5</div>
    </div>
    <div className="oc-hints"><span><b>ctrl+t</b> variants</span><span><b>tab</b> agents</span></div>
    <div className="oc-foot"><span>~/dev/harbor</span><span className="oc-mcp"><i />7 MCP</span></div>
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
  if (message.kind === 'tool-watch') {
    return (
      <div className="tool-card done">
        <div className="tool-head">
          <TerminalGlyph/>
          <span className="tool-name">read_pane</span>
          <span className="tool-arg">Codex · Claude · OpenCode</span>
          <span className="tool-ok">✓</span>
        </div>
      </div>
    );
  }
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
