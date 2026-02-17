/**
 * OogVault IndexedDB Database Layer
 * Manages persistent storage for conversations, messages, and tags.
 * Built for Manifest V3 service workers: handles connection drops,
 * service worker restarts, and stale DB references gracefully.
 */

const DB_NAME = 'oogvault';
const DB_VERSION = 2;

let dbInstance = null;

/**
 * Request persistent storage so the browser won't evict our data
 * under storage pressure. Called once on first DB open.
 */
let persistRequested = false;
async function requestPersistence() {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (navigator.storage && navigator.storage.persist) {
      const granted = await navigator.storage.persist();
      console.log(`[OogVault] Persistent storage: ${granted ? 'granted' : 'denied'}`);
    }
  } catch (e) {
    // Not critical, just means data could be evicted under extreme pressure
  }
}

/**
 * Check if a DB connection is still usable.
 * Connections can go stale when the service worker hibernates.
 */
function isConnectionAlive(db) {
  try {
    // Attempting to start a transaction on a closed DB throws
    const tx = db.transaction('conversations', 'readonly');
    tx.abort();
    return true;
  } catch (e) {
    return false;
  }
}

function openDB() {
  // Reuse existing connection only if it's still alive
  if (dbInstance && isConnectionAlive(dbInstance)) {
    return Promise.resolve(dbInstance);
  }

  // Clear stale reference
  dbInstance = null;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('conversations')) {
        const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
        convStore.createIndex('platform', 'platform', { unique: false });
        convStore.createIndex('created_at', 'created_at', { unique: false });
        convStore.createIndex('updated_at', 'updated_at', { unique: false });
      }

      if (!db.objectStoreNames.contains('messages')) {
        const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
        msgStore.createIndex('conversation_id', 'conversation_id', { unique: false });
        msgStore.createIndex('role', 'role', { unique: false });
      }

      if (!db.objectStoreNames.contains('tags')) {
        const tagStore = db.createObjectStore('tags', { keyPath: 'id' });
        tagStore.createIndex('conversation_id', 'conversation_id', { unique: false });
        tagStore.createIndex('tag', 'tag', { unique: false });
      }

      // v2: Knowledge Nuggets — distilled Q&A pairs from conversations
      if (!db.objectStoreNames.contains('nuggets')) {
        const nuggetStore = db.createObjectStore('nuggets', { keyPath: 'id' });
        nuggetStore.createIndex('conversation_id', 'conversation_id', { unique: false });
        nuggetStore.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;

      // Auto-clear stale reference if browser closes the connection
      dbInstance.onclose = () => {
        console.log('[OogVault] DB connection closed by browser, will reconnect');
        dbInstance = null;
      };

      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
      };

      // Request persistent storage on first open
      requestPersistence();

      console.log('[OogVault] DB connection opened successfully');
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('[OogVault] DB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

function generateId() {
  return crypto.randomUUID();
}

/* ── Conversations ── */

export async function saveConversation(conversation) {
  const db = await openDB();
  const now = new Date().toISOString();

  const tx = db.transaction(['conversations', 'messages'], 'readwrite');
  const convStore = tx.objectStore('conversations');
  const msgStore = tx.objectStore('messages');

  const convRecord = {
    id: conversation.id,
    platform: conversation.platform,
    title: conversation.title || 'Untitled conversation',
    created_at: conversation.created_at || now,
    updated_at: now,
    is_auto_saved: conversation.is_auto_saved !== undefined ? conversation.is_auto_saved : 1,
    url: conversation.url || '',
  };

  convStore.put(convRecord);

  // Delete existing messages for this conversation before re-inserting
  const existingMsgs = msgStore.index('conversation_id').openCursor(IDBKeyRange.only(conversation.id));

  await new Promise((resolve, reject) => {
    existingMsgs.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    existingMsgs.onerror = () => reject(existingMsgs.error);
  });

  for (const msg of (conversation.messages || [])) {
    msgStore.put({
      id: msg.id || generateId(),
      conversation_id: conversation.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp || now,
    });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(convRecord);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getConversation(id) {
  const db = await openDB();
  const tx = db.transaction(['conversations', 'messages'], 'readonly');
  const convStore = tx.objectStore('conversations');
  const msgStore = tx.objectStore('messages');

  const conversation = await new Promise((resolve, reject) => {
    const req = convStore.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!conversation) return null;

  const messages = await new Promise((resolve, reject) => {
    const msgs = [];
    const req = msgStore.index('conversation_id').openCursor(IDBKeyRange.only(id));
    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        msgs.push(cursor.value);
        cursor.continue();
      } else {
        resolve(msgs.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
      }
    };
    req.onerror = () => reject(req.error);
  });

  return { ...conversation, messages };
}

export async function getAllConversations() {
  const db = await openDB();
  const tx = db.transaction('conversations', 'readonly');
  const store = tx.objectStore('conversations');

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const conversations = req.result.sort(
        (a, b) => b.updated_at.localeCompare(a.updated_at)
      );
      resolve(conversations);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteConversation(id) {
  const db = await openDB();
  const tx = db.transaction(['conversations', 'messages', 'tags', 'nuggets'], 'readwrite');

  tx.objectStore('conversations').delete(id);

  // Delete associated messages
  const msgIndex = tx.objectStore('messages').index('conversation_id');
  const msgCursor = msgIndex.openCursor(IDBKeyRange.only(id));
  await new Promise((resolve) => {
    msgCursor.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
  });

  // Delete associated tags
  const tagIndex = tx.objectStore('tags').index('conversation_id');
  const tagCursor = tagIndex.openCursor(IDBKeyRange.only(id));
  await new Promise((resolve) => {
    tagCursor.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
  });

  // Delete associated nuggets
  const nuggetIndex = tx.objectStore('nuggets').index('conversation_id');
  const nuggetCursor = nuggetIndex.openCursor(IDBKeyRange.only(id));
  await new Promise((resolve) => {
    nuggetCursor.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/* ── Messages ── */

export async function getMessagesForConversation(conversationId) {
  const db = await openDB();
  const tx = db.transaction('messages', 'readonly');
  const index = tx.objectStore('messages').index('conversation_id');

  return new Promise((resolve, reject) => {
    const msgs = [];
    const req = index.openCursor(IDBKeyRange.only(conversationId));
    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        msgs.push(cursor.value);
        cursor.continue();
      } else {
        resolve(msgs.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getAllMessages() {
  const db = await openDB();
  const tx = db.transaction('messages', 'readonly');
  const store = tx.objectStore('messages');

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ── Tags ── */

export async function addTag(conversationId, tag) {
  const db = await openDB();
  const tx = db.transaction('tags', 'readwrite');
  const store = tx.objectStore('tags');

  store.put({
    id: generateId(),
    conversation_id: conversationId,
    tag: tag.toLowerCase().trim(),
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeTag(conversationId, tag) {
  const db = await openDB();
  const tx = db.transaction('tags', 'readwrite');
  const store = tx.objectStore('tags');
  const index = store.index('conversation_id');

  const cursor = index.openCursor(IDBKeyRange.only(conversationId));
  await new Promise((resolve) => {
    cursor.onsuccess = (event) => {
      const c = event.target.result;
      if (c) {
        if (c.value.tag === tag.toLowerCase().trim()) {
          c.delete();
        }
        c.continue();
      } else {
        resolve();
      }
    };
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getTagsForConversation(conversationId) {
  const db = await openDB();
  const tx = db.transaction('tags', 'readonly');
  const index = tx.objectStore('tags').index('conversation_id');

  return new Promise((resolve, reject) => {
    const tags = [];
    const req = index.openCursor(IDBKeyRange.only(conversationId));
    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        tags.push(cursor.value.tag);
        cursor.continue();
      } else {
        resolve(tags);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/* ── Nuggets (Knowledge Q&A Pairs) ── */

export async function saveNuggets(conversationId, nuggets) {
  const db = await openDB();
  const tx = db.transaction('nuggets', 'readwrite');
  const store = tx.objectStore('nuggets');

  // Clear existing nuggets for this conversation
  const index = store.index('conversation_id');
  const cursor = index.openCursor(IDBKeyRange.only(conversationId));
  await new Promise((resolve) => {
    cursor.onsuccess = (event) => {
      const c = event.target.result;
      if (c) {
        c.delete();
        c.continue();
      } else {
        resolve();
      }
    };
  });

  const now = new Date().toISOString();
  for (const nugget of nuggets) {
    store.put({
      id: nugget.id || generateId(),
      conversation_id: conversationId,
      question: nugget.question,
      answer: nugget.answer,
      platform: nugget.platform || '',
      created_at: nugget.created_at || now,
    });
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllNuggets() {
  const db = await openDB();
  const tx = db.transaction('nuggets', 'readonly');
  const store = tx.objectStore('nuggets');

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const nuggets = req.result.sort(
        (a, b) => b.created_at.localeCompare(a.created_at)
      );
      resolve(nuggets);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function searchNuggets(query) {
  if (!query || query.trim().length === 0) return [];

  const nuggets = await getAllNuggets();
  const lower = query.toLowerCase();

  return nuggets.filter((n) =>
    n.question.toLowerCase().includes(lower) ||
    n.answer.toLowerCase().includes(lower)
  );
}

export async function deleteNuggetsForConversation(conversationId) {
  const db = await openDB();
  const tx = db.transaction('nuggets', 'readwrite');
  const store = tx.objectStore('nuggets');
  const index = store.index('conversation_id');

  const cursor = index.openCursor(IDBKeyRange.only(conversationId));
  await new Promise((resolve) => {
    cursor.onsuccess = (event) => {
      const c = event.target.result;
      if (c) {
        c.delete();
        c.continue();
      } else {
        resolve();
      }
    };
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

/* ── Stats ── */

export async function getStats() {
  const db = await openDB();
  const tx = db.transaction(['conversations', 'messages', 'nuggets'], 'readonly');

  const convCount = await new Promise((resolve, reject) => {
    const req = tx.objectStore('conversations').count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const msgCount = await new Promise((resolve, reject) => {
    const req = tx.objectStore('messages').count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const nuggetCount = await new Promise((resolve, reject) => {
    const req = tx.objectStore('nuggets').count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return { conversations: convCount, messages: msgCount, nuggets: nuggetCount };
}
