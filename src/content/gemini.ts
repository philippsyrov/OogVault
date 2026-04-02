/**
 * OogVault Content Script — Google Gemini
 * Captures conversations and injects UI elements on gemini.google.com.
 */

(function (): void {
  'use strict';

  interface ChatMessage {
    role: string;
    content: string;
  }

  interface SaveResult {
    success: boolean;
    messageCount?: number;
    reason?: string;
  }

  const PLATFORM = 'gemini';
  const URL_CHECK_INTERVAL_MS = 1500;

  let currentUrl: string = window.location.href;
  let observer: MutationObserver | null = null;

  /* ── Initialization ── */

  async function init(): Promise<void> {
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

  function checkUrlChange(): void {
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

  function getChatContainer(): Element | null {
    return (
      document.querySelector('.conversation-container') ||
      document.querySelector('infinite-scroller') ||
      document.querySelector('[class*="conversation"]') ||
      document.querySelector('main')
    );
  }

  /* ── Conversation ID from URL ── */

  function getConversationId(): string | null {
    const match = window.location.pathname.match(/\/(?:app|gem)\/([a-zA-Z0-9_-]+)/);
    if (match) return `gemini-${match[1]}`;

    const pathHash = window.location.pathname.replace(/\//g, '-').replace(/^-/, '');
    return pathHash ? `gemini-${pathHash}` : null;
  }

  /* ── Message Extraction ── */

  function extractMessages(): ChatMessage[] {
    console.log('[OogVault] Starting Gemini message extraction...');

    try {
      const result = strategyWebComponents();
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 1 (web components) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', (e as Error).message);
    }

    try {
      const result = strategyTurnContainers();
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 2 (turn containers) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', (e as Error).message);
    }

    try {
      const result = strategyDataAttributes();
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 3 (data attributes) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', (e as Error).message);
    }

    try {
      const result = strategyVisualGroups();
      if (result.length >= 2) {
        console.log('[OogVault] Strategy 4 (visual groups) →', result.length, 'messages');
        return result;
      }
    } catch (e) {
      console.log('[OogVault] Strategy error:', (e as Error).message);
    }

    logDomDebugInfo();
    return [];
  }

  function strategyWebComponents(): ChatMessage[] {
    const messages: ChatMessage[] = [];

    const turnViewers = document.querySelectorAll(
      'turn-viewer, share-turn-viewer, [class*="turn-viewer"], conversation-turn'
    );

    if (turnViewers.length > 0) {
      console.log(`[OogVault] S1A: found ${turnViewers.length} turn viewers`);

      for (const turn of Array.from(turnViewers)) {
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
      if (userQueries.length > modelResponses.length) {
        const qText = cleanText(userQueries[count]);
        if (qText && qText.length > 2) messages.push({ role: 'user', content: qText });
      }
    }

    return messages;
  }

  function strategyTurnContainers(): ChatMessage[] {
    const messages: ChatMessage[] = [];

    const userContainers = document.querySelectorAll(
      '[class*="user-turn"], [class*="human-turn"], [data-author-role="user"], [class*="query-container"]'
    );
    const assistantContainers = document.querySelectorAll(
      '[class*="model-turn"], [class*="bot-turn"], [data-author-role="model"], [class*="response-container"]'
    );

    console.log(`[OogVault] S2: ${userContainers.length} user containers, ${assistantContainers.length} assistant containers`);

    if (userContainers.length > 0 || assistantContainers.length > 0) {
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

  function strategyDataAttributes(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const allTestIds: Array<{ tid: string; mid: string; el: Element }> = [];

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

  function strategyVisualGroups(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const root = getChatContainer();
    if (!root) return messages;

    let bestContainer: Element | null = null;
    let bestChildCount = 0;

    function walk(el: Element, depth: number): void {
      if (depth > 8) return;
      const children = Array.from(el.children);
      const substantialChildren = children.filter((c) => {
        try {
          return ((c as HTMLElement).innerText || '').trim().length > 15 && (c as HTMLElement).offsetHeight > 20;
        } catch { return false; }
      });

      if (substantialChildren.length >= 2 && substantialChildren.length > bestChildCount) {
        const texts = substantialChildren.map((c) => ((c as HTMLElement).innerText || '').trim().substring(0, 50));
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

    const foundContainer: Element = bestContainer;
    const children = Array.from(foundContainer.children);
    const userKeywords = /user|human|query|prompt/i;

    for (const child of children) {
      const text = cleanText(child);
      if (text.length < 5) continue;

      let role = 'assistant';
      try {
        const cls = String((child as HTMLElement).className || '').toLowerCase();
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

    const roles = new Set(messages.map((m) => m.role));
    if (roles.size === 1 && messages.length >= 2) {
      messages.forEach((m, i) => {
        m.role = i % 2 === 0 ? 'user' : 'assistant';
      });
    }

    return messages;
  }

  /* ── Helper: Clean text content from an element ── */

  function cleanText(element: Element): string {
    const clone = element.cloneNode(true) as Element;

    clone
      .querySelectorAll(
        'button, [role="toolbar"], nav, header, footer, [class*="toolbar"], [class*="action-button"], [class*="chip"], [class*="icon-button"]'
      )
      .forEach((el) => el.remove());

    let text = (clone.textContent || '').trim();

    text = text.replace(/^You said\s*/i, '');
    text = text.replace(/^Gemini said\s*/i, '');

    return text;
  }

  function deduplicateMessages(messages: ChatMessage[]): ChatMessage[] {
    if (messages.length <= 1) return messages;

    const deduped: ChatMessage[] = [];
    const seen = new Set<string>();

    for (const m of messages) {
      const key = m.role + '::' + m.content.substring(0, 150);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push({ ...m });
    }

    return deduped;
  }

  /* ── Debug ── */

  function logDomDebugInfo(): void {
    const root = getChatContainer();
    console.log('[OogVault] === GEMINI DOM DEBUG ===');
    console.log('[OogVault] Container:', root?.tagName, (root as HTMLElement)?.className?.substring(0, 80));

    if (root) {
      console.log('[OogVault] children:', root.children.length);
      Array.from(root.children).slice(0, 5).forEach((child, i) => {
        const tag = child.tagName;
        const cls = String((child as HTMLElement).className || '').substring(0, 80);
        const textLen = ((child as HTMLElement).innerText || '').length;
        console.log(`[OogVault]  [${i}] <${tag}> class="${cls}" textLen=${textLen}`);
      });
    }

    const customEls = new Set<string>();
    document.querySelectorAll('*').forEach((el) => {
      if (el.tagName.includes('-')) customEls.add(el.tagName.toLowerCase());
    });
    console.log('[OogVault] Custom elements:', [...customEls].sort().join(', ') || '(none)');

    const keywords = /user|query|message|response|model|turn|content|markdown|assistant|gemini|conversation/i;
    const matchingClasses = new Set<string>();
    document.querySelectorAll('[class]').forEach((el) => {
      const c = String((el as HTMLElement).className || '');
      if (keywords.test(c)) matchingClasses.add(c.substring(0, 80));
    });
    console.log('[OogVault] Keyword classes:', [...matchingClasses].slice(0, 15).join(' | ') || '(none)');
    console.log('[OogVault] === END DEBUG ===');
  }

  /* ── Generate Title ── */

  function generateTitle(messages: ChatMessage[]): string {
    const firstUser = messages.find((m) => m.role === 'user');
    if (!firstUser) return 'Untitled conversation';
    const text = firstUser.content.substring(0, 80);
    return text.length < firstUser.content.length ? text + '...' : text;
  }

  /* ── Save Conversation ── */

  async function saveCurrentConversation(): Promise<SaveResult> {
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

  function observeMessages(): void {
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
        document.querySelector<HTMLElement>('.ql-editor[contenteditable="true"]') ||
        document.querySelector<HTMLElement>('rich-textarea .ql-editor') ||
        document.querySelector<HTMLElement>('[contenteditable="true"][aria-label*="prompt"]') ||
        document.querySelector<HTMLElement>('[contenteditable="true"][aria-label*="message"]') ||
        document.querySelector<HTMLElement>('div[contenteditable="true"].text-input-field') ||
        document.querySelector<HTMLElement>('div[contenteditable="true"]') ||
        document.querySelector<HTMLElement>('textarea[aria-label*="prompt"]') ||
        document.querySelector<HTMLElement>('textarea[aria-label*="message"]') ||
        document.querySelector<HTMLElement>('textarea')
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

  function sendMessage(message: VaultRequest): Promise<Record<string, unknown> | null> {
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
