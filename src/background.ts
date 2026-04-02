/**
 * OogVault Background Service Worker
 * Central hub: receives data from content scripts, manages DB, serves popup queries.
 */

import {
  saveConversation,
  getConversation,
  getAllConversations,
  deleteConversation,
  getMessagesForConversation,
  addTag,
  removeTag,
  getTagsForConversation,
  getStats,
  saveNuggets,
  getAllNuggets,
} from './lib/db.js';

import {
  searchConversations,
  searchSimilarQuestions,
  exportAsMarkdown,
  generateConversationSummary,
  extractNuggets,
  searchNuggetsText,
  exportKnowledgeMarkdown,
  classifyTopic,
} from './lib/search.js';

chrome.runtime.onInstalled.addListener((): void => {
  console.log('[OogVault] Extension installed - your vault is ready 🐢');

  chrome.storage.local.get('settings', (result: { [key: string]: unknown }): void => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          autoSave: true,
          autocompleteEnabled: true,
          autocompleteMinLength: 10,
          theme: 'default',
        } satisfies VaultSettings,
      });
    }
  });
});

(async function verifyVaultData(): Promise<void> {
  try {
    const stats: VaultStats = await getStats();
    console.log(
      `[OogVault] 🐢 Service worker started. Vault contains: ` +
      `${stats.conversations} conversations, ${stats.messages} messages, ${stats.nuggets} nuggets`
    );
  } catch (err: unknown) {
    console.error('[OogVault] Failed to verify vault data on startup:', err instanceof Error ? err.message : String(err));
  }
})();

chrome.runtime.onMessage.addListener((message: VaultRequest, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void): boolean => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err: unknown) => {
      console.error('[OogVault] Message handler error:', err instanceof Error ? err.message : String(err));
      sendResponse({ error: err instanceof Error ? err.message : String(err) });
    });

  return true; // keep channel open for async response
});

async function handleMessage(message: VaultRequest, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  switch (message.type) {
    /* ── Conversation CRUD ── */
    case 'SAVE_CONVERSATION': {
      const conversation = message.conversation as VaultConversation;
      const conv: VaultConversation = await saveConversation(conversation);

      try {
        const msgs: VaultMessage[] = conversation.messages || [];
        const nuggets: VaultNugget[] = extractNuggets(msgs, conversation.platform as string);
        if (nuggets.length > 0) {
          await saveNuggets(conversation.id, nuggets);
          console.log(`[OogVault] Extracted ${nuggets.length} knowledge nuggets`);
        }
      } catch (err: unknown) {
        console.warn('[OogVault] Nugget extraction failed (non-fatal):', err instanceof Error ? err.message : String(err));
      }

      return { success: true, conversation: conv };
    }

    case 'GET_CONVERSATION': {
      const conv = await getConversation(message.id as string);
      return { conversation: conv };
    }

    case 'GET_ALL_CONVERSATIONS': {
      const conversations: VaultConversation[] = await getAllConversations();
      return { conversations };
    }

    case 'DELETE_CONVERSATION': {
      await deleteConversation(message.id as string);
      return { success: true };
    }

    /* ── Search ── */
    case 'SEARCH': {
      const results: SearchConversationResult[] = await searchConversations(message.query as string, message.limit as number | undefined);
      return { results };
    }

    case 'SEARCH_SIMILAR': {
      try {
        const results: SimilarQuestionResult[] = await searchSimilarQuestions(message.query as string, message.limit as number | undefined);
        return { results };
      } catch (err: unknown) {
        console.error('[OogVault] Search error:', err instanceof Error ? err.message : String(err));
        return { results: [] };
      }
    }

    /* ── Tags ── */
    case 'ADD_TAG': {
      await addTag(message.conversationId as string, message.tag as string);
      return { success: true };
    }

    case 'REMOVE_TAG': {
      await removeTag(message.conversationId as string, message.tag as string);
      return { success: true };
    }

    case 'GET_TAGS': {
      const tags: string[] = await getTagsForConversation(message.conversationId as string);
      return { tags };
    }

    /* ── Export ── */
    case 'EXPORT_MARKDOWN': {
      const markdown = await exportAsMarkdown(message.conversationId as string);
      return { markdown };
    }

    case 'GENERATE_SUMMARY': {
      const summary = await generateConversationSummary(message.conversationId as string);
      return { summary };
    }

    /* ── Nuggets (Knowledge Base) ── */
    case 'GET_ALL_NUGGETS': {
      const nuggets: VaultNugget[] = await getAllNuggets();
      const classified = nuggets.map((n: VaultNugget) => ({
        ...n,
        category: n.category || classifyTopic(n.question + ' ' + (n.answer || '')),
      }));
      return { nuggets: classified };
    }

    case 'SEARCH_NUGGETS': {
      const nuggets: VaultNugget[] = await searchNuggetsText(message.query as string, message.limit as number | undefined);
      const classified = nuggets.map((n: VaultNugget) => ({
        ...n,
        category: n.category || classifyTopic(n.question + ' ' + (n.answer || '')),
      }));
      return { nuggets: classified };
    }

    case 'EXPORT_KNOWLEDGE': {
      const markdown = await exportKnowledgeMarkdown();
      return { markdown };
    }

    case 'EXPORT_KNOWLEDGE_CATEGORY': {
      const markdown = await exportKnowledgeMarkdown((message.category as string) || null);
      return { markdown };
    }

    /* ── Settings ── */
    case 'GET_SETTINGS': {
      return new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get('settings', (result: { [key: string]: unknown }): void => {
          resolve({ settings: (result.settings as VaultSettings) || {} });
        });
      });
    }

    case 'SAVE_SETTINGS': {
      return new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.set({ settings: message.settings as VaultSettings }, (): void => {
          resolve({ success: true });
        });
      });
    }

    /* ── Stats ── */
    case 'GET_STATS': {
      const stats: VaultStats = await getStats();
      return { stats };
    }

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}
