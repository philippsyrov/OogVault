/**
 * OogVault Content Script — Perplexity.ai
 * Captures conversations and injects UI elements on perplexity.ai.
 */

(function () {
  'use strict';

  const PLATFORM = 'perplexity';
  const URL_CHECK_INTERVAL_MS = 1500;

  let currentUrl = window.location.href;
  let observer = null;

  /* ── Initialization ── */

  async function init() {
    try {
      console.log('[OogVault] Perplexity content script loaded 🐢');
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
      console.warn('[OogVault] Gave up waiting for chat container after 30 attempts');
    }
  }

  function getChatContainer() {
    return (
      document.querySelector('.max-w-threadContentWidth') ||
      document.querySelector('[class*="threadContentWidth"]') ||
      document.querySelector('[class*="thread-content"]') ||
      document.querySelector('main')
    );
  }

  /* ── Conversation ID from URL ── */

  function getConversationId() {
    // perplexity.ai/search/<id> or /thread/<id>
    const match = window.location.pathname.match(/\/(?:search|thread)\/([a-zA-Z0-9._-]+)/);
    if (match) return `perplexity-${match[1]}`;

    // Fallback: use path hash
    const pathHash = window.location.pathname.replace(/\//g, '-').replace(/^-/, '');
    return pathHash ? `perplexity-${pathHash}` : null;
  }

  /* ── Message Extraction ── */

  function extractMessages() {
    console.log('[OogVault] Starting Perplexity message extraction...');

    let result = [];

    // Strategy 1: Query buttons + answer containers (most reliable)
    try {
      result = strategyQueryAndProse();
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 1 (query+prose) →', result.length, 'messages');
        return mergeConsecutiveMessages(result);
      }
    } catch (e) {
      console.warn('[OogVault] Strategy 1 error:', e.message);
    }

    // Strategy 2: Direct class-based selectors
    try {
      result = strategyClassSelectors();
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 2 (class selectors) →', result.length, 'messages');
        return mergeConsecutiveMessages(result);
      }
    } catch (e) {
      console.warn('[OogVault] Strategy 2 error:', e.message);
    }

    // Strategy 3: Data attribute / testid based
    try {
      result = strategyDataAttributes();
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 3 (data attributes) →', result.length, 'messages');
        return mergeConsecutiveMessages(result);
      }
    } catch (e) {
      console.warn('[OogVault] Strategy 3 error:', e.message);
    }

    // Strategy 4: Visual groups fallback
    try {
      result = strategyVisualGroups();
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 4 (visual groups) →', result.length, 'messages');
        return mergeConsecutiveMessages(result);
      }
    } catch (e) {
      console.warn('[OogVault] Strategy 4 error:', e.message);
    }

    logDomDebugInfo();
    return [];
  }

  /**
   * Merge consecutive messages with the same role into one.
   * Perplexity splits a single answer into multiple DOM sections
   * (headers, paragraphs, lists) — this stitches them back together.
   */
  function mergeConsecutiveMessages(messages) {
    if (messages.length <= 1) return messages;

    const merged = [{ ...messages[0] }];

    for (let i = 1; i < messages.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = messages[i];

      if (curr.role === prev.role) {
        prev.content = prev.content + '\n\n' + curr.content;
      } else {
        merged.push({ ...curr });
      }
    }

    if (merged.length !== messages.length) {
      console.log(`[OogVault] Merged consecutive messages: ${messages.length} → ${merged.length}`);
    }

    return merged;
  }

  /**
   * Strategy 1: Perplexity has copy-query buttons near user messages
   * and prose blocks for assistant responses. Walk up from query buttons
   * to find turn containers, then grab all answer content per turn.
   */
  function strategyQueryAndProse() {
    const messages = [];

    // Find all user query sections by locating copy-query buttons
    const queryButtons = document.querySelectorAll(
      'button[data-testid="copy-query-button"], button[aria-label="Copy Query"]'
    );

    console.log(`[OogVault] S1: ${queryButtons.length} query buttons`);

    for (const btn of queryButtons) {
      // Extract user text
      const userRoot = findUserMessageRoot(btn);
      const textEl =
        userRoot.querySelector('.whitespace-pre-line.break-words') ||
        userRoot.querySelector('.whitespace-pre-line') ||
        userRoot.querySelector('span[data-lexical-text="true"]') ||
        userRoot.querySelector('span.select-text') ||
        userRoot.querySelector('[class*="break-words"]');

      const userText = textEl ? textEl.textContent.trim() : cleanText(userRoot);
      if (userText.length > 2) {
        messages.push({ role: 'user', content: userText });
      }

      // Find the answer container: walk up to the turn-level wrapper,
      // then find all prose blocks within that same turn
      const turnContainer = findTurnContainer(btn);
      if (turnContainer) {
        const proseBlocks = turnContainer.querySelectorAll(
          '.prose, [class*="prose"][class*="text-pretty"], [data-testid="answer"], [data-testid="assistant-message"], [class*="markdown"]'
        );

        // Deduplicate nested prose blocks, then concatenate all into one answer
        const dedupedProse = deduplicateElements(Array.from(proseBlocks));
        const answerParts = [];
        for (const prose of dedupedProse) {
          const text = cleanText(prose);
          if (text.length > 3) answerParts.push(text);
        }

        if (answerParts.length > 0) {
          messages.push({ role: 'assistant', content: answerParts.join('\n\n') });
        }
      }
    }

    return messages;
  }

  /**
   * Walk up from a query button to find the top-level turn container
   * that wraps both the user query and the assistant answer.
   */
  function findTurnContainer(button) {
    let node = button;
    let depth = 0;
    let lastGoodContainer = null;

    while (node && node !== document.body && depth < 15) {
      // A turn container typically holds both the query button and prose answer blocks
      if (node.querySelector && node.querySelector('.prose, [class*="prose"]')) {
        lastGoodContainer = node;
      }

      // Stop if we've reached the thread root
      const cls = String(node.className || '').toLowerCase();
      if (cls.includes('threadcontent') || cls.includes('thread-content')) break;
      if (node.tagName === 'MAIN') break;

      node = node.parentElement;
      depth++;
    }

    return lastGoodContainer;
  }

  /**
   * Walk up from a button to find the user message root container.
   */
  function findUserMessageRoot(button) {
    let node = button;
    let depth = 0;
    while (node && node !== document.body && depth < 10) {
      if (node.querySelector &&
        (node.querySelector('.whitespace-pre-line.break-words') ||
         node.querySelector('span[data-lexical-text="true"]') ||
         node.querySelector('span.select-text'))) {
        return node;
      }
      node = node.parentElement;
      depth++;
    }
    return button.parentElement || button;
  }

  /**
   * Strategy 2: Direct class-based selectors for user queries and responses.
   */
  function strategyClassSelectors() {
    const messages = [];

    // User messages: Perplexity wraps user text in specific classes
    const userEls = document.querySelectorAll(
      '.whitespace-pre-line.break-words, [class*="query-text"], [class*="user-query"]'
    );

    // Assistant messages: prose blocks
    const assistantEls = document.querySelectorAll(
      '.prose.text-pretty, [class*="prose"][class*="text-pretty"], [class*="answer-text"], [class*="response-text"]'
    );

    console.log(`[OogVault] S2: ${userEls.length} user elements, ${assistantEls.length} assistant elements`);

    // Deduplicate user elements (nested matches)
    const dedupedUsers = deduplicateElements(userEls);
    const dedupedAssistants = deduplicateElements(assistantEls);

    const count = Math.max(dedupedUsers.length, dedupedAssistants.length);
    for (let i = 0; i < count; i++) {
      if (i < dedupedUsers.length) {
        const text = dedupedUsers[i].textContent.trim();
        if (text.length > 2) messages.push({ role: 'user', content: text });
      }
      if (i < dedupedAssistants.length) {
        const text = cleanText(dedupedAssistants[i]);
        if (text.length > 5) messages.push({ role: 'assistant', content: text });
      }
    }

    return messages;
  }

  /**
   * Strategy 3: Data attribute / testid based extraction.
   */
  function strategyDataAttributes() {
    const messages = [];

    const allTestIds = [];
    document.querySelectorAll('[data-testid]').forEach((el) => {
      allTestIds.push({ tid: el.getAttribute('data-testid'), el });
    });

    console.log(`[OogVault] S3: found ${allTestIds.length} elements with data-testid`);

    for (const { tid, el } of allTestIds) {
      const lower = tid.toLowerCase();
      const text = cleanText(el);
      if (text.length < 5) continue;

      if (lower.includes('query') || lower.includes('user') || lower.includes('question')) {
        messages.push({ role: 'user', content: text });
      } else if (lower.includes('answer') || lower.includes('response') || lower.includes('assistant')) {
        messages.push({ role: 'assistant', content: text });
      }
    }

    return deduplicateMessages(messages);
  }

  /**
   * Strategy 4: Visual groups fallback.
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

    if (!bestContainer || bestChildCount < 2) return messages;

    console.log(`[OogVault] S4: best container has ${bestChildCount} content children`);

    const children = Array.from(bestContainer.children);
    for (const child of children) {
      const text = cleanText(child);
      if (text.length < 5) continue;

      let role = 'assistant';
      const cls = String(child.className || '').toLowerCase();

      // Check for user indicators
      if (cls.includes('query') || cls.includes('user') ||
          child.querySelector('button[data-testid="copy-query-button"]') ||
          child.querySelector('.whitespace-pre-line.break-words')) {
        role = 'user';
      }

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

  /* ── Helpers ── */

  function cleanText(element) {
    const clone = element.cloneNode(true);

    // Remove non-content elements
    clone
      .querySelectorAll(
        'button, [role="toolbar"], nav, header, footer, [class*="toolbar"], [class*="action-button"], [class*="citation"], svg, [class*="source-card"], [class*="related"]'
      )
      .forEach((el) => el.remove());

    return (clone.textContent || '').trim();
  }

  function deduplicateElements(nodeList) {
    const els = Array.from(nodeList);
    return els.filter((el) =>
      !els.some((other) => other !== el && other.contains(el))
    );
  }

  function deduplicateMessages(messages) {
    if (messages.length <= 1) return messages;

    const deduped = [];
    const seen = new Set();

    for (const m of messages) {
      const key = m.role + '::' + m.content.substring(0, 150);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push({ ...m });
    }

    return deduped;
  }

  function logDomDebugInfo() {
    const root = getChatContainer();
    console.log('[OogVault] === PERPLEXITY DOM DEBUG ===');
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

    // Show all data-testid values
    const tids = new Set();
    document.querySelectorAll('[data-testid]').forEach((el) => tids.add(el.getAttribute('data-testid')));
    console.log('[OogVault] All data-testids:', [...tids].sort().join(', ') || '(none)');

    // Show relevant class names
    const keywords = /query|answer|message|response|prose|thread|user|assistant|content|search/i;
    const matchingClasses = new Set();
    document.querySelectorAll('[class]').forEach((el) => {
      const c = String(el.className || '');
      if (keywords.test(c)) matchingClasses.add(c.substring(0, 100));
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
    btn.innerHTML = '🐢 Save to OogVault';
    btn.title = 'Save this conversation to OogVault';

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerHTML = '🐢 Saving...';

      try {
        const result = await saveCurrentConversation();

        if (result?.success) {
          btn.innerHTML = `🐢 Saved ${result.messageCount} msgs!`;
          btn.classList.add('oogvault-save-btn--saved');
        } else {
          btn.innerHTML = `🐢 ${result?.reason || 'Save failed'}`;
          btn.classList.add('oogvault-save-btn--error');
          console.error('[OogVault] Save failed. Reason:', result?.reason);
        }
      } catch (err) {
        btn.innerHTML = '🐢 Error — check console';
        btn.classList.add('oogvault-save-btn--error');
        console.error('[OogVault] Save threw an error:', err);
      }

      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '🐢 Save to OogVault';
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
        document.querySelector('textarea[placeholder*="Ask"]') ||
        document.querySelector('textarea[placeholder*="ask"]') ||
        document.querySelector('textarea[placeholder*="follow"]') ||
        document.querySelector('textarea[placeholder*="Follow"]') ||
        document.querySelector('textarea[class*="textarea"]') ||
        document.querySelector('div[contenteditable="true"][class*="editor"]') ||
        document.querySelector('div[contenteditable="true"]') ||
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

  console.log('[OogVault] Perplexity script executing, readyState:', document.readyState);

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
