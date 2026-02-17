/**
 * OogVault Options Page — Settings and data management.
 */

(function () {
  'use strict';

  const optAutocomplete = document.getElementById('opt-autocomplete');
  const statConversations = document.getElementById('stat-conversations');
  const statMessages = document.getElementById('stat-messages');
  const btnExportAll = document.getElementById('btn-export-all');
  const btnClearAll = document.getElementById('btn-clear-all');
  const statusMsg = document.getElementById('status-msg');

  async function init() {
    await loadSettings();
    await loadStats();
    bindEvents();
  }

  async function loadSettings() {
    const resp = await sendMessage({ type: 'GET_SETTINGS' });
    const settings = resp?.settings || {};

    optAutocomplete.checked = settings.autocompleteEnabled !== false;
  }

  async function loadStats() {
    const resp = await sendMessage({ type: 'GET_STATS' });
    if (resp?.stats) {
      statConversations.textContent = resp.stats.conversations;
      statMessages.textContent = resp.stats.messages;
    }
  }

  function bindEvents() {
    optAutocomplete.addEventListener('change', saveSettings);
    btnExportAll.addEventListener('click', exportAllData);
    btnClearAll.addEventListener('click', clearAllData);
  }

  async function saveSettings() {
    const settings = {
      autocompleteEnabled: optAutocomplete.checked,
    };

    await sendMessage({ type: 'SAVE_SETTINGS', settings });
    showStatus('Settings saved');
  }

  async function exportAllData() {
    const resp = await sendMessage({ type: 'GET_ALL_CONVERSATIONS' });
    const conversations = resp?.conversations || [];

    // Fetch full data for each conversation
    const fullData = [];
    for (const conv of conversations) {
      const convResp = await sendMessage({ type: 'GET_CONVERSATION', id: conv.id });
      if (convResp?.conversation) {
        const tagsResp = await sendMessage({ type: 'GET_TAGS', conversationId: conv.id });
        fullData.push({
          ...convResp.conversation,
          tags: tagsResp?.tags || [],
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

  async function clearAllData() {
    const confirmed = confirm(
      'Are you sure you want to delete ALL saved conversations?\n\nThis cannot be undone!'
    );
    if (!confirmed) return;

    const doubleConfirm = confirm('Really delete everything? Last chance!');
    if (!doubleConfirm) return;

    const resp = await sendMessage({ type: 'GET_ALL_CONVERSATIONS' });
    const conversations = resp?.conversations || [];

    for (const conv of conversations) {
      await sendMessage({ type: 'DELETE_CONVERSATION', id: conv.id });
    }

    await loadStats();
    showStatus('All data cleared');
  }

  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  function showStatus(message) {
    statusMsg.textContent = message;
    statusMsg.classList.add('visible');
    setTimeout(() => statusMsg.classList.remove('visible'), 2000);
  }

  init();
})();
