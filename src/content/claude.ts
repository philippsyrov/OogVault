/**
 * OogVault Content Script — Claude.ai
 * Captures conversations and injects UI elements on claude.ai.
 */

(function (): void {
  'use strict';


  const PLATFORM = 'claude';
  const URL_CHECK_INTERVAL_MS = 1500;

  let currentUrl: string = window.location.href;
  let observer: MutationObserver | null = null;

  /* ── Initialization ── */

  async function init(): Promise<void> {
    try {
      console.log('[OogVault] Claude.ai content script loaded 🐢');
      console.log('[OogVault] URL:', window.location.href);

      injectSaveButton();

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

  function checkUrlChange(): void {
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

  function cleanup(): void {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  /* ── Wait for Chat Container ── */

  function waitForChatContainer(callback: () => void, attempts: number = 0): void {
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

  function getChatContainer(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('main') ||
      document.querySelector<HTMLElement>('[class*="chat-ui"]') ||
      document.querySelector<HTMLElement>('[class*="conversation"]') ||
      document.body
    );
  }

  /* ── Conversation ID from URL ── */

  function getConversationId(): string | null {
    const match = window.location.pathname.match(/\/chat\/([a-zA-Z0-9-]+)/);
    return match ? `claude-${match[1]}` : null;
  }

  /* ── Message Extraction ── */

  function extractMessages(): Array<{ role: string; content: string }> {
    console.log('[OogVault] Starting message extraction...');

    const root = getChatContainer();
    if (!root) {
      console.warn('[OogVault] No chat container found');
      return [];
    }
    console.log('[OogVault] Root element:', root.tagName, 'class:', String(root.className || '').substring(0, 60));

    try {
      const result = strategyRoleSelectors(root);
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 1 (role selectors) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', (e as Error).message);
    }

    try {
      const result = strategyDataAttributes(root);
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 2 (data attributes) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', (e as Error).message);
    }

    try {
      const result = strategyVisualGroups(root);
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 3 (visual groups) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', (e as Error).message);
    }

    try {
      const text = (root as HTMLElement).innerText?.trim();
      if (text && text.length > 20) {
        console.log('[OogVault] Strategy 4 (full text fallback) → length:', text.length);
        return [{ role: 'user', content: text }];
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', (e as Error).message);
    }

    logDomDebugInfo(root);
    return [];
  }

  /**
   * Strategy 1: Find elements by class/attribute patterns that indicate roles.
   * Looks for user-message and claude-response font class patterns used by Claude.ai,
   * plus data-testid based selectors as fallback.
   */
  function strategyRoleSelectors(root: HTMLElement): Array<{ role: string; content: string }> {
    const userElements: Array<{ el: Element; role: string; text: string }> = [];
    const seen = new Set<Element>();

    function addUser(el: Element): void {
      if (seen.has(el)) return;
      const text = ((el as HTMLElement).innerText || '').trim();
      if (text.length > 3) {
        seen.add(el);
        userElements.push({ el, role: 'user', text });
      }
    }

    root.querySelectorAll('[data-testid="user-message"]').forEach(addUser);
    root.querySelectorAll('[class*="font-user-message"]').forEach(addUser);
    root.querySelectorAll('[data-testid*="human-turn"]').forEach(addUser);

    const dedupedUsers = userElements.filter((item) =>
      !userElements.some((other) => other !== item && other.el.contains(item.el))
    );

    console.log(`[OogVault] S1: found ${dedupedUsers.length} user elements`);

    if (dedupedUsers.length === 0) return [];

    const turnResult = strategyTurnBased(root, dedupedUsers);
    if (turnResult.length >= 2) return turnResult;

    return dedupedUsers.map((d) => ({ role: d.role, content: d.text }));
  }

  /**
   * Turn-based extraction: finds user elements, walks up to their "turn" ancestor,
   * then collects sibling turns as alternating user/assistant messages.
   */
  function strategyTurnBased(
    root: HTMLElement,
    userItems: Array<{ el: Element; role: string; text: string }>
  ): Array<{ role: string; content: string }> {
    console.log('[OogVault] Turn-based: starting with', userItems.length, 'known user elements');

    const MIN_TURN_LENGTH = 20;

    function findTurnAncestor(el: Element): Element {
      let current: Element = el;
      let depth = 0;
      while (current && current !== root && depth < 20) {
        const parent = current.parentElement;
        if (!parent || parent === root) return current;

        const siblings = Array.from(parent.children).filter((c) => {
          if (c === current) return false;
          try { return ((c as HTMLElement).innerText || '').trim().length > MIN_TURN_LENGTH; } catch { return false; }
        });

        if (siblings.length >= 1) return current;

        current = parent;
        depth++;
      }
      return current;
    }

    const userTurns = userItems.map((item) => ({
      turnEl: findTurnAncestor(item.el),
      userEl: item.el,
      text: item.text,
    }));

    if (userTurns.length === 0) return [];

    const turnContainer = userTurns[0].turnEl.parentElement;
    if (!turnContainer) return [];

    console.log('[OogVault] Turn-based: turn container tag:', turnContainer.tagName,
      'children:', turnContainer.children.length);

    const allTurns = Array.from(turnContainer.children).filter((c) => {
      try { return ((c as HTMLElement).innerText || '').trim().length > MIN_TURN_LENGTH; } catch { return false; }
    });

    console.log('[OogVault] Turn-based: substantial turns:', allTurns.length);

    if (allTurns.length < 2 && turnContainer.parentElement && turnContainer.parentElement !== root) {
      const higherContainer = turnContainer.parentElement;
      const higherTurns = Array.from(higherContainer.children).filter((c) => {
        try { return ((c as HTMLElement).innerText || '').trim().length > MIN_TURN_LENGTH; } catch { return false; }
      });
      console.log('[OogVault] Turn-based: trying higher container:', higherContainer.tagName,
        'substantial children:', higherTurns.length);

      if (higherTurns.length >= 2) {
        return buildMessages(higherTurns, userItems);
      }

      if (higherContainer.parentElement && higherContainer.parentElement !== root) {
        const topContainer = higherContainer.parentElement;
        const topTurns = Array.from(topContainer.children).filter((c) => {
          try { return ((c as HTMLElement).innerText || '').trim().length > MIN_TURN_LENGTH; } catch { return false; }
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

  function buildMessages(
    turns: Element[],
    userItems: Array<{ el: Element; role: string; text: string }>
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    for (const turn of turns) {
      const text = ((turn as HTMLElement).innerText || '').trim();
      if (text.length < 10) continue;

      const isUser = userItems.some((u) => turn.contains(u.el) || u.el.contains(turn));
      messages.push({ role: isUser ? 'user' : 'assistant', content: text });
    }

    const merged: Array<{ role: string; content: string }> = [];
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
  function strategyDataAttributes(root: HTMLElement): Array<{ role: string; content: string }> {
    const allTestIds: Array<{ id: string; el: Element }> = [];
    root.querySelectorAll('[data-testid]').forEach((el) => {
      allTestIds.push({ id: el.getAttribute('data-testid')!, el });
    });

    console.log('[OogVault] S2: data-testids found:', allTestIds.map((t) => t.id).join(', '));

    const userTestIds = ['user-message', 'human-turn', 'user-turn'];
    const assistantTestIds = ['assistant-message', 'assistant-turn', 'bot-message'];

    const messages: Array<{ role: string; content: string }> = [];
    for (const { id, el } of allTestIds) {
      const lower = id.toLowerCase();
      const text = ((el as HTMLElement).innerText || '').trim();
      if (text.length < 5) continue;

      if (userTestIds.some((t) => lower === t || lower.startsWith(t + '-'))) {
        messages.push({ role: 'user', content: text });
      } else if (assistantTestIds.some((t) => lower === t || lower.startsWith(t + '-'))) {
        messages.push({ role: 'assistant', content: text });
      }
    }

    const userOnly = messages.every((m) => m.role === 'user');
    if (userOnly && messages.length > 0) {
      console.log('[OogVault] S2: only user messages found, trying turn-based from testids');
      const userEls: Array<{ el: Element; role: string; text: string }> = [];
      for (const { id, el } of allTestIds) {
        if (userTestIds.includes(id.toLowerCase())) {
          const text = ((el as HTMLElement).innerText || '').trim();
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
  function strategyVisualGroups(root: HTMLElement): Array<{ role: string; content: string }> {
    let bestContainer: HTMLElement | null = null;
    let bestChildCount = 0;

    function walk(el: HTMLElement, depth: number): void {
      if (depth > 8) return;
      const children = Array.from(el.children) as HTMLElement[];
      const substantialChildren = children.filter((c) => {
        try {
          return (c.innerText || '').trim().length > 10 && c.offsetHeight > 20;
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
      console.log('[OogVault] S3: no good container found');
      return [];
    }

    console.log(`[OogVault] S3: best container has ${bestChildCount} content children, tag=${(bestContainer as HTMLElement).tagName}`);

    const messages: Array<{ role: string; content: string }> = [];
    const children = Array.from((bestContainer as HTMLElement).children);

    const userMsgSelectors = '[class*="font-user-message"], [data-testid*="human"], [data-testid*="user"]';

    for (const child of children) {
      const text = ((child as HTMLElement).innerText || '').trim();
      if (text.length < 5) continue;

      let role = 'assistant';
      try {
        const cls = String((child as HTMLElement).className || '').toLowerCase();
        const tid = (child.getAttribute('data-testid') || '').toLowerCase();
        const html = child.innerHTML.substring(0, 500).toLowerCase();

        if (cls.includes('human') || cls.includes('user') ||
            tid.includes('human') || tid.includes('user')) {
          role = 'user';
        }
        else if (child.querySelector(userMsgSelectors)) {
          role = 'user';
        }
        else if (html.includes('font-user-message') || html.includes('user-turn') || html.includes('human-turn')) {
          role = 'user';
        }
      } catch { /* ignore */ }

      messages.push({ role, content: text });
    }

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
  function logDomDebugInfo(root: HTMLElement): void {
    console.log('[OogVault] === DOM DEBUG ===');
    console.log('[OogVault] main.children:', root.children.length);

    Array.from(root.children).slice(0, 5).forEach((child, i) => {
      const tag = child.tagName;
      const cls = String((child as HTMLElement).className || '').substring(0, 80);
      const tid = child.getAttribute('data-testid') || '';
      const textLen = ((child as HTMLElement).innerText || '').length;
      console.log(`[OogVault]  [${i}] <${tag}> class="${cls}" testid="${tid}" textLen=${textLen}`);
    });

    const tids = new Set<string>();
    root.querySelectorAll('[data-testid]').forEach((el) => tids.add(el.getAttribute('data-testid')!));
    console.log('[OogVault] All data-testids:', [...tids].join(', ') || '(none)');

    const keywords = /human|user|assistant|message|turn|chat|content|response|claude/i;
    const matchingClasses = new Set<string>();
    root.querySelectorAll('[class]').forEach((el) => {
      const c = String((el as HTMLElement).className || '');
      if (keywords.test(c)) matchingClasses.add(c.substring(0, 80));
    });
    console.log('[OogVault] Keyword classes:', [...matchingClasses].slice(0, 10).join(' | ') || '(none)');
    console.log('[OogVault] === END DEBUG ===');
  }

  /* ── Generate Title from First User Message ── */

  function generateTitle(messages: Array<{ role: string; content: string }>): string {
    const firstUser = messages.find((m) => m.role === 'user');
    if (!firstUser) return 'Untitled conversation';
    const text = firstUser.content.substring(0, 80);
    return text.length < firstUser.content.length ? text + '...' : text;
  }

  /* ── Save Conversation ── */

  async function saveCurrentConversation(): Promise<{ success: boolean; messageCount?: number; reason?: string }> {
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
        console.error('[OogVault] Background save returned error:', (resp as Record<string, unknown>)?.error);
        return { success: false, reason: 'bg_error' };
      }
    } catch (err) {
      console.error('[OogVault] Save failed:', err);
      return { success: false, reason: 'exception' };
    }
  }

  /* ── Observe DOM for New Messages ── */

  function observeMessages(): void {
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

  function injectSaveButton(): void {
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

  function initAutocompleteForPlatform(): void {
    if (typeof window.OogVaultAutocomplete === 'undefined') return;

    const findInput = (): HTMLElement | null => {
      return (
        document.querySelector<HTMLElement>('div[contenteditable="true"].ProseMirror') ||
        document.querySelector<HTMLElement>('div[contenteditable="true"]') ||
        document.querySelector<HTMLElement>('textarea[placeholder]') ||
        document.querySelector<HTMLElement>('fieldset textarea')
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

  function sendMessage(message: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response?: Record<string, unknown>) => {
        if (chrome.runtime.lastError) {
          console.warn('[OogVault] Message error:', chrome.runtime.lastError.message);
          resolve(null);
        } else {
          resolve(response ?? null);
        }
      });
    });
  }

  /* ── Start ── */

  console.log('[OogVault] Claude script executing, readyState:', document.readyState);

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
