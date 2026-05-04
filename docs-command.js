(() => {
  const root = document.querySelector('[data-docs-command]');
  const input = document.querySelector('#docs-command-input');
  const resultsEl = document.querySelector('[data-docs-command-results]');
  const openers = Array.from(document.querySelectorAll('[data-docs-command-open]'));
  const closers = Array.from(document.querySelectorAll('[data-docs-command-close]'));

  if (!root || !input || !resultsEl) return;

  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const shortcut = isMac ? '⌘K' : 'Ctrl K';
  let index = [];
  let visibleItems = [];
  let activeIndex = 0;
  let lastFocus = null;

  for (const opener of openers) {
    const kbd = opener.querySelector('kbd');
    if (kbd) kbd.textContent = shortcut;
  }

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9.#+\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadIndex() {
    if (index.length) return;
    try {
      const response = await fetch('/assets/docs-search.json', { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Search index ${response.status}`);
      index = await response.json();
    } catch {
      index = [
        { title: 'Docs', kind: 'Docs', url: '/docs/', description: 'Start with con documentation.', text: 'docs install quick controls agent settings' },
        { title: 'Changelog', kind: 'Changelog', url: '/changelog/', description: 'Read con release history.', text: 'changelog releases beta' },
      ];
    }
  }

  function scoreItem(item, query) {
    if (!query) {
      const priority = { Docs: 8, Changelog: 7, Release: 6, Section: 3 };
      return priority[item.kind] || 1;
    }
    const terms = normalize(query).split(' ').filter(Boolean);
    const title = normalize(item.title);
    const text = normalize(`${item.title} ${item.description} ${item.text}`);
    let score = 0;
    for (const term of terms) {
      if (title === term) score += 20;
      else if (title.startsWith(term)) score += 14;
      else if (title.includes(term)) score += 9;
      if (text.includes(term)) score += 3;
      else return 0;
    }
    return score;
  }

  function renderResults() {
    const query = input.value.trim();
    visibleItems = index
      .map((item) => ({ ...item, score: scoreItem(item, query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 9);
    activeIndex = Math.min(activeIndex, Math.max(visibleItems.length - 1, 0));

    if (!visibleItems.length) {
      resultsEl.innerHTML = `
        <div class="docs-command-empty">
          <strong>No results</strong>
          <span>Try "install", "settings", "DeepSeek", "quick controls", or a release version.</span>
        </div>
      `;
      return;
    }

    resultsEl.innerHTML = visibleItems.map((item, index) => `
      <a class="docs-command-result${index === activeIndex ? ' active' : ''}" role="option" aria-selected="${index === activeIndex ? 'true' : 'false'}" href="${escapeHtml(item.url)}" data-result-index="${index}">
        <span class="docs-command-result-main">
          <strong>${escapeHtml(item.title)}</strong>
          <span>${escapeHtml(item.description || '')}</span>
        </span>
        <em>${escapeHtml(item.kind)}</em>
      </a>
    `).join('');
  }

  async function openCommand() {
    await loadIndex();
    lastFocus = document.activeElement;
    root.hidden = false;
    document.documentElement.classList.add('docs-command-open');
    input.value = '';
    activeIndex = 0;
    renderResults();
    requestAnimationFrame(() => input.focus());
  }

  function closeCommand() {
    root.hidden = true;
    document.documentElement.classList.remove('docs-command-open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function visitActive() {
    const item = visibleItems[activeIndex];
    if (item?.url) window.location.href = item.url;
  }

  for (const opener of openers) opener.addEventListener('click', openCommand);
  for (const closer of closers) closer.addEventListener('click', closeCommand);

  input.addEventListener('input', () => {
    activeIndex = 0;
    renderResults();
  });

  resultsEl.addEventListener('mousemove', (event) => {
    const result = event.target.closest('[data-result-index]');
    if (!result) return;
    activeIndex = Number(result.dataset.resultIndex) || 0;
    renderResults();
  });

  document.addEventListener('keydown', (event) => {
    const wantsCommand = (isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (wantsCommand) {
      event.preventDefault();
      if (root.hidden) openCommand();
      else closeCommand();
      return;
    }
    if (root.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeCommand();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, Math.max(visibleItems.length - 1, 0));
      renderResults();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderResults();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      visitActive();
    }
  });
})();
