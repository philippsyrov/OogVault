/**
 * OogVault Content Script — Claude.ai
 * Captures conversations and injects UI elements on claude.ai.
 */

(function () {
  'use strict';

  const PLATFORM = 'claude';
  const SAVE_DEBOUNCE_MS = 3000;
  const URL_CHECK_INTERVAL_MS = 1500;

  let currentUrl = window.location.href;
  let saveTimer = null;
  let isAutoSaveEnabled = true;
  let observer = null;

  /* ── Initialization ── */

  async function init() {
    try {
      console.log('[OogVault] Claude.ai content script loaded 🐢');
      console.log('[OogVault] URL:', window.location.href);

      // Inject save button IMMEDIATELY — don't wait for anything
      injectSaveButton();

      // Load settings (non-blocking — don't let this prevent setup)
      sendMessage({ type: 'GET_SETTINGS' }).then((settingsResp) => {
        if (settingsResp?.settings) {
          isAutoSaveEnabled = settingsResp.settings.autoSave !== false;
        }
      });

      waitForChatContainer(() => {
        console.log('[OogVault] Chat container found, setting up observers...');
        observeMessages();
        initAutocompleteForPlatform();
        debouncedSave();
      });

      setInterval(checkUrlChange, URL_CHECK_INTERVAL_MS);
    } catch (err) {
      console.error('[OogVault] Init error:', err);
    }
  }

  /* ── URL Change Detection (SPA navigation) ── */

  function checkUrlChange() {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      console.log('[OogVault] URL changed, re-initializing');
      cleanup();
      injectSaveButton();
      setTimeout(() => {
        waitForChatContainer(() => {
          observeMessages();
          initAutocompleteForPlatform();
          debouncedSave();
        });
      }, 1000);
    }
  }

  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  /* ── Wait for Chat Container ── */

  function waitForChatContainer(callback, attempts = 0) {
    const container = getChatContainer();
    if (container) {
      callback();
      return;
    }
    if (attempts < 30) {
      setTimeout(() => waitForChatContainer(callback, attempts + 1), 500);
    } else {
      console.warn('[OogVault] Gave up waiting for chat container after 30 attempts');
    }
  }

  function getChatContainer() {
    return (
      document.querySelector('main') ||
      document.querySelector('[class*="chat-ui"]') ||
      document.querySelector('[class*="conversation"]') ||
      document.body
    );
  }

  /* ── Conversation ID from URL ── */

  function getConversationId() {
    const match = window.location.pathname.match(/\/chat\/([a-zA-Z0-9-]+)/);
    return match ? `claude-${match[1]}` : null;
  }

  /* ── Message Extraction ── */

  function extractMessages() {
    console.log('[OogVault] Starting message extraction...');

    const root = getChatContainer();
    if (!root) {
      console.warn('[OogVault] No chat container found');
      return [];
    }
    console.log('[OogVault] Root element:', root.tagName, 'class:', String(root.className || '').substring(0, 60));

    // Strategy 1: Try role-based selectors
    try {
      const result = strategyRoleSelectors(root);
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 1 (role selectors) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.warn('[OogVault] Strategy 1 error:', e.message);
    }

    // Strategy 2: Look for elements with data-testid containing message-related words
    try {
      const result = strategyDataAttributes(root);
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 2 (data attributes) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.warn('[OogVault] Strategy 2 error:', e.message);
    }

    // Strategy 3: Find message blocks by looking for distinct visual groups
    try {
      const result = strategyVisualGroups(root);
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 3 (visual groups) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.warn('[OogVault] Strategy 3 error:', e.message);
    }

    // Strategy 4: NUCLEAR — just grab all visible text and save it
    try {
      const text = root.innerText?.trim();
      if (text && text.length > 20) {
        console.log('[OogVault] Strategy 4 (full text fallback) → length:', text.length);
        return [{ role: 'user', content: text }];
      }
    } catch (e) {
      console.warn('[OogVault] Strategy 4 error:', e.message);
    }

    // Log debug info if everything failed
    logDomDebugInfo(root);
    return [];
  }

  /**
   * Strategy 1: Find elements by class/attribute patterns that indicate roles.
   * Looks for user-message and claude-response font class patterns used by Claude.ai,
   * plus data-testid based selectors as fallback.
   */
  function strategyRoleSelectors(root) {
    // Claude.ai uses font-related classes to distinguish user/assistant messages
    // e.g. font-user-message for user, font-claude-response for assistant
    const selectorGroups = [
      { sel: '[class*="font-user-message"]', role: 'user' },
      { sel: '[class*="font-claude-response"]', role: 'assistant' },
      { sel: '[data-testid*="human-turn"]', role: 'user' },
      { sel: '[data-testid*="assistant-turn"]', role: 'assistant' },
      { sel: '[data-testid*="user-message"]', role: 'user' },
      { sel: '[data-testid*="assistant-message"]', role: 'assistant' },
    ];

    const found = [];
    for (const { sel, role } of selectorGroups) {
      root.querySelectorAll(sel).forEach((el) => {
        const text = (el.innerText || '').trim();
        if (text.length > 3) {
          found.push({ el, role, text });
        }
      });
    }

    console.log(`[OogVault] S1: found ${found.length} role-matching elements`);
    if (found.length === 0) return [];

    // Deduplicate: keep only outermost elements (remove children when parent also matched)
    const deduped = found.filter((item) =>
      !found.some((other) => other !== item && other.el.contains(item.el))
    );

    // Sort by DOM position
    deduped.sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

    // Merge adjacent messages of the same role into one
    const merged = [];
    for (const d of deduped) {
      const last = merged[merged.length - 1];
      if (last && last.role === d.role) {
        last.content += '\n\n' + d.text;
      } else {
        merged.push({ role: d.role, content: d.text });
      }
    }

    console.log(`[OogVault] S1: after dedup+merge: ${merged.length} messages`);
    return merged;
  }

  /**
   * Strategy 2: Look for all elements with data-testid and try to classify them.
   */
  function strategyDataAttributes(root) {
    const allTestIds = [];
    root.querySelectorAll('[data-testid]').forEach((el) => {
      allTestIds.push({ id: el.getAttribute('data-testid'), el });
    });

    console.log('[OogVault] S2: data-testids found:', allTestIds.map((t) => t.id).join(', '));

    const messages = [];
    for (const { id, el } of allTestIds) {
      const lower = id.toLowerCase();
      const text = (el.innerText || '').trim();
      if (text.length < 5) continue;

      if (lower.includes('human') || lower.includes('user')) {
        messages.push({ role: 'user', content: text });
      } else if (lower.includes('assistant') || lower.includes('bot') || lower.includes('response')) {
        messages.push({ role: 'assistant', content: text });
      }
    }

    return messages;
  }

  /**
   * Strategy 3: Walk into the DOM looking for visually distinct message groups.
   * Finds the deepest container that has 2+ children with substantial text.
   */
  function strategyVisualGroups(root) {
    // Find the best container: the deepest element that has multiple
    // direct children with substantial text (these are likely message turns)
    let bestContainer = null;
    let bestChildCount = 0;

    function walk(el, depth) {
      if (depth > 8) return;
      const children = Array.from(el.children);
      const substantialChildren = children.filter((c) => {
        try {
          return (c.innerText || '').trim().length > 10 && c.offsetHeight > 20;
        } catch { return false; }
      });

      if (substantialChildren.length >= 2 && substantialChildren.length > bestChildCount) {
        // Check that these children individually have unique text (not just repeating)
        const texts = substantialChildren.map((c) => (c.innerText || '').trim().substring(0, 50));
        const uniqueTexts = new Set(texts);
        if (uniqueTexts.size >= 2) {
          bestContainer = el;
          bestChildCount = substantialChildren.length;
        }
      }

      // Go deeper into each child
      for (const child of children) {
        walk(child, depth + 1);
      }
    }

    walk(root, 0);

    if (!bestContainer || bestChildCount < 2) {
      console.log('[OogVault] S3: no good container found');
      return [];
    }

    console.log(`[OogVault] S3: best container has ${bestChildCount} content children, tag=${bestContainer.tagName}`);

    // Extract messages from the best container's children
    const messages = [];
    const children = Array.from(bestContainer.children);

    for (const child of children) {
      const text = (child.innerText || '').trim();
      if (text.length < 5) continue;

      // Simple role detection: check for role hints in attributes/classes
      let role = 'assistant';
      try {
        const cls = String(child.className || '').toLowerCase();
        const tid = (child.getAttribute('data-testid') || '').toLowerCase();
        const childClasses = child.innerHTML.substring(0, 300).toLowerCase();

        if (cls.includes('human') || cls.includes('user') ||
            tid.includes('human') || tid.includes('user') ||
            childClasses.includes('human') || childClasses.includes('user-turn')) {
          role = 'user';
        }
      } catch { /* ignore */ }

      messages.push({ role, content: text });
    }

    // If all same role, alternate (common pattern: turn containers alternate user/assistant)
    const roles = new Set(messages.map((m) => m.role));
    if (roles.size === 1 && messages.length >= 2) {
      messages.forEach((m, i) => {
        m.role = i % 2 === 0 ? 'user' : 'assistant';
      });
    }

    return messages;
  }

  /**
   * Log debug info to help diagnose extraction failures.
   */
  function logDomDebugInfo(root) {
    console.log('[OogVault] === DOM DEBUG ===');
    console.log('[OogVault] main.children:', root.children.length);

    Array.from(root.children).slice(0, 5).forEach((child, i) => {
      const tag = child.tagName;
      const cls = String(child.className || '').substring(0, 80);
      const tid = child.getAttribute('data-testid') || '';
      const textLen = (child.innerText || '').length;
      console.log(`[OogVault]  [${i}] <${tag}> class="${cls}" testid="${tid}" textLen=${textLen}`);
    });

    // Show all unique data-testid values
    const tids = new Set();
    root.querySelectorAll('[data-testid]').forEach((el) => tids.add(el.getAttribute('data-testid')));
    console.log('[OogVault] All data-testids:', [...tids].join(', ') || '(none)');

    // Show class names containing message/chat keywords
    const keywords = /human|user|assistant|message|turn|chat|content|response|claude/i;
    const matchingClasses = new Set();
    root.querySelectorAll('[class]').forEach((el) => {
      const c = String(el.className || '');
      if (keywords.test(c)) matchingClasses.add(c.substring(0, 80));
    });
    console.log('[OogVault] Keyword classes:', [...matchingClasses].slice(0, 10).join(' | ') || '(none)');
    console.log('[OogVault] === END DEBUG ===');
  }

  /* ── Generate Title from First User Message ── */

  function generateTitle(messages) {
    const firstUser = messages.find((m) => m.role === 'user');
    if (!firstUser) return 'Untitled conversation';
    const text = firstUser.content.substring(0, 80);
    return text.length < firstUser.content.length ? text + '...' : text;
  }

  /* ── Save Conversation ── */

  function debouncedSave() {
    if (!isAutoSaveEnabled) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrentConversation, SAVE_DEBOUNCE_MS);
  }

  async function saveCurrentConversation() {
    const convId = getConversationId();
    if (!convId) {
      console.warn('[OogVault] No conversation ID found in URL');
      return { success: false, reason: 'no_id' };
    }

    const messages = extractMessages();
    if (messages.length === 0) {
      console.warn('[OogVault] No messages extracted — nothing to save');
      return { success: false, reason: 'no_messages' };
    }

    const now = new Date().toISOString();
    const conversation = {
      id: convId,
      platform: PLATFORM,
      title: generateTitle(messages),
      messages: messages.map((m, i) => ({
        id: `${convId}-msg-${i}`,
        role: m.role,
        content: m.content,
        timestamp: now,
      })),
      created_at: now,
      updated_at: now,
      is_auto_saved: 1,
      url: window.location.href,
    };

    try {
      const resp = await sendMessage({ type: 'SAVE_CONVERSATION', conversation });
      if (resp?.success) {
        console.log(`[OogVault] ✅ Saved ${messages.length} messages for conversation ${convId}`);
        updateSaveButtonState(true);
        return { success: true, messageCount: messages.length };
      } else {
        console.error('[OogVault] Background save returned error:', resp?.error);
        return { success: false, reason: 'bg_error' };
      }
    } catch (err) {
      console.error('[OogVault] Save failed:', err);
      return { success: false, reason: 'exception' };
    }
  }

  /* ── Observe DOM for New Messages ── */

  function observeMessages() {
    const container = getChatContainer();
    if (!container) return;

    observer = new MutationObserver((mutations) => {
      let hasNewContent = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 || mutation.type === 'characterData') {
          hasNewContent = true;
          break;
        }
      }
      if (hasNewContent) {
        debouncedSave();
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  /* ── Save Button Injection ── */

  function injectSaveButton() {
    if (document.getElementById('oogvault-save-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'oogvault-save-btn';
    btn.className = 'oogvault-save-btn';
    btn.innerHTML = '🐢 Save to Vault';
    btn.title = 'Save this conversation to OogVault';

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerHTML = '🐢 Saving...';

      try {
        const result = await saveCurrentConversation();

        if (result?.success) {
          btn.innerHTML = `🐢 ✓ Saved ${result.messageCount} msgs!`;
          btn.classList.add('oogvault-save-btn--saved');
        } else {
          btn.innerHTML = `🐢 ✗ ${result?.reason || 'unknown error'}`;
          btn.classList.add('oogvault-save-btn--error');
          console.error('[OogVault] Save failed. Reason:', result?.reason);
        }
      } catch (err) {
        btn.innerHTML = '🐢 ✗ Error — check console';
        btn.classList.add('oogvault-save-btn--error');
        console.error('[OogVault] Save threw an error:', err);
      }

      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '🐢 Save to Vault';
        btn.classList.remove('oogvault-save-btn--saved', 'oogvault-save-btn--error');
      }, 3000);
    });

    document.body.appendChild(btn);
  }

  function updateSaveButtonState(isSaved) {
    const btn = document.getElementById('oogvault-save-btn');
    if (btn && isSaved) {
      btn.innerHTML = '🐢 ✓ Auto-saved';
      setTimeout(() => {
        btn.innerHTML = '🐢 Save to Vault';
      }, 1500);
    }
  }

  /* ── Autocomplete Integration ── */

  function initAutocompleteForPlatform() {
    if (typeof window.OogVaultAutocomplete === 'undefined') return;

    const findInput = () => {
      return (
        document.querySelector('div[contenteditable="true"].ProseMirror') ||
        document.querySelector('div[contenteditable="true"]') ||
        document.querySelector('textarea[placeholder]') ||
        document.querySelector('fieldset textarea')
      );
    };

    const inputEl = findInput();
    if (inputEl) {
      window.OogVaultAutocomplete.attach(inputEl, PLATFORM);
    } else {
      const retryInterval = setInterval(() => {
        const el = findInput();
        if (el) {
          window.OogVaultAutocomplete.attach(el, PLATFORM);
          clearInterval(retryInterval);
        }
      }, 1000);
      setTimeout(() => clearInterval(retryInterval), 15000);
    }
  }

  /* ── Messaging ── */

  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[OogVault] Message error:', chrome.runtime.lastError.message);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  /* ── Start ── */

  console.log('[OogVault] Claude script executing, readyState:', document.readyState);

  // Always try to inject button immediately, even before DOMContentLoaded
  try {
    if (document.body) {
      injectSaveButton();
    }
  } catch (e) {
    console.error('[OogVault] Early button injection failed:', e);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
