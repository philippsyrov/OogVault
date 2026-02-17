/**
 * OogVault Content Script — Claude.ai
 * Captures conversations and injects UI elements on claude.ai.
 */

(function () {
  'use strict';


  const PLATFORM = 'claude';
  const URL_CHECK_INTERVAL_MS = 1500;

  let currentUrl = window.location.href;
  let observer = null;

  /* ── Initialization ── */

  async function init() {
    try {
      console.log('[OogVault] Claude.ai content script loaded 🐢');
      console.log('[OogVault] URL:', window.location.href);

      // Inject save button IMMEDIATELY — don't wait for anything
      injectSaveButton();

      // Only look for chat container on actual conversation pages
      if (window.location.pathname.includes('/chat/')) {
        waitForChatContainer(() => {
          console.log('[OogVault] Chat container found, setting up observers...');
          observeMessages();
          initAutocompleteForPlatform();
        });
      } else {
        initAutocompleteForPlatform();
      }

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
        if (window.location.pathname.includes('/chat/')) {
          waitForChatContainer(() => {
            observeMessages();
            initAutocompleteForPlatform();
          });
        } else {
          initAutocompleteForPlatform();
        }
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
      console.log('[OogVault] Gave up waiting for chat container after 30 attempts');
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
      console.log('[OogVault] Strategy error:', e.message);
    }

    // Strategy 2: Look for elements with data-testid containing message-related words
    try {
      const result = strategyDataAttributes(root);
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 2 (data attributes) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', e.message);
    }

    // Strategy 3: Find message blocks by looking for distinct visual groups
    try {
      const result = strategyVisualGroups(root);
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 3 (visual groups) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', e.message);
    }

    // Strategy 4: NUCLEAR — just grab all visible text and save it
    try {
      const text = root.innerText?.trim();
      if (text && text.length > 20) {
        console.log('[OogVault] Strategy 4 (full text fallback) → length:', text.length);
        return [{ role: 'user', content: text }];
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', e.message);
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
    // Claude.ai uses data-testid="user-message" for user messages (exact match).
    // Assistant messages have NO specific testid or class, so we use the turn-based
    // approach: find user messages, walk up to their turn containers, then
    // everything else in the conversation is assistant content.

    // Step 1: Find user message elements via multiple strategies
    const userElements = [];
    const seen = new Set();

    function addUser(el) {
      if (seen.has(el)) return;
      const text = (el.innerText || '').trim();
      if (text.length > 3) {
        seen.add(el);
        userElements.push({ el, role: 'user', text });
      }
    }

    // Exact data-testid match (most reliable for Claude.ai)
    root.querySelectorAll('[data-testid="user-message"]').forEach(addUser);

    // Class-based fallbacks
    root.querySelectorAll('[class*="font-user-message"]').forEach(addUser);
    root.querySelectorAll('[data-testid*="human-turn"]').forEach(addUser);

    // Deduplicate: keep only outermost
    const dedupedUsers = userElements.filter((item) =>
      !userElements.some((other) => other !== item && other.el.contains(item.el))
    );

    console.log(`[OogVault] S1: found ${dedupedUsers.length} user elements`);

    if (dedupedUsers.length === 0) return [];

    // Step 2: Always use turn-based extraction since Claude has no assistant selectors
    const turnResult = strategyTurnBased(root, dedupedUsers);
    if (turnResult.length >= 2) return turnResult;

    // Fallback: return just the user messages if turn-based didn't work
    return dedupedUsers.map((d) => ({ role: d.role, content: d.text }));
  }

  /**
   * Turn-based extraction: finds user elements, walks up to their "turn" ancestor,
   * then collects sibling turns as alternating user/assistant messages.
   */
  function strategyTurnBased(root, userItems) {
    console.log('[OogVault] Turn-based: starting with', userItems.length, 'known user elements');

    const MIN_TURN_LENGTH = 20;

    // Walk up from an element to find the conversation-level turn container.
    // We keep walking up until we find a parent whose children include at least
    // one sibling with substantial content (not just timestamps or small UI).
    function findTurnAncestor(el) {
      let current = el;
      let depth = 0;
      while (current && current !== root && depth < 20) {
        const parent = current.parentElement;
        if (!parent || parent === root) return current;

        const siblings = Array.from(parent.children).filter((c) => {
          if (c === current) return false;
          try { return (c.innerText || '').trim().length > MIN_TURN_LENGTH; } catch { return false; }
        });

        // We need at least one sibling with substantial content (the assistant response)
        if (siblings.length >= 1) return current;

        current = parent;
        depth++;
      }
      return current;
    }

    // Find turn ancestors for all user elements
    const userTurns = userItems.map((item) => ({
      turnEl: findTurnAncestor(item.el),
      userEl: item.el,
      text: item.text,
    }));

    if (userTurns.length === 0) return [];

    // Find the common parent (the conversation container)
    const turnContainer = userTurns[0].turnEl.parentElement;
    if (!turnContainer) return [];

    console.log('[OogVault] Turn-based: turn container tag:', turnContainer.tagName,
      'children:', turnContainer.children.length);

    // Collect all child elements that have enough content to be a real turn
    // (filters out timestamps, buttons, and other small UI fragments)
    const allTurns = Array.from(turnContainer.children).filter((c) => {
      try { return (c.innerText || '').trim().length > MIN_TURN_LENGTH; } catch { return false; }
    });

    console.log('[OogVault] Turn-based: substantial turns:', allTurns.length);

    // If we only found 1 turn (just the user), the container level is wrong.
    // Try going up one more level.
    if (allTurns.length < 2 && turnContainer.parentElement && turnContainer.parentElement !== root) {
      const higherContainer = turnContainer.parentElement;
      const higherTurns = Array.from(higherContainer.children).filter((c) => {
        try { return (c.innerText || '').trim().length > MIN_TURN_LENGTH; } catch { return false; }
      });
      console.log('[OogVault] Turn-based: trying higher container:', higherContainer.tagName,
        'substantial children:', higherTurns.length);

      if (higherTurns.length >= 2) {
        return buildMessages(higherTurns, userItems);
      }

      // Try one more level up
      if (higherContainer.parentElement && higherContainer.parentElement !== root) {
        const topContainer = higherContainer.parentElement;
        const topTurns = Array.from(topContainer.children).filter((c) => {
          try { return (c.innerText || '').trim().length > MIN_TURN_LENGTH; } catch { return false; }
        });
        console.log('[OogVault] Turn-based: trying top container:', topContainer.tagName,
          'substantial children:', topTurns.length);
        if (topTurns.length >= 2) {
          return buildMessages(topTurns, userItems);
        }
      }
    }

    return buildMessages(allTurns, userItems);
  }

  function buildMessages(turns, userItems) {
    const messages = [];
    for (const turn of turns) {
      const text = (turn.innerText || '').trim();
      if (text.length < 10) continue;

      const isUser = userItems.some((u) => turn.contains(u.el) || u.el.contains(turn));
      messages.push({ role: isUser ? 'user' : 'assistant', content: text });
    }

    // Merge adjacent same-role messages
    const merged = [];
    for (const m of messages) {
      const last = merged[merged.length - 1];
      if (last && last.role === m.role) {
        last.content += '\n\n' + m.content;
      } else {
        merged.push({ ...m });
      }
    }

    console.log(`[OogVault] Turn-based: extracted ${merged.length} messages`);
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

    // Exact testid matches for actual message elements (avoid false positives like "user-menu-button")
    const userTestIds = ['user-message', 'human-turn', 'user-turn'];
    const assistantTestIds = ['assistant-message', 'assistant-turn', 'bot-message'];

    const messages = [];
    for (const { id, el } of allTestIds) {
      const lower = id.toLowerCase();
      const text = (el.innerText || '').trim();
      if (text.length < 5) continue;

      if (userTestIds.some((t) => lower === t || lower.startsWith(t + '-'))) {
        messages.push({ role: 'user', content: text });
      } else if (assistantTestIds.some((t) => lower === t || lower.startsWith(t + '-'))) {
        messages.push({ role: 'assistant', content: text });
      }
    }

    // If only user messages found, try turn-based extraction
    const userOnly = messages.every((m) => m.role === 'user');
    if (userOnly && messages.length > 0) {
      console.log('[OogVault] S2: only user messages found, trying turn-based from testids');
      const userEls = [];
      for (const { id, el } of allTestIds) {
        if (userTestIds.includes(id.toLowerCase())) {
          const text = (el.innerText || '').trim();
          if (text.length > 3) userEls.push({ el, role: 'user', text });
        }
      }
      if (userEls.length > 0) {
        const turnResult = strategyTurnBased(root, userEls);
        if (turnResult.length >= 2) return turnResult;
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

    // Check if any children contain known user-message elements
    const userMsgSelectors = '[class*="font-user-message"], [data-testid*="human"], [data-testid*="user"]';

    for (const child of children) {
      const text = (child.innerText || '').trim();
      if (text.length < 5) continue;

      let role = 'assistant';
      try {
        const cls = String(child.className || '').toLowerCase();
        const tid = (child.getAttribute('data-testid') || '').toLowerCase();
        const html = child.innerHTML.substring(0, 500).toLowerCase();

        // Check attributes on the element itself
        if (cls.includes('human') || cls.includes('user') ||
            tid.includes('human') || tid.includes('user')) {
          role = 'user';
        }
        // Check if it contains a user-message child element
        else if (child.querySelector(userMsgSelectors)) {
          role = 'user';
        }
        // Check inner HTML for user-related class hints
        else if (html.includes('font-user-message') || html.includes('user-turn') || html.includes('human-turn')) {
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

    observer = new MutationObserver(() => {
      // Observer kept for potential future use (e.g. detecting conversation changes)
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
        document.querySelector('div[contenteditable="true"].ProseMirror') ||
        document.querySelector('div[contenteditable="true"]') ||
        document.querySelector('textarea[placeholder]') ||
        document.querySelector('fieldset textarea')
      );
    };

    const inputEl = findInput();
    if (inputEl) {
      // Pass finder function so autocomplete can re-find the input
      // after Claude's React re-renders replace the DOM node
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
