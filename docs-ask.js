(() => {
  const root = document.querySelector('[data-docs-ask]');
  const input = document.querySelector('[data-docs-ask-input]');
  const form = document.querySelector('[data-docs-ask-form]');
  const messagesEl = document.querySelector('[data-docs-ask-messages]');
  const statusEl = document.querySelector('[data-docs-ask-status]');
  const submit = document.querySelector('[data-docs-ask-submit]');
  const openers = Array.from(document.querySelectorAll('[data-docs-ask-open]'));
  const closers = Array.from(document.querySelectorAll('[data-docs-ask-close]'));

  if (!root || !input || !form || !messagesEl) return;

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const shortcut = isMac ? '⌘/' : 'Ctrl /';
  let messages = [];
  let lastFocus = null;
  let busy = false;

  for (const opener of openers) {
    const kbd = opener.querySelector('kbd');
    if (kbd) kbd.textContent = shortcut;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  }

  function renderMarkdown(value) {
    const lines = String(value || '').split(/\n+/);
    const blocks = [];
    let list = [];

    function flushList() {
      if (!list.length) return;
      blocks.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`);
      list = [];
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        flushList();
        continue;
      }
      const bullet = trimmed.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        list.push(bullet[1]);
        continue;
      }
      flushList();
      blocks.push(`<p>${inlineMarkdown(trimmed)}</p>`);
    }
    flushList();
    return blocks.join('');
  }

  function renderSources(sources) {
    if (!sources?.length) return '';
    return `
      <div class="docs-ask-sources">
        <span>Sources</span>
        ${sources.map((source) => `
          <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title || source.path || source.url)}</a>
        `).join('')}
      </div>
    `;
  }

  function renderTools(tools) {
    if (!tools?.length) return '';
    const names = tools.map((tool) => tool.name).filter(Boolean);
    const unique = [...new Set(names)];
    if (!unique.length) return '';
    return `<div class="docs-ask-tools">Used ${unique.map(escapeHtml).join(', ')}</div>`;
  }

  function renderMessages() {
    if (!messages.length) {
      messagesEl.innerHTML = `
        <div class="docs-ask-empty">
          <strong>Ask about install, providers, shortcuts, agent behavior, releases, or con-cli.</strong>
          <span>The agent can search and read the generated docs corpus before it answers.</span>
        </div>
      `;
      return;
    }

    messagesEl.innerHTML = messages.map((message) => `
      <article class="docs-ask-message ${message.role}">
        <div class="docs-ask-message-role">${message.role === 'user' ? 'You' : 'con docs'}</div>
        <div class="docs-ask-message-body">${renderMarkdown(message.content)}</div>
        ${message.role === 'assistant' ? renderTools(message.tools) : ''}
        ${message.role === 'assistant' ? renderSources(message.sources) : ''}
      </article>
    `).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setBusy(next, label = '') {
    busy = next;
    input.disabled = next;
    if (submit) submit.disabled = next;
    if (statusEl) statusEl.textContent = label || 'Uses docs tools, not embeddings.';
  }

  function openAsk() {
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add('docs-ask-open');
    renderMessages();
    requestAnimationFrame(() => input.focus());
  }

  function closeAsk() {
    root.hidden = true;
    document.documentElement.classList.remove('docs-ask-open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  async function ask(question) {
    messages.push({ role: 'user', content: question });
    renderMessages();
    setBusy(true, 'Searching docs...');

    try {
      const response = await fetch('/api/docs-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          location: location.href,
          messages: messages.slice(-8).map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Ask AI failed (${response.status})`);
      messages.push({
        role: 'assistant',
        content: data.answer || 'I could not find enough evidence in the docs to answer.',
        sources: data.sources || [],
        tools: data.tools || [],
      });
      setBusy(false);
    } catch (error) {
      messages.push({
        role: 'assistant',
        content: `I could not answer right now: ${error.message || 'request failed'}`,
        sources: [],
        tools: [],
      });
      setBusy(false, 'Request failed.');
    }
    renderMessages();
  }

  for (const opener of openers) opener.addEventListener('click', openAsk);
  for (const closer of closers) closer.addEventListener('click', closeAsk);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) return;
    const question = input.value.trim();
    if (!question) return;
    input.value = '';
    ask(question);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  document.addEventListener('keydown', (event) => {
    const wantsAsk = (isMac ? event.metaKey : event.ctrlKey) && event.key === '/';
    if (wantsAsk) {
      event.preventDefault();
      if (root.hidden) openAsk();
      else closeAsk();
      return;
    }
    if (!root.hidden && event.key === 'Escape') {
      event.preventDefault();
      closeAsk();
    }
  });
})();
