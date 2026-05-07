(() => {
  const root = document.querySelector('[data-docs-ask]');
  const input = document.querySelector('[data-docs-ask-input]');
  const form = document.querySelector('[data-docs-ask-form]');
  const messagesEl = document.querySelector('[data-docs-ask-messages]');
  const statusEl = document.querySelector('[data-docs-ask-status]');
  const activityEl = document.querySelector('[data-docs-ask-activity]');
  const submit = document.querySelector('[data-docs-ask-submit]');
  const openers = Array.from(document.querySelectorAll('[data-docs-ask-open]'));
  const closers = Array.from(document.querySelectorAll('[data-docs-ask-close]'));
  const suggestions = Array.from(document.querySelectorAll('[data-docs-ask-suggestion]'));

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
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  }

  function renderMarkdown(value) {
    const lines = String(value || '').replace(/\r\n/g, '\n').split('\n');
    const blocks = [];
    let list = null;
    let code = null;

    function closeList() {
      if (!list) return;
      blocks.push(`<${list.type}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</${list.type}>`);
      list = null;
    }

    function closeCode() {
      if (!code) return;
      blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      code = null;
    }

    for (const raw of lines) {
      const line = raw.replace(/\s+$/, '');
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        if (code) closeCode();
        else {
          closeList();
          code = [];
        }
        continue;
      }
      if (code) {
        code.push(line);
        continue;
      }
      if (!trimmed) {
        closeList();
        continue;
      }

      const heading = trimmed.match(/^(#{2,4})\s+(.+)$/);
      if (heading) {
        closeList();
        const level = Math.min(heading[1].length + 1, 5);
        blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
        continue;
      }

      const unordered = trimmed.match(/^[-*]\s+(.+)$/);
      if (unordered) {
        if (!list || list.type !== 'ul') {
          closeList();
          list = { type: 'ul', items: [] };
        }
        list.items.push(unordered[1]);
        continue;
      }

      const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
      if (ordered) {
        if (!list || list.type !== 'ol') {
          closeList();
          list = { type: 'ol', items: [] };
        }
        list.items.push(ordered[1]);
        continue;
      }

      if (trimmed.startsWith('>')) {
        closeList();
        blocks.push(`<blockquote>${inlineMarkdown(trimmed.replace(/^>\s?/, ''))}</blockquote>`);
        continue;
      }

      closeList();
      blocks.push(`<p>${inlineMarkdown(trimmed)}</p>`);
    }

    closeCode();
    closeList();
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

  function renderSteps(steps) {
    if (!steps?.length) return '';
    return `
      <div class="docs-ask-steps" aria-label="Ask AI progress">
        ${steps.slice(-5).map((step) => `
          <div>
            <span>${escapeHtml(step.label || 'Checking docs')}</span>
            ${step.detail ? `<em>${escapeHtml(step.detail)}</em>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function emptyState() {
    return `
      <div class="docs-ask-empty">
        <strong>What do you want to do in con?</strong>
        <span>Ask a practical question, or start with one of these.</span>
        <div class="docs-ask-prompts" aria-label="Example questions">
          <button type="button" data-docs-ask-suggestion="How do I set up DeepSeek?">Set up DeepSeek</button>
          <button type="button" data-docs-ask-suggestion="What changed in the latest beta?">Latest beta</button>
          <button type="button" data-docs-ask-suggestion="How does the agent panel work?">Agent panel</button>
        </div>
      </div>
    `;
  }

  function renderMessages() {
    if (!messages.length) {
      messagesEl.innerHTML = emptyState();
      bindSuggestions(messagesEl);
      return;
    }

    messagesEl.innerHTML = messages.map((message) => `
      <article class="docs-ask-message ${message.role}${message.pending ? ' pending' : ''}">
        <div class="docs-ask-message-role">${message.role === 'user' ? 'You' : 'con docs'}</div>
        ${message.content ? `<div class="docs-ask-message-body">${renderMarkdown(message.content)}</div>` : ''}
        ${message.pending ? renderSteps(message.steps) : ''}
        ${message.role === 'assistant' ? renderSources(message.sources) : ''}
      </article>
    `).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setBusy(next, label = '') {
    busy = next;
    input.disabled = next;
    if (submit) submit.disabled = next;
    if (activityEl) activityEl.hidden = !next;
    if (statusEl) statusEl.textContent = label || (next ? 'Checking docs' : 'Ready');
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

  function setPendingStep(pending, step) {
    pending.steps = [...(pending.steps || []), step];
    setBusy(true, step.label || 'Checking docs');
    renderMessages();
  }

  function parseSseBlock(block) {
    const lines = block.split('\n');
    let event = 'message';
    const data = [];
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (!data.length) return { event, payload: {} };
    try {
      return { event, payload: JSON.parse(data.join('\n')) };
    } catch {
      return { event, payload: {} };
    }
  }

  async function consumeStream(response, pending) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        const { event, payload } = parseSseBlock(block);
        if (event === 'status') {
          setPendingStep(pending, { label: payload.label || 'Checking docs' });
        } else if (event === 'tool') {
          setPendingStep(pending, { label: payload.label || 'Reading source', detail: payload.detail || '' });
        } else if (event === 'token') {
          pending.content += payload.text || '';
          renderMessages();
        } else if (event === 'final') {
          pending.sources = payload.sources || [];
          pending.pending = false;
          renderMessages();
        } else if (event === 'error') {
          throw new Error(payload.error || 'Ask AI request failed');
        }
      }
    }
  }

  async function ask(question) {
    messages.push({ role: 'user', content: question });
    const pending = { role: 'assistant', content: '', pending: true, steps: [], sources: [] };
    messages.push(pending);
    renderMessages();
    setBusy(true, 'Checking docs');

    try {
      const response = await fetch('/api/docs-ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          stream: true,
          location: location.href,
          messages: messages
            .filter((message) => message.role === 'user' || (message.role === 'assistant' && message.content))
            .slice(-8)
            .map((message) => ({
              role: message.role,
              content: message.content,
            })),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = response.status === 503
          ? 'Ask AI is not configured yet.'
          : (data.error || `Ask AI failed (${response.status})`);
        throw new Error(message);
      }

      const type = response.headers.get('content-type') || '';
      if (type.includes('text/event-stream') && response.body) {
        await consumeStream(response, pending);
      } else {
        const data = await response.json();
        pending.content = data.answer || 'I could not find enough evidence in the docs to answer.';
        pending.sources = data.sources || [];
        pending.pending = false;
        renderMessages();
      }
      setBusy(false);
    } catch (error) {
      pending.pending = false;
      pending.content = `I could not answer right now: ${error.message || 'request failed'}`;
      pending.sources = [];
      setBusy(false, 'Request failed');
      renderMessages();
    }
  }

  function submitQuestion(question) {
    if (busy) return;
    const clean = String(question || '').trim();
    if (!clean) return;
    input.value = '';
    ask(clean);
  }

  function bindSuggestions(scope = document) {
    for (const button of Array.from(scope.querySelectorAll('[data-docs-ask-suggestion]'))) {
      button.addEventListener('click', () => submitQuestion(button.dataset.docsAskSuggestion));
    }
  }

  for (const opener of openers) opener.addEventListener('click', openAsk);
  for (const closer of closers) closer.addEventListener('click', closeAsk);
  bindSuggestions();

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitQuestion(input.value);
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

  if (new URLSearchParams(location.search).has('ask')) {
    openAsk();
  }
})();
