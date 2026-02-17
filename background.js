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
} from './lib/search.js';

chrome.runtime.onInstalled.addListener(() => {
  console.log('[OogVault] Extension installed - your vault is ready 🐢');

  chrome.storage.local.get('settings', (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          autoSave: true,
          autocompleteEnabled: true,
          autocompleteMinLength: 20,
          theme: 'default',
        },
      });
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => {
      console.error('[OogVault] Message handler error:', err);
      sendResponse({ error: err.message });
    });

  return true; // keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    /* ── Conversation CRUD ── */
    case 'SAVE_CONVERSATION': {
      const conv = await saveConversation(message.conversation);

      // Automatically extract and save Knowledge Nuggets
      try {
        const msgs = message.conversation.messages || [];
        const nuggets = extractNuggets(msgs, message.conversation.platform);
        if (nuggets.length > 0) {
          await saveNuggets(message.conversation.id, nuggets);
          console.log(`[OogVault] Extracted ${nuggets.length} knowledge nuggets`);
        }
      } catch (err) {
        console.warn('[OogVault] Nugget extraction failed (non-fatal):', err.message);
      }

      return { success: true, conversation: conv };
    }

    case 'GET_CONVERSATION': {
      const conv = await getConversation(message.id);
      return { conversation: conv };
    }

    case 'GET_ALL_CONVERSATIONS': {
      const conversations = await getAllConversations();
      return { conversations };
    }

    case 'DELETE_CONVERSATION': {
      await deleteConversation(message.id);
      return { success: true };
    }

    /* ── Search ── */
    case 'SEARCH': {
      const results = await searchConversations(message.query, message.limit);
      return { results };
    }

    case 'SEARCH_SIMILAR': {
      const results = await searchSimilarQuestions(message.query, message.limit);
      return { results };
    }

    /* ── Tags ── */
    case 'ADD_TAG': {
      await addTag(message.conversationId, message.tag);
      return { success: true };
    }

    case 'REMOVE_TAG': {
      await removeTag(message.conversationId, message.tag);
      return { success: true };
    }

    case 'GET_TAGS': {
      const tags = await getTagsForConversation(message.conversationId);
      return { tags };
    }

    /* ── Export ── */
    case 'EXPORT_MARKDOWN': {
      const markdown = await exportAsMarkdown(message.conversationId);
      return { markdown };
    }

    case 'GENERATE_SUMMARY': {
      const summary = await generateConversationSummary(message.conversationId);
      return { summary };
    }

    /* ── Nuggets (Knowledge Base) ── */
    case 'GET_ALL_NUGGETS': {
      const nuggets = await getAllNuggets();
      return { nuggets };
    }

    case 'SEARCH_NUGGETS': {
      const nuggets = await searchNuggetsText(message.query, message.limit);
      return { nuggets };
    }

    case 'EXPORT_KNOWLEDGE': {
      const markdown = await exportKnowledgeMarkdown();
      return { markdown };
    }

    /* ── Settings ── */
    case 'GET_SETTINGS': {
      return new Promise((resolve) => {
        chrome.storage.local.get('settings', (result) => {
          resolve({ settings: result.settings || {} });
        });
      });
    }

    case 'SAVE_SETTINGS': {
      return new Promise((resolve) => {
        chrome.storage.local.set({ settings: message.settings }, () => {
          resolve({ success: true });
        });
      });
    }

    /* ── Stats ── */
    case 'GET_STATS': {
      const stats = await getStats();
      return { stats };
    }

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}
