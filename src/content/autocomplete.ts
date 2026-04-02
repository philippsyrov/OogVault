/**
 * OogVault Autocomplete — IDE-style suggestions for AI chat inputs.
 * Shows matching past questions as you type, like VS Code autocomplete.
 */

(function (): void {
  'use strict';


  const DEBOUNCE_MS = 300;
  const MIN_QUERY_LENGTH = 10;

  let dropdown: HTMLDivElement | null = null;
  let isVisible = false;
  let selectedIndex = -1;
  let currentResults: SimilarQuestionResult[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let attachedInput: HTMLElement | null = null;
  let isEnabled = true;

  function sendMessage(message: VaultRequest): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response?: Record<string, unknown>) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(response ?? null);
        }
      });
    });
  }

  /* ── Dropdown UI ── */

  function createDropdown(): HTMLDivElement {
    if (dropdown) return dropdown;

    dropdown = document.createElement('div') as HTMLDivElement;
    dropdown.id = 'oogvault-autocomplete';
    dropdown.className = 'oogvault-autocomplete';
    dropdown.setAttribute('role', 'listbox');
    dropdown.innerHTML = `
      <div class="oogvault-ac-header">
        <span class="oogvault-ac-icon"></span>
        <span>You asked this before:</span>
      </div>
      <div class="oogvault-ac-results"></div>
      <div class="oogvault-ac-footer">
        <span><kbd>Tab</kbd> view</span>
        <span><kbd class="oogvault-ac-arrows">&uarr;&darr;</kbd> navigate</span>
        <span><kbd>Esc</kbd> dismiss</span>
      </div>
    `;

    document.body.appendChild(dropdown);
    return dropdown;
  }

  function showDropdown(results: SimilarQuestionResult[], anchorEl: HTMLElement): void {
    if (results.length === 0) {
      hideDropdown();
      return;
    }

    currentResults = results;
    selectedIndex = 0;
    const dd = createDropdown();
    const container = dd.querySelector('.oogvault-ac-results') as HTMLDivElement;

    container.innerHTML = results
      .map(
        (r, i) => `
      <div class="oogvault-ac-item ${i === 0 ? 'oogvault-ac-item--selected' : ''}"
           data-index="${i}" role="option">
        <div class="oogvault-ac-question">→ ${escapeHtml(r.question)}</div>
        ${r.answer ? `<div class="oogvault-ac-answer">${escapeHtml(r.answer.substring(0, 120))}${r.answer.length > 120 ? '...' : ''}</div>` : ''}
        <div class="oogvault-ac-meta">
          <span class="oogvault-ac-platform" data-platform="${r.platform}">${r.platform}</span>
          <span class="oogvault-ac-time">${formatRelativeTime(r.timestamp)}</span>
        </div>
      </div>
    `
      )
      .join('');

    positionDropdown(dd, anchorEl);

    dd.style.display = 'block';
    isVisible = true;

    container.querySelectorAll<HTMLDivElement>('.oogvault-ac-item').forEach((item) => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index ?? '0', 10);
        selectResult(idx);
      });
      item.addEventListener('mouseenter', () => {
        const idx = parseInt(item.dataset.index ?? '0', 10);
        highlightItem(idx);
      });
    });
  }

  function positionDropdown(dd: HTMLDivElement, anchorEl: HTMLElement): void {
    const rect = anchorEl.getBoundingClientRect();
    const dropdownHeight = dd.offsetHeight || 200;

    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceAbove > dropdownHeight || spaceAbove > spaceBelow) {
      dd.style.top = 'auto';
      dd.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    } else {
      dd.style.bottom = 'auto';
      dd.style.top = `${rect.bottom + 8}px`;
    }

    dd.style.left = `${rect.left}px`;
    dd.style.width = `${Math.min(rect.width, 500)}px`;
  }

  function hideDropdown(): void {
    if (dropdown) {
      dropdown.style.display = 'none';
    }
    isVisible = false;
    selectedIndex = -1;
    currentResults = [];
  }

  function highlightItem(index: number): void {
    if (!dropdown) return;
    const items = dropdown.querySelectorAll<HTMLDivElement>('.oogvault-ac-item');
    items.forEach((item, i) => {
      item.classList.toggle('oogvault-ac-item--selected', i === index);
    });
    selectedIndex = index;
  }

  /* ── Result Selection ── */

  async function selectResult(index: number): Promise<void> {
    const result = currentResults[index];
    if (!result) return;

    hideDropdown();

    const response = await sendMessage({
      type: 'GET_CONVERSATION',
      id: result.conversationId,
    });

    if (response?.conversation) {
      showConversationPreview(result, response.conversation as VaultConversation);
    }
  }

  function showConversationPreview(result: SimilarQuestionResult, conversation: VaultConversation): void {
    let preview = document.getElementById('oogvault-preview') as HTMLDivElement | null;
    if (!preview) {
      preview = document.createElement('div') as HTMLDivElement;
      preview.id = 'oogvault-preview';
      preview.className = 'oogvault-preview';
      document.body.appendChild(preview);
    }

    const messages: VaultMessage[] = conversation.messages ?? [];
    const msgHtml = messages
      .slice(0, 10)
      .map(
        (m) => `
      <div class="oogvault-preview-msg oogvault-preview-msg--${m.role}">
        <strong>${m.role === 'user' ? 'You' : 'Assistant'}:</strong>
        <div>${escapeHtml(m.content.trim())}</div>
      </div>
    `
      )
      .join('');

    preview.innerHTML = `
      <div class="oogvault-preview-header">
        <span class="oogvault-preview-title">
          <span class="oogvault-preview-icon"></span>
          ${escapeHtml(conversation.title)}
        </span>
        <button class="oogvault-preview-close" title="Close">&times;</button>
      </div>
      <div class="oogvault-preview-meta">
        ${result.platform} &middot; ${formatRelativeTime(result.timestamp)}
      </div>
      <div class="oogvault-preview-messages">${msgHtml}</div>
      <div class="oogvault-preview-actions">
        <button class="oogvault-preview-btn oogvault-preview-btn--copy">Copy Answer</button>
        <button class="oogvault-preview-btn oogvault-preview-btn--summary">Continue Chat</button>
      </div>
    `;

    preview.style.display = 'block';

    const previewEl = preview;

    (previewEl.querySelector('.oogvault-preview-close') as HTMLButtonElement).addEventListener('click', () => {
      previewEl.style.display = 'none';
    });

    (previewEl.querySelector('.oogvault-preview-btn--copy') as HTMLButtonElement).addEventListener('click', () => {
      const assistantMsgs = messages
        .filter((m) => m.role === 'assistant')
        .map((m) => m.content)
        .join('\n\n');
      navigator.clipboard.writeText(assistantMsgs);
      const copyBtn = previewEl.querySelector('.oogvault-preview-btn--copy') as HTMLButtonElement;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy Answer';
      }, 1500);
    });

    (previewEl.querySelector('.oogvault-preview-btn--summary') as HTMLButtonElement).addEventListener('click', async () => {
      const resp = await sendMessage({
        type: 'GENERATE_SUMMARY',
        conversationId: conversation.id,
      });
      if (resp?.summary) {
        navigator.clipboard.writeText(resp.summary as string);
        const summaryBtn = previewEl.querySelector('.oogvault-preview-btn--summary') as HTMLButtonElement;
        summaryBtn.textContent = 'Summary copied!';
        setTimeout(() => {
          summaryBtn.textContent = 'Continue Chat';
        }, 2000);
      }
    });

    const closeOnEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        previewEl.style.display = 'none';
        document.removeEventListener('keydown', closeOnEsc);
      }
    };
    document.addEventListener('keydown', closeOnEsc);
  }

  /* ── Input Monitoring ── */

  function getInputText(el: HTMLElement): string {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return (el as HTMLTextAreaElement | HTMLInputElement).value;
    }
    return el.textContent ?? el.innerText ?? '';
  }

  function onInputChange(e: Event): void {
    if (!isEnabled) return;

    const target = e.target as HTMLElement;
    const text = getInputText(target);

    if (text.length < MIN_QUERY_LENGTH) {
      hideDropdown();
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      const response = await sendMessage({
        type: 'SEARCH_SIMILAR',
        query: text,
        limit: 5,
      });

      if (response?.results && (response.results as SimilarQuestionResult[]).length > 0) {
        showDropdown(response.results as SimilarQuestionResult[], target);
      } else {
        hideDropdown();
      }
    }, DEBOUNCE_MS);
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (!isVisible) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        highlightItem(Math.min(selectedIndex + 1, currentResults.length - 1));
        break;

      case 'ArrowUp':
        e.preventDefault();
        highlightItem(Math.max(selectedIndex - 1, 0));
        break;

      case 'Tab':
        if (currentResults.length > 0 && selectedIndex >= 0) {
          e.preventDefault();
          selectResult(selectedIndex);
        }
        break;

      case 'Escape':
        e.preventDefault();
        hideDropdown();
        break;
    }
  }

  /* ── Public API ── */

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastPolledText = '';
  let inputFinder: (() => HTMLElement | null) | null = null;
  let currentPlatform = '';
  let lastBoundElement: HTMLElement | null = null;

  function bindListeners(el: HTMLElement): void {
    if (el === lastBoundElement) return;
    lastBoundElement = el;

    el.addEventListener('input', onInputChange, { capture: true });
    el.addEventListener('keydown', onKeyDown as EventListener, { capture: true });
    el.addEventListener('keyup', (e: Event) => {
      const ke = e as KeyboardEvent;
      if (!['ArrowDown', 'ArrowUp', 'Tab', 'Escape'].includes(ke.key)) {
        onInputChange(e);
      }
    }, { capture: true });
  }

  function attach(inputElement: HTMLElement, platform: string, findInputFn?: () => HTMLElement | null): void {
    console.log(`[OogVault] Autocomplete attached to ${platform} input`);
    attachedInput = inputElement;
    currentPlatform = platform;
    inputFinder = findInputFn ?? null;

    bindListeners(inputElement);

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (!isEnabled) return;

      const el: HTMLElement | null = inputFinder ? inputFinder() : attachedInput;
      if (!el) return;

      if (el !== attachedInput) {
        console.log(`[OogVault] AC: input element replaced, re-binding (${currentPlatform})`);
        attachedInput = el;
        bindListeners(el);
      }

      const text = getInputText(el);
      if (text !== lastPolledText) {
        lastPolledText = text;
        handleTextChange(text, el);
      }
    }, 500);

    document.addEventListener('click', (e: MouseEvent) => {
      if (
        isVisible &&
        !dropdown?.contains(e.target as Node) &&
        e.target !== attachedInput
      ) {
        hideDropdown();
      }
    });

    sendMessage({ type: 'GET_SETTINGS' }).then((resp) => {
      if (resp?.settings) {
        isEnabled = (resp.settings as VaultSettings).autocompleteEnabled !== false;
      }
    });
  }

  function handleTextChange(text: string, element: HTMLElement): void {
    if (!isEnabled) return;

    if (text.length < MIN_QUERY_LENGTH) {
      hideDropdown();
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      const response = await sendMessage({
        type: 'SEARCH_SIMILAR',
        query: text,
        limit: 5,
      });

      if (response?.results && (response.results as SimilarQuestionResult[]).length > 0) {
        showDropdown(response.results as SimilarQuestionResult[], element);
      } else {
        hideDropdown();
      }
    }, DEBOUNCE_MS);
  }

  /* ── Helpers ── */

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatRelativeTime(timestamp: string): string {
    if (!timestamp) return '';
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  }

  /* ── Expose globally ── */

  window.OogVaultAutocomplete = { attach };
})();
