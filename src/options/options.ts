/**
 * OogVault Options Page — Settings and data management.
 */

(function () {
  'use strict';

  const optAutocomplete = document.getElementById('opt-autocomplete') as HTMLInputElement;
  const statConversations = document.getElementById('stat-conversations') as HTMLElement;
  const statMessages = document.getElementById('stat-messages') as HTMLElement;
  const btnExportDesktop = document.getElementById('btn-export-desktop') as HTMLButtonElement;
  const btnExportAll = document.getElementById('btn-export-all') as HTMLButtonElement;
  const btnClearAll = document.getElementById('btn-clear-all') as HTMLButtonElement;
  const statusMsg = document.getElementById('status-msg') as HTMLElement;

  async function init(): Promise<void> {
    await loadSettings();
    await loadStats();
    bindEvents();
  }

  async function loadSettings(): Promise<void> {
    const resp = await sendMessage({ type: 'GET_SETTINGS' });
    const settings = (resp?.settings as VaultSettings | undefined) || {};

    optAutocomplete.checked = settings.autocompleteEnabled !== false;
  }

  async function loadStats(): Promise<void> {
    const resp = await sendMessage({ type: 'GET_STATS' });
    if (resp?.stats) {
      const s = resp.stats as VaultStats;
      statConversations.textContent = String(s.conversations);
      statMessages.textContent = String(s.messages);
    }
  }

  function bindEvents(): void {
    optAutocomplete.addEventListener('change', saveSettings);
    btnExportDesktop.addEventListener('click', exportForDesktop);
    btnExportAll.addEventListener('click', exportAllData);
    btnClearAll.addEventListener('click', clearAllData);
  }

  async function saveSettings(): Promise<void> {
    const settings: VaultSettings = {
      autocompleteEnabled: optAutocomplete.checked,
    };

    await sendMessage({ type: 'SAVE_SETTINGS', settings });
    showStatus('Settings saved');
  }

  async function exportForDesktop(): Promise<void> {
    btnExportDesktop.disabled = true;
    showStatus('Preparing export…');

    const resp = await sendMessage({ type: 'GET_ALL_CONVERSATIONS' });
    const conversations = (resp?.conversations as VaultConversation[] | undefined) || [];

    const fullConversations: Array<VaultConversation & { tags: string[] }> = [];
    for (const conv of conversations) {
      const convResp = await sendMessage({ type: 'GET_CONVERSATION', id: conv.id });
      if (convResp?.conversation) {
        const tagsResp = await sendMessage({ type: 'GET_TAGS', conversationId: conv.id });
        fullConversations.push({
          ...(convResp.conversation as VaultConversation),
          tags: (tagsResp?.tags as string[] | undefined) || [],
        });
      }
    }

    const nuggetsResp = await sendMessage({ type: 'GET_ALL_NUGGETS' });
    const nuggets = (nuggetsResp?.nuggets as VaultNugget[] | undefined) || [];

    const payload = JSON.stringify({ conversations: fullConversations, nuggets }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oogvault-desktop-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showStatus(`Exported ${fullConversations.length} conversations + ${nuggets.length} nuggets`);
    btnExportDesktop.disabled = false;
  }

  async function exportAllData(): Promise<void> {
    const resp = await sendMessage({ type: 'GET_ALL_CONVERSATIONS' });
    const conversations = (resp?.conversations as VaultConversation[] | undefined) || [];

    const fullData: Array<VaultConversation & { tags: string[] }> = [];
    for (const conv of conversations) {
      const convResp = await sendMessage({ type: 'GET_CONVERSATION', id: conv.id });
      if (convResp?.conversation) {
        const tagsResp = await sendMessage({ type: 'GET_TAGS', conversationId: conv.id });
        fullData.push({
          ...(convResp.conversation as VaultConversation),
          tags: (tagsResp?.tags as string[] | undefined) || [],
        });
      }
    }

    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oogvault-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showStatus(`Exported ${fullData.length} conversations`);
  }

  async function clearAllData(): Promise<void> {
    const confirmed = confirm(
      'Are you sure you want to delete ALL saved conversations?\n\nThis cannot be undone!'
    );
    if (!confirmed) return;

    const doubleConfirm = confirm('Really delete everything? Last chance!');
    if (!doubleConfirm) return;

    const resp = await sendMessage({ type: 'GET_ALL_CONVERSATIONS' });
    const conversations = (resp?.conversations as VaultConversation[] | undefined) || [];

    for (const conv of conversations) {
      await sendMessage({ type: 'DELETE_CONVERSATION', id: conv.id });
    }

    await loadStats();
    showStatus('All data cleared');
  }

  function sendMessage(message: VaultRequest): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response?: Record<string, unknown>) => {
        if (chrome.runtime.lastError) {
          console.warn('[OogVault Options] Error:', chrome.runtime.lastError.message);
          resolve(null);
        } else {
          resolve(response ?? null);
        }
      });
    });
  }

  function showStatus(message: string): void {
    statusMsg.textContent = message;
    statusMsg.classList.add('visible');
    setTimeout(() => statusMsg.classList.remove('visible'), 2000);
  }

  init();
})();
