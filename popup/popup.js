/**
 * OogVault Popup — Main extension interface.
 * Search, browse, and manage saved AI conversations.
 */

(function () {
  'use strict';

  /* ── State ── */

  let allConversations = [];
  let currentView = 'list'; // 'list' | 'detail' | 'knowledge'
  let currentConversationId = null;
  let activeTab = 'conversations'; // 'conversations' | 'knowledge'

  /* ── DOM Refs ── */

  const searchInput = document.getElementById('search-input');
  const viewList = document.getElementById('view-list');
  const viewDetail = document.getElementById('view-detail');
  const viewKnowledge = document.getElementById('view-knowledge');
  const convListEl = document.getElementById('conversations-list');
  const nuggetsListEl = document.getElementById('nuggets-list');
  const detailHeader = document.getElementById('detail-header');
  const detailMessages = document.getElementById('detail-messages');
  const detailTags = document.getElementById('detail-tags');
  const statsText = document.getElementById('stats-text');

  const tabConversations = document.getElementById('tab-conversations');
  const tabKnowledge = document.getElementById('tab-knowledge');
  const btnBack = document.getElementById('btn-back');
  const btnSettings = document.getElementById('btn-settings');
  const btnCopy = document.getElementById('btn-copy');
  const btnExport = document.getElementById('btn-export');
  const btnContinue = document.getElementById('btn-continue');
  const btnDelete = document.getElementById('btn-delete');
  const btnExportKnowledge = document.getElementById('btn-export-knowledge');

  /* ── Init ── */

  async function init() {
    await loadConversations();
    await updateStats();
    bindEvents();
    searchInput.focus();
  }

  /* ── Data Loading ── */

  async function loadConversations() {
    const response = await sendMessage({ type: 'GET_ALL_CONVERSATIONS' });
    allConversations = response?.conversations || [];
    renderConversationList(allConversations);
  }

  async function updateStats() {
    const response = await sendMessage({ type: 'GET_STATS' });
    if (response?.stats) {
      const s = response.stats;
      statsText.textContent = `${s.conversations} conversations · ${s.messages} messages · ${s.nuggets} nuggets`;
    }
  }

  /* ── Event Bindings ── */

  function bindEvents() {
    searchInput.addEventListener('input', onSearch);

    tabConversations.addEventListener('click', () => switchTab('conversations'));
    tabKnowledge.addEventListener('click', () => switchTab('knowledge'));

    btnBack.addEventListener('click', showListView);
    btnSettings.addEventListener('click', openSettings);
    btnCopy.addEventListener('click', copyConversation);
    btnExport.addEventListener('click', exportConversation);
    btnContinue.addEventListener('click', continueConversation);
    btnDelete.addEventListener('click', deleteConversation);
    btnExportKnowledge.addEventListener('click', exportKnowledge);
  }

  /* ── Search ── */

  let searchTimer = null;

  function onSearch() {
    const query = searchInput.value.trim();

    if (searchTimer) clearTimeout(searchTimer);

    if (activeTab === 'knowledge') {
      searchTimer = setTimeout(() => loadNuggets(query), 250);
      return;
    }

    if (query.length === 0) {
      renderConversationList(allConversations);
      return;
    }

    searchTimer = setTimeout(async () => {
      const response = await sendMessage({ type: 'SEARCH', query, limit: 30 });
      if (response?.results) {
        renderSearchResults(response.results);
      }
    }, 250);
  }

  /* ── Render: Conversation List ── */

  function renderConversationList(conversations) {
    if (conversations.length === 0) {
      convListEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <span style="font-size:28px">🐢</span>
          </div>
          <div class="empty-state-title">Your vault is empty</div>
          <div class="empty-state-text">
            Visit Claude or ChatGPT and start chatting.
            OogVault will save your conversations.
          </div>
        </div>
      `;
      return;
    }

    const grouped = groupByDate(conversations);
    let html = '';

    for (const [label, convs] of Object.entries(grouped)) {
      html += `<div class="date-group">`;
      html += `<div class="date-label">${escapeHtml(label)}</div>`;

      for (const conv of convs) {
        html += renderConvCard(conv);
      }

      html += `</div>`;
    }

    convListEl.innerHTML = html;

    convListEl.querySelectorAll('.conv-card').forEach((card) => {
      card.addEventListener('click', () => {
        showDetailView(card.dataset.id);
      });
    });
  }

  function renderSearchResults(results) {
    if (results.length === 0) {
      convListEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div class="empty-state-title">No results found</div>
          <div class="empty-state-text">
            Try different keywords or check your spelling.
          </div>
        </div>
      `;
      return;
    }

    let html = '';
    for (const result of results) {
      html += renderConvCard(result, result.matchedContent);
    }

    convListEl.innerHTML = html;

    convListEl.querySelectorAll('.conv-card').forEach((card) => {
      card.addEventListener('click', () => {
        showDetailView(card.dataset.id);
      });
    });
  }

  function renderConvCard(conv, matchedContent) {
    const platformLabel = conv.platform === 'claude' ? 'C' : 'G';
    const platformClass = conv.platform === 'claude' ? 'claude' : 'chatgpt';
    const timeStr = formatTime(conv.updated_at || conv.created_at);

    return `
      <div class="conv-card" data-id="${conv.id}">
        <div class="conv-platform conv-platform--${platformClass}">${platformLabel}</div>
        <div class="conv-info">
          <div class="conv-title">${escapeHtml(conv.title)}</div>
          <div class="conv-meta">
            <span class="conv-platform-name">${conv.platform}</span>
            <span>·</span>
            <span>${timeStr}</span>
          </div>
          ${matchedContent ? `<div class="conv-match">${escapeHtml(matchedContent.substring(0, 100))}</div>` : ''}
        </div>
      </div>
    `;
  }

  /* ── Render: Detail View ── */

  async function showDetailView(conversationId) {
    currentConversationId = conversationId;
    currentView = 'detail';

    viewList.style.display = 'none';
    viewKnowledge.style.display = 'none';
    viewDetail.style.display = 'block';
    document.querySelector('.search-bar').style.display = 'none';

    const response = await sendMessage({ type: 'GET_CONVERSATION', id: conversationId });
    if (!response?.conversation) {
      showToast('Conversation not found');
      showListView();
      return;
    }

    const conv = response.conversation;
    const messages = conv.messages || [];

    detailHeader.innerHTML = `
      <div class="detail-title">${escapeHtml(conv.title)}</div>
      <div class="detail-meta">
        ${conv.platform} · ${new Date(conv.created_at).toLocaleString()}
        ${conv.url ? ` · <a href="${conv.url}" target="_blank" style="color: var(--oog-green-light);">Open original</a>` : ''}
      </div>
    `;

    detailMessages.innerHTML = messages
      .map(
        (m) => `
        <div class="msg-bubble msg-bubble--${m.role}">
          <span class="msg-role">${m.role === 'user' ? 'You' : 'Assistant'}</span>
          <div class="msg-content">${escapeHtml(m.content)}</div>
        </div>
      `
      )
      .join('');

    // Load tags
    const tagsResp = await sendMessage({ type: 'GET_TAGS', conversationId });
    renderTags(tagsResp?.tags || []);
  }

  function renderTags(tags) {
    let html = tags
      .map(
        (tag) => `
        <span class="tag">
          ${escapeHtml(tag)}
          <button class="tag-remove" data-tag="${escapeHtml(tag)}" title="Remove tag">&times;</button>
        </span>
      `
      )
      .join('');

    html += `<button class="tag-add-btn" id="btn-add-tag">+ Add Tag</button>`;

    detailTags.innerHTML = html;

    detailTags.querySelectorAll('.tag-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await sendMessage({
          type: 'REMOVE_TAG',
          conversationId: currentConversationId,
          tag: btn.dataset.tag,
        });
        const resp = await sendMessage({ type: 'GET_TAGS', conversationId: currentConversationId });
        renderTags(resp?.tags || []);
      });
    });

    document.getElementById('btn-add-tag')?.addEventListener('click', () => {
      const tag = prompt('Enter a tag:');
      if (tag && tag.trim()) {
        sendMessage({
          type: 'ADD_TAG',
          conversationId: currentConversationId,
          tag: tag.trim(),
        }).then(async () => {
          const resp = await sendMessage({
            type: 'GET_TAGS',
            conversationId: currentConversationId,
          });
          renderTags(resp?.tags || []);
        });
      }
    });
  }

  /* ── Tab Switching ── */

  function switchTab(tab) {
    activeTab = tab;

    tabConversations.classList.toggle('tab--active', tab === 'conversations');
    tabKnowledge.classList.toggle('tab--active', tab === 'knowledge');

    viewList.style.display = 'none';
    viewDetail.style.display = 'none';
    viewKnowledge.style.display = 'none';
    document.querySelector('.search-bar').style.display = 'block';

    if (tab === 'conversations') {
      viewList.style.display = 'block';
      searchInput.placeholder = 'Search your vault...';
      currentView = 'list';
    } else if (tab === 'knowledge') {
      viewKnowledge.style.display = 'block';
      searchInput.placeholder = 'Search knowledge nuggets...';
      currentView = 'knowledge';
      loadNuggets();
    }

    searchInput.value = '';
    searchInput.focus();
  }

  /* ── Knowledge Base ── */

  async function loadNuggets(query) {
    let response;
    if (query && query.trim().length > 0) {
      response = await sendMessage({ type: 'SEARCH_NUGGETS', query, limit: 50 });
    } else {
      response = await sendMessage({ type: 'GET_ALL_NUGGETS' });
    }

    const nuggets = response?.nuggets || [];
    renderNuggets(nuggets);
  }

  function renderNuggets(nuggets) {
    if (nuggets.length === 0) {
      nuggetsListEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </div>
          <div class="empty-state-title">No knowledge yet</div>
          <div class="empty-state-text">
            Save conversations and OogVault will extract Q&A pairs as knowledge nuggets.
          </div>
        </div>
      `;
      return;
    }

    nuggetsListEl.innerHTML = nuggets
      .map(
        (n) => `
      <div class="nugget-card">
        <div class="nugget-question">
          <span class="nugget-q-label">Q</span>
          ${escapeHtml(n.question)}
        </div>
        <div class="nugget-answer">
          <span class="nugget-a-label">A</span>
          ${escapeHtml(n.answer)}
        </div>
        <div class="nugget-meta">
          <span class="nugget-platform">${n.platform || ''}</span>
          <span>${formatTime(n.created_at)}</span>
        </div>
      </div>
    `
      )
      .join('');
  }

  async function exportKnowledge() {
    btnExportKnowledge.textContent = 'Exporting...';
    btnExportKnowledge.disabled = true;

    const response = await sendMessage({ type: 'EXPORT_KNOWLEDGE' });

    if (response?.markdown) {
      const blob = new Blob([response.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'oogvault-knowledge.md';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Knowledge exported as Markdown!');
    } else {
      showToast('No knowledge to export yet.');
    }

    btnExportKnowledge.textContent = 'Export .md';
    btnExportKnowledge.disabled = false;
  }

  function showListView() {
    currentView = 'list';
    currentConversationId = null;

    viewDetail.style.display = 'none';
    viewKnowledge.style.display = 'none';
    viewList.style.display = 'block';
    document.querySelector('.search-bar').style.display = 'block';

    switchTab('conversations');
    searchInput.focus();
  }

  /* ── Actions ── */

  async function copyConversation() {
    if (!currentConversationId) return;

    const response = await sendMessage({ type: 'GET_CONVERSATION', id: currentConversationId });
    if (!response?.conversation) return;

    const messages = response.conversation.messages || [];
    const text = messages
      .map((m) => `${m.role === 'user' ? 'You' : 'Assistant'}:\n${m.content}`)
      .join('\n\n---\n\n');

    await navigator.clipboard.writeText(text);
    showToast('Conversation copied!');
  }

  async function exportConversation() {
    if (!currentConversationId) return;

    const response = await sendMessage({
      type: 'EXPORT_MARKDOWN',
      conversationId: currentConversationId,
    });

    if (response?.markdown) {
      const blob = new Blob([response.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oogvault-${currentConversationId}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported as Markdown!');
    }
  }

  async function continueConversation() {
    if (!currentConversationId) return;

    const response = await sendMessage({
      type: 'GENERATE_SUMMARY',
      conversationId: currentConversationId,
    });

    if (response?.summary) {
      await navigator.clipboard.writeText(response.summary);
      showToast('Summary copied — paste it into a new chat!');
    }
  }

  async function deleteConversation() {
    if (!currentConversationId) return;

    const confirmed = confirm('Delete this conversation from your vault?');
    if (!confirmed) return;

    await sendMessage({ type: 'DELETE_CONVERSATION', id: currentConversationId });
    showToast('Conversation deleted');
    await loadConversations();
    await updateStats();
    showListView();
  }

  function openSettings() {
    chrome.runtime.openOptionsPage();
  }

  /* ── Helpers ── */

  function sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[OogVault Popup] Error:', chrome.runtime.lastError.message);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  function groupByDate(conversations) {
    const groups = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    for (const conv of conversations) {
      const date = new Date(conv.updated_at || conv.created_at);
      let label;

      if (date >= today) {
        label = 'Today';
      } else if (date >= yesterday) {
        label = 'Yesterday';
      } else if (date >= weekAgo) {
        label = 'This Week';
      } else {
        label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }

      if (!groups[label]) groups[label] = [];
      groups[label].push(conv);
    }

    return groups;
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2500);
  }

  /* ── Start ── */

  init();
})();
