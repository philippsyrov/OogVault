/**
 * OogVault Autocomplete — IDE-style suggestions for AI chat inputs.
 * Shows matching past questions as you type, like VS Code autocomplete.
 */

(function () {
  'use strict';

  const DEBOUNCE_MS = 300;
  const MIN_QUERY_LENGTH = 10;

  let dropdown = null;
  let isVisible = false;
  let selectedIndex = -1;
  let currentResults = [];
  let debounceTimer = null;
  let attachedInput = null;
  let isEnabled = true;

  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  /* ── Dropdown UI ── */

  function createDropdown() {
    if (dropdown) return dropdown;

    dropdown = document.createElement('div');
    dropdown.id = 'oogvault-autocomplete';
    dropdown.className = 'oogvault-autocomplete';
    dropdown.setAttribute('role', 'listbox');
    dropdown.innerHTML = `
      <div class="oogvault-ac-header">
        <span class="oogvault-ac-icon">🐢</span>
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

  function showDropdown(results, anchorEl) {
    if (results.length === 0) {
      hideDropdown();
      return;
    }

    currentResults = results;
    selectedIndex = 0;
    const dd = createDropdown();
    const container = dd.querySelector('.oogvault-ac-results');

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

    // Position the dropdown above the input element
    positionDropdown(dd, anchorEl);

    dd.style.display = 'block';
    isVisible = true;

    // Click handlers on items
    container.querySelectorAll('.oogvault-ac-item').forEach((item) => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.index, 10);
        selectResult(idx);
      });
      item.addEventListener('mouseenter', () => {
        const idx = parseInt(item.dataset.index, 10);
        highlightItem(idx);
      });
    });
  }

  function positionDropdown(dd, anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    const dropdownHeight = dd.offsetHeight || 200;

    // Prefer showing above the input
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

  function hideDropdown() {
    if (dropdown) {
      dropdown.style.display = 'none';
    }
    isVisible = false;
    selectedIndex = -1;
    currentResults = [];
  }

  function highlightItem(index) {
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('.oogvault-ac-item');
    items.forEach((item, i) => {
      item.classList.toggle('oogvault-ac-item--selected', i === index);
    });
    selectedIndex = index;
  }

  /* ── Result Selection ── */

  async function selectResult(index) {
    const result = currentResults[index];
    if (!result) return;

    hideDropdown();

    // Open popup to show the full conversation
    const response = await sendMessage({
      type: 'GET_CONVERSATION',
      id: result.conversationId,
    });

    if (response?.conversation) {
      showConversationPreview(result, response.conversation);
    }
  }

  function showConversationPreview(result, conversation) {
    let preview = document.getElementById('oogvault-preview');
    if (!preview) {
      preview = document.createElement('div');
      preview.id = 'oogvault-preview';
      preview.className = 'oogvault-preview';
      document.body.appendChild(preview);
    }

    const messages = conversation.messages || [];
    const msgHtml = messages
      .slice(0, 10)
      .map(
        (m) => `
      <div class="oogvault-preview-msg oogvault-preview-msg--${m.role}">
        <strong>${m.role === 'user' ? 'You' : 'Assistant'}:</strong>
        <div>${escapeHtml(m.content.substring(0, 500))}${m.content.length > 500 ? '...' : ''}</div>
      </div>
    `
      )
      .join('');

    preview.innerHTML = `
      <div class="oogvault-preview-header">
        <span class="oogvault-preview-title">
          <span class="oogvault-preview-icon">🐢</span>
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

    // Close button
    preview.querySelector('.oogvault-preview-close').addEventListener('click', () => {
      preview.style.display = 'none';
    });

    // Copy answer
    preview.querySelector('.oogvault-preview-btn--copy').addEventListener('click', () => {
      const assistantMsgs = messages
        .filter((m) => m.role === 'assistant')
        .map((m) => m.content)
        .join('\n\n');
      navigator.clipboard.writeText(assistantMsgs);
      preview.querySelector('.oogvault-preview-btn--copy').textContent = 'Copied!';
      setTimeout(() => {
        preview.querySelector('.oogvault-preview-btn--copy').textContent = 'Copy Answer';
      }, 1500);
    });

    // Continue chat (generate summary)
    preview.querySelector('.oogvault-preview-btn--summary').addEventListener('click', async () => {
      const resp = await sendMessage({
        type: 'GENERATE_SUMMARY',
        conversationId: conversation.id,
      });
      if (resp?.summary) {
        navigator.clipboard.writeText(resp.summary);
        preview.querySelector('.oogvault-preview-btn--summary').textContent = 'Summary copied!';
        setTimeout(() => {
          preview.querySelector('.oogvault-preview-btn--summary').textContent = 'Continue Chat';
        }, 2000);
      }
    });

    // Close on Escape
    const closeOnEsc = (e) => {
      if (e.key === 'Escape') {
        preview.style.display = 'none';
        document.removeEventListener('keydown', closeOnEsc);
      }
    };
    document.addEventListener('keydown', closeOnEsc);
  }

  /* ── Input Monitoring ── */

  function getInputText(el) {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.value;
    }
    return el.textContent || el.innerText || '';
  }

  function onInputChange(e) {
    if (!isEnabled) return;

    const text = getInputText(e.target);

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

      if (response?.results?.length > 0) {
        showDropdown(response.results, e.target);
      } else {
        hideDropdown();
      }
    }, DEBOUNCE_MS);
  }

  function onKeyDown(e) {
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

  let pollTimer = null;
  let lastPolledText = '';
  let inputFinder = null;
  let currentPlatform = '';
  let lastBoundElement = null;

  /**
   * Bind event listeners to an input element.
   * Tracks the last bound element to avoid duplicate bindings.
   */
  function bindListeners(el) {
    if (el === lastBoundElement) return;
    lastBoundElement = el;

    el.addEventListener('input', onInputChange, { capture: true });
    el.addEventListener('keydown', onKeyDown, { capture: true });
    el.addEventListener('keyup', (e) => {
      if (!['ArrowDown', 'ArrowUp', 'Tab', 'Escape'].includes(e.key)) {
        onInputChange(e);
      }
    }, { capture: true });
  }

  /**
   * Attach autocomplete to an AI chat input.
   * @param {HTMLElement} inputElement - The initial input element found.
   * @param {string} platform - Platform name (chatgpt, claude).
   * @param {Function} [findInputFn] - Function to re-find the input element.
   *   AI platforms (React/ProseMirror) frequently replace DOM nodes.
   *   If provided, the poll will re-query the DOM each cycle to stay alive.
   */
  function attach(inputElement, platform, findInputFn) {
    console.log(`[OogVault] Autocomplete attached to ${platform} input`);
    attachedInput = inputElement;
    currentPlatform = platform;
    inputFinder = findInputFn || null;

    // Bind event listeners to the initial element
    bindListeners(inputElement);

    // Polling: re-find the input element each cycle to handle DOM replacement.
    // This is the primary mechanism — events are a bonus when they work.
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (!isEnabled) return;

      // Re-find the input element (handles React re-renders)
      let el = inputFinder ? inputFinder() : attachedInput;
      if (!el) return;

      // If the DOM element changed, update our reference and bind listeners
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

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (
        isVisible &&
        !dropdown?.contains(e.target) &&
        e.target !== attachedInput
      ) {
        hideDropdown();
      }
    });

    // Check settings
    sendMessage({ type: 'GET_SETTINGS' }).then((resp) => {
      if (resp?.settings) {
        isEnabled = resp.settings.autocompleteEnabled !== false;
      }
    });
  }

  /**
   * Polling-based text change handler (fallback for contenteditable inputs
   * where input/keyup events don't fire reliably).
   */
  function handleTextChange(text, element) {
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

      if (response?.results?.length > 0) {
        showDropdown(response.results, element);
      } else {
        hideDropdown();
      }
    }, DEBOUNCE_MS);
  }

  /* ── Helpers ── */

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatRelativeTime(timestamp) {
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
