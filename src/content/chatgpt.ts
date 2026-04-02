/**
 * OogVault Content Script — ChatGPT
 * Captures conversations and injects UI elements on chat.openai.com / chatgpt.com.
 */

(function (): void {
  'use strict';


  const PLATFORM = 'chatgpt';
  const URL_CHECK_INTERVAL_MS = 1500;

  let currentUrl: string = window.location.href;
  let observer: MutationObserver | null = null;

  /* ── Initialization ── */

  async function init(): Promise<void> {
    console.log('[OogVault] ChatGPT content script loaded 🐢');

    waitForChatContainer(() => {
      observeMessages();
      injectSaveButton();
      initAutocompleteForPlatform();
    });

    setInterval(checkUrlChange, URL_CHECK_INTERVAL_MS);
  }

  /* ── URL Change Detection (SPA navigation) ── */

  function checkUrlChange(): void {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      console.log('[OogVault] URL changed, re-initializing');
      cleanup();
      setTimeout(() => {
        waitForChatContainer(() => {
          observeMessages();
          injectSaveButton();
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
    }
  }

  function getChatContainer(): HTMLElement | null {
    return (
      document.querySelector<HTMLElement>('[class*="react-scroll-to-bottom"]') ||
      document.querySelector<HTMLElement>('main .overflow-y-auto') ||
      document.querySelector<HTMLElement>('main [role="presentation"]') ||
      document.querySelector<HTMLElement>('main')
    );
  }

  /* ── Conversation ID from URL ── */

  function getConversationId(): string | null {
    const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
    return match ? `chatgpt-${match[1]}` : null;
  }

  /* ── Message Extraction ── */

  function extractMessages(): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    const roleElements = document.querySelectorAll('[data-message-author-role]');

    if (roleElements.length > 0) {
      roleElements.forEach((el) => {
        const role = el.getAttribute('data-message-author-role');
        const normalizedRole = role === 'user' ? 'user' : 'assistant';

        const contentEl =
          el.querySelector('.markdown') ||
          el.querySelector('[class*="markdown"]') ||
          el.querySelector('[data-message-content]') ||
          el;

        const content = extractTextContent(contentEl as HTMLElement);
        if (content && content.trim().length > 0) {
          messages.push({ role: normalizedRole, content: content.trim() });
        }
      });
      return messages;
    }

    const articles = document.querySelectorAll(
      'main article, main [data-testid*="conversation-turn"]'
    );

    if (articles.length > 0) {
      articles.forEach((article, index) => {
        const content = extractTextContent(article as HTMLElement);
        if (content && content.trim().length > 5) {
          messages.push({
            role: index % 2 === 0 ? 'user' : 'assistant',
            content: content.trim(),
          });
        }
      });
      return messages;
    }

    const container = getChatContainer();
    if (!container) return messages;

    const groups = container.querySelectorAll('[class*="group"], [class*="turn"]');
    let isUser = true;

    groups.forEach((group) => {
      const text = extractTextContent(group as HTMLElement);
      if (text && text.trim().length > 5) {
        messages.push({
          role: isUser ? 'user' : 'assistant',
          content: text.trim(),
        });
        isUser = !isUser;
      }
    });

    return messages;
  }

  function extractTextContent(element: HTMLElement): string {
    const clone = element.cloneNode(true) as HTMLElement;

    clone
      .querySelectorAll(
        'button, [role="toolbar"], nav, header, footer, [class*="toolbar"], [class*="action"]'
      )
      .forEach((el) => el.remove());

    return clone.textContent || '';
  }

  /* ── Generate Title ── */

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
        document.querySelector<HTMLElement>('#prompt-textarea') ||
        document.querySelector<HTMLElement>('div[contenteditable="true"]#prompt-textarea') ||
        document.querySelector<HTMLElement>('textarea[data-id="root"]') ||
        document.querySelector<HTMLElement>('main textarea') ||
        document.querySelector<HTMLElement>('div[contenteditable="true"]')
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
