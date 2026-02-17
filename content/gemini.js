/**
 * OogVault Content Script — Google Gemini
 * Captures conversations and injects UI elements on gemini.google.com.
 */

(function () {
  'use strict';


  const PLATFORM = 'gemini';
  const URL_CHECK_INTERVAL_MS = 1500;

  let currentUrl = window.location.href;
  let observer = null;

  /* ── Initialization ── */

  async function init() {
    try {
      console.log('[OogVault] Gemini content script loaded 🐢');
      console.log('[OogVault] URL:', window.location.href);

      injectSaveButton();

      waitForChatContainer(() => {
        console.log('[OogVault] Chat container found, setting up observers...');
        observeMessages();
        initAutocompleteForPlatform();
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
        });
      }, 1000);
    }
  }

  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
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
      console.log('[OogVault] Gave up waiting for chat container after 30 attempts');
    }
  }

  function getChatContainer() {
    return (
      document.querySelector('.conversation-container') ||
      document.querySelector('infinite-scroller') ||
      document.querySelector('[class*="conversation"]') ||
      document.querySelector('main')
    );
  }

  /* ── Conversation ID from URL ── */

  function getConversationId() {
    // gemini.google.com/app/<id> or gemini.google.com/gem/<id>
    const match = window.location.pathname.match(/\/(?:app|gem)\/([a-zA-Z0-9_-]+)/);
    if (match) return `gemini-${match[1]}`;

    // Fallback: use full path hash
    const pathHash = window.location.pathname.replace(/\//g, '-').replace(/^-/, '');
    return pathHash ? `gemini-${pathHash}` : null;
  }

  /* ── Message Extraction ── */

  function extractMessages() {
    console.log('[OogVault] Starting Gemini message extraction...');

    // Strategy 1: Custom web components (Gemini's Angular-based UI)
    try {
      const result = strategyWebComponents();
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 1 (web components) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', e.message);
    }

    // Strategy 2: Turn-based containers with role attributes/classes
    try {
      const result = strategyTurnContainers();
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 2 (turn containers) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', e.message);
    }

    // Strategy 3: Data attribute based extraction
    try {
      const result = strategyDataAttributes();
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 3 (data attributes) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', e.message);
    }

    // Strategy 4: Visual groups heuristic
    try {
      const result = strategyVisualGroups();
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 4 (visual groups) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', e.message);
    }

    logDomDebugInfo();
    return [];
  }

  /**
   * Strategy 1: Gemini uses Angular custom elements.
   * Known elements: <user-query>, <model-response>, <message-content>,
   * .query-text, .markdown, response-container, share-turn-viewer
   */
  function strategyWebComponents() {
    const messages = [];

    // Approach A: Turn viewer elements (used on both share and app pages)
    const turnViewers = document.querySelectorAll(
      'turn-viewer, share-turn-viewer, [class*="turn-viewer"], conversation-turn'
    );

    if (turnViewers.length > 0) {
      console.log(`[OogVault] S1A: found ${turnViewers.length} turn viewers`);

      for (const turn of turnViewers) {
        // User query
        const userEl =
          turn.querySelector('user-query .query-text') ||
          turn.querySelector('user-query') ||
          turn.querySelector('.query-text') ||
          turn.querySelector('[class*="query-content"]') ||
          turn.querySelector('[class*="user-query"]');

        if (userEl) {
          const text = cleanText(userEl);
          if (text.length > 2) {
            messages.push({ role: 'user', content: text });
          }
        }

        // Assistant response
        const assistantEl =
          turn.querySelector('response-container message-content .markdown') ||
          turn.querySelector('model-response message-content .markdown') ||
          turn.querySelector('model-response .markdown') ||
          turn.querySelector('message-content .markdown') ||
          turn.querySelector('response-container message-content') ||
          turn.querySelector('model-response message-content') ||
          turn.querySelector('model-response') ||
          turn.querySelector('message-content') ||
          turn.querySelector('[class*="model-response"]') ||
          turn.querySelector('[class*="response-content"]');

        if (assistantEl) {
          const text = cleanText(assistantEl);
          if (text.length > 2) {
            messages.push({ role: 'assistant', content: text });
          }
        }
      }

      if (messages.length >= 2) return messages;
    }

    // Approach B: Direct element queries without turn wrappers
    const userQueries = document.querySelectorAll(
      'user-query .query-text, user-query, .query-text, [class*="user-query-content"]'
    );
    const modelResponses = document.querySelectorAll(
      'model-response .markdown, model-response message-content, model-response, message-content .markdown'
    );

    console.log(`[OogVault] S1B: ${userQueries.length} user queries, ${modelResponses.length} model responses`);

    if (userQueries.length > 0 && modelResponses.length > 0) {
      const count = Math.min(userQueries.length, modelResponses.length);
      for (let i = 0; i < count; i++) {
        const qText = cleanText(userQueries[i]);
        const aText = cleanText(modelResponses[i]);
        if (qText.length > 2) messages.push({ role: 'user', content: qText });
        if (aText.length > 2) messages.push({ role: 'assistant', content: aText });
      }
      // Handle extra user query without response (conversation in progress)
      if (userQueries.length > modelResponses.length) {
        const qText = cleanText(userQueries[count]);
        if (qText && qText.length > 2) messages.push({ role: 'user', content: qText });
      }
    }

    return messages;
  }

  /**
   * Strategy 2: Look for turn containers by class patterns.
   * Gemini often wraps each exchange in elements with "turn" or "message" in class names.
   */
  function strategyTurnContainers() {
    const messages = [];

    // Look for role-based containers
    const userContainers = document.querySelectorAll(
      '[class*="user-turn"], [class*="human-turn"], [data-author-role="user"], [class*="query-container"]'
    );
    const assistantContainers = document.querySelectorAll(
      '[class*="model-turn"], [class*="bot-turn"], [data-author-role="model"], [class*="response-container"]'
    );

    console.log(`[OogVault] S2: ${userContainers.length} user containers, ${assistantContainers.length} assistant containers`);

    if (userContainers.length > 0 || assistantContainers.length > 0) {
      // Interleave user and assistant messages
      const count = Math.max(userContainers.length, assistantContainers.length);
      for (let i = 0; i < count; i++) {
        if (i < userContainers.length) {
          const text = cleanText(userContainers[i]);
          if (text.length > 2) messages.push({ role: 'user', content: text });
        }
        if (i < assistantContainers.length) {
          const text = cleanText(assistantContainers[i]);
          if (text.length > 2) messages.push({ role: 'assistant', content: text });
        }
      }
    }

    return messages;
  }

  /**
   * Strategy 3: Look for elements with data attributes that indicate message roles.
   */
  function strategyDataAttributes() {
    const messages = [];
    const allTestIds = [];

    document.querySelectorAll('[data-testid], [data-message-id], [data-turn-id]').forEach((el) => {
      const tid = el.getAttribute('data-testid') || '';
      const mid = el.getAttribute('data-message-id') || '';
      allTestIds.push({ tid, mid, el });
    });

    console.log(`[OogVault] S3: found ${allTestIds.length} elements with data attrs`);

    for (const { tid, mid, el } of allTestIds) {
      const lower = (tid + mid).toLowerCase();
      const text = cleanText(el);
      if (text.length < 5) continue;

      if (lower.includes('user') || lower.includes('human') || lower.includes('query')) {
        messages.push({ role: 'user', content: text });
      } else if (lower.includes('model') || lower.includes('bot') || lower.includes('response') || lower.includes('assistant')) {
        messages.push({ role: 'assistant', content: text });
      }
    }

    return messages;
  }

  /**
   * Strategy 4: Visual groups — find the deepest container with alternating content blocks.
   */
  function strategyVisualGroups() {
    const messages = [];
    const root = getChatContainer();
    if (!root) return messages;

    let bestContainer = null;
    let bestChildCount = 0;

    function walk(el, depth) {
      if (depth > 8) return;
      const children = Array.from(el.children);
      const substantialChildren = children.filter((c) => {
        try {
          return (c.innerText || '').trim().length > 15 && c.offsetHeight > 20;
        } catch { return false; }
      });

      if (substantialChildren.length >= 2 && substantialChildren.length > bestChildCount) {
        const texts = substantialChildren.map((c) => (c.innerText || '').trim().substring(0, 50));
        const uniqueTexts = new Set(texts);
        if (uniqueTexts.size >= 2) {
          bestContainer = el;
          bestChildCount = substantialChildren.length;
        }
      }

      for (const child of children) {
        walk(child, depth + 1);
      }
    }

    walk(root, 0);

    if (!bestContainer || bestChildCount < 2) {
      console.log('[OogVault] S4: no good container found');
      return messages;
    }

    console.log(`[OogVault] S4: best container has ${bestChildCount} content children`);

    const children = Array.from(bestContainer.children);
    const userKeywords = /user|human|query|prompt/i;
    const assistantKeywords = /model|bot|response|assistant|gemini/i;

    for (const child of children) {
      const text = cleanText(child);
      if (text.length < 5) continue;

      let role = 'assistant';
      try {
        const cls = String(child.className || '').toLowerCase();
        const tag = child.tagName?.toLowerCase() || '';
        const html = child.innerHTML?.substring(0, 300).toLowerCase() || '';

        if (userKeywords.test(cls) || userKeywords.test(tag) || userKeywords.test(html)) {
          role = 'user';
        } else if (child.querySelector('user-query, .query-text, [class*="user-query"]')) {
          role = 'user';
        }
      } catch { /* ignore */ }

      messages.push({ role, content: text });
    }

    // If all same role, alternate
    const roles = new Set(messages.map((m) => m.role));
    if (roles.size === 1 && messages.length >= 2) {
      messages.forEach((m, i) => {
        m.role = i % 2 === 0 ? 'user' : 'assistant';
      });
    }

    return messages;
  }

  /* ── Helper: Clean text content from an element ── */

  function cleanText(element) {
    const clone = element.cloneNode(true);

    // Remove non-content elements
    clone
      .querySelectorAll(
        'button, [role="toolbar"], nav, header, footer, [class*="toolbar"], [class*="action-button"], [class*="chip"], [class*="icon-button"]'
      )
      .forEach((el) => el.remove());

    let text = (clone.textContent || '').trim();

    // Strip Gemini's role prefixes that appear in the DOM text
    text = text.replace(/^You said\s*/i, '');
    text = text.replace(/^Gemini said\s*/i, '');

    return text;
  }

  /**
   * Deduplicate messages: remove consecutive duplicate entries
   * and merge adjacent same-role messages.
   */
  function deduplicateMessages(messages) {
    if (messages.length <= 1) return messages;

    const deduped = [];
    const seen = new Set();

    for (const m of messages) {
      // Build a key from role + first 150 chars of content
      const key = m.role + '::' + m.content.substring(0, 150);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push({ ...m });
    }

    return deduped;
  }

  /* ── Debug ── */

  function logDomDebugInfo() {
    const root = getChatContainer();
    console.log('[OogVault] === GEMINI DOM DEBUG ===');
    console.log('[OogVault] Container:', root?.tagName, root?.className?.substring(0, 80));

    if (root) {
      console.log('[OogVault] children:', root.children.length);
      Array.from(root.children).slice(0, 5).forEach((child, i) => {
        const tag = child.tagName;
        const cls = String(child.className || '').substring(0, 80);
        const textLen = (child.innerText || '').length;
        console.log(`[OogVault]  [${i}] <${tag}> class="${cls}" textLen=${textLen}`);
      });
    }

    // Show custom elements
    const customEls = new Set();
    document.querySelectorAll('*').forEach((el) => {
      if (el.tagName.includes('-')) customEls.add(el.tagName.toLowerCase());
    });
    console.log('[OogVault] Custom elements:', [...customEls].sort().join(', ') || '(none)');

    // Show relevant class names
    const keywords = /user|query|message|response|model|turn|content|markdown|assistant|gemini|conversation/i;
    const matchingClasses = new Set();
    document.querySelectorAll('[class]').forEach((el) => {
      const c = String(el.className || '');
      if (keywords.test(c)) matchingClasses.add(c.substring(0, 80));
    });
    console.log('[OogVault] Keyword classes:', [...matchingClasses].slice(0, 15).join(' | ') || '(none)');
    console.log('[OogVault] === END DEBUG ===');
  }

  /* ── Generate Title ── */

  function generateTitle(messages) {
    const firstUser = messages.find((m) => m.role === 'user');
    if (!firstUser) return 'Untitled conversation';
    const text = firstUser.content.substring(0, 80);
    return text.length < firstUser.content.length ? text + '...' : text;
  }

  /* ── Save Conversation ── */

  async function saveCurrentConversation() {
    const convId = getConversationId();
    if (!convId) {
      console.warn('[OogVault] No conversation ID found in URL');
      return { success: false, reason: 'no_id' };
    }

    const rawMessages = extractMessages();
    const messages = deduplicateMessages(rawMessages);
    if (rawMessages.length !== messages.length) {
      console.log(`[OogVault] Deduplication: ${rawMessages.length} → ${messages.length} messages`);
    }
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
        console.log(`[OogVault] Saved ${messages.length} messages for conversation ${convId}`);
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

  /* ── Observe DOM ── */

  function observeMessages() {
    const container = getChatContainer();
    if (!container) return;

    observer = new MutationObserver(() => {
      // Observer kept for potential future use
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
    btn.innerHTML = `Save to OogVault`;
    btn.title = 'Save this conversation to OogVault';

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerHTML = `Saving...`;

      try {
        const result = await saveCurrentConversation();

        if (result?.success) {
          btn.innerHTML = `Saved ${result.messageCount} msgs!`;
          btn.classList.add('oogvault-save-btn--saved');
        } else {
          btn.innerHTML = `${result?.reason || 'Save failed'}`;
          btn.classList.add('oogvault-save-btn--error');
          console.error('[OogVault] Save failed. Reason:', result?.reason);
        }
      } catch (err) {
        btn.innerHTML = `Error — check console`;
        btn.classList.add('oogvault-save-btn--error');
        console.error('[OogVault] Save threw an error:', err);
      }

      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = `Save to OogVault`;
        btn.classList.remove('oogvault-save-btn--saved', 'oogvault-save-btn--error');
      }, 3000);
    });

    document.body.appendChild(btn);
  }

  /* ── Autocomplete Integration ── */

  function initAutocompleteForPlatform() {
    if (typeof window.OogVaultAutocomplete === 'undefined') return;

    const findInput = () => {
      return (
        document.querySelector('.ql-editor[contenteditable="true"]') ||
        document.querySelector('rich-textarea .ql-editor') ||
        document.querySelector('[contenteditable="true"][aria-label*="prompt"]') ||
        document.querySelector('[contenteditable="true"][aria-label*="message"]') ||
        document.querySelector('div[contenteditable="true"].text-input-field') ||
        document.querySelector('div[contenteditable="true"]') ||
        document.querySelector('textarea[aria-label*="prompt"]') ||
        document.querySelector('textarea[aria-label*="message"]') ||
        document.querySelector('textarea')
      );
    };

    const inputEl = findInput();
    if (inputEl) {
      window.OogVaultAutocomplete.attach(inputEl, PLATFORM, findInput);
    } else {
      const retryInterval = setInterval(() => {
        const el = findInput();
        if (el) {
          window.OogVaultAutocomplete.attach(el, PLATFORM, findInput);
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

  console.log('[OogVault] Gemini script executing, readyState:', document.readyState);

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
