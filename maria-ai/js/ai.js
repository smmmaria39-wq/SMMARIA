
import {
  getMariaIdentity,
  checkMariaAiConnection
} from './ai-auth.js';

import * as historyStore from './ai-history.js';

import { askMaria } from './ai-engine.js';

import { renderNavigationCards } from './ai-navigation.js';

import { renderSuggestions } from './ai-suggestions.js';

const $ = id => document.getElementById(id);

// =============================================
// APPLICATION STATE
// =============================================

const state = {
  messages: [],
  conversationId: null,
  busy: false,
  consent: false,
  historyUnsub: null,
  identity: null,
  connected: false
};

// =============================================
// SECURITY
// =============================================

const escapeHtml = value =>
  String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

// =============================================
// TOAST NOTIFICATIONS
// =============================================

function toast(message) {
  const element = $('aiToast');

  if (!element) return;

  element.textContent = message;
  element.classList.add('show');

  window.setTimeout(() => {
    element.classList.remove('show');
  }, 2800);
}

// =============================================
// CONNECTION STATUS
// =============================================

function updateConnectionStatus(status, message) {
  const dot = $('aiStatusDot');
  const label = $('aiConnectionLabel');

  if (dot) {
    dot.dataset.status = status;

    dot.classList.remove(
      'connected',
      'disconnected',
      'connecting'
    );

    dot.classList.add(status);
  }

  if (label) {
    label.textContent = message;
  }

  state.connected = status === 'connected';
}

// =============================================
// LOADING STATE
// =============================================

function setBusy(busy) {
  state.busy = busy;

  if ($('sendBtn')) {
    $('sendBtn').disabled = busy;
  }

  if ($('messageInput')) {
    $('messageInput').disabled = busy;
  }
}

// =============================================
// MESSAGE FORMATTING
// =============================================

function isImageUrl(url) {
  return /\.(?:png|jpe?g|gif|webp|avif|svg)(?:[?#]|$)/i.test(url) ||
    /imagekit\.io|cloudinary\.com|images\.unsplash\.com/i.test(url);
}

function renderImage(url, alt = 'Related image') {
  const safe = String(url || '').trim();
  if (!/^https:\/\/[^\s"'<>]+$/i.test(safe)) return '';
  return `<figure class="ai-answer-image">
    <a href="${safe}" target="_blank" rel="noopener noreferrer">
      <img src="${safe}" alt="${escapeHtml(alt)}" loading="lazy" />
    </a>
    <figcaption>${escapeHtml(alt)}</figcaption>
  </figure>`;
}

function formatText(value) {
  const lines = String(value ?? '').split(/\r?\n/);
  const output = [];
  let tableRows = [];

  const flushTable = () => {
    if (!tableRows.length) return;
    const cells = row => row.trim().replace(/^\|/, '').replace(/\|$/, '')
      .split('|').map(cell => cell.trim());
    const rows = tableRows.map(cells);
    const header = rows[0] || [];
    const body = rows.slice(1).filter(row =>
      !row.every(cell => /^:?-{3,}:?$/.test(cell))
    );
    output.push(`<div class="ai-table-wrap"><table class="ai-answer-table"><thead><tr>${
      header.map(cell => `<th>${formatInline(cell)}</th>`).join('')
    }</tr></thead><tbody>${
      body.filter(row => !row.every(cell => /^:?-{3,}:?$/.test(cell)))
        .map(row => `<tr>${header.map((_, i) =>
          `<td>${formatInline(row[i] || '')}</td>`).join('')}</tr>`).join('')
    }</tbody></table></div>`);
    tableRows = [];
  };

  for (const line of lines) {
    if (/^\s*\|.*\|\s*$/.test(line)) {
      tableRows.push(line);
      continue;
    }
    flushTable();
    if (!line.trim()) {
      output.push('<div class="ai-answer-spacer"></div>');
    } else {
      output.push(`<div class="ai-answer-line">${formatInline(line)}</div>`);
    }
  }
  flushTable();
  return output.join('');
}

function formatInline(value) {
  let text = escapeHtml(value);

  // Protect markdown image markup while linkifying ordinary URLs.
  const imageMarkup = [];
  text = text.replace(/!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)/gi,
    (_, alt, url) => {
      const token = `@@MARIA_IMAGE_${imageMarkup.length}@@`;
      imageMarkup.push(renderImage(url, alt || 'Related image'));
      return token;
    });

  // Render direct image URLs (including ImageKit URLs) as visible images.
  text = text.replace(/https:\/\/[^\s<>"']+/gi, url => {
    const clean = url.replace(/[.,;!?]+$/, '');
    const suffix = url.slice(clean.length);
    if (isImageUrl(clean)) {
      return renderImage(clean) + escapeHtml(suffix);
    }
    return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>${escapeHtml(suffix)}`;
  });

  text = text.replace(/@@MARIA_IMAGE_(\\d+)@@/g,
    (_, index) => imageMarkup[Number(index)] || '');

  text = text
    .replace(/^### (.*)$/,'<strong>$1</strong>')
    .replace(/^## (.*)$/,'<strong>$1</strong>')
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/^\s*[-*]\s+/, '• ');

  return text;
}

function renderAnswerExtras(node, result) {
  const bubble = node?.querySelector('.ai-bubble');
  if (!bubble) return;

  const images = Array.isArray(result?.images) ? result.images : [];
  const cards = Array.isArray(result?.cards) ? result.cards : [];

  images.forEach((item, index) => {
    const url = typeof item === 'string'
      ? item
      : item?.url || item?.imageUrl || item?.src;
    const alt = typeof item === 'object'
      ? item.alt || item.title || `Related image ${index + 1}`
      : `Related image ${index + 1}`;
    const markup = renderImage(url, alt);
    if (markup) bubble.insertAdjacentHTML('beforeend', markup);
  });

  if (cards.length) {
    const wrap = document.createElement('div');
    wrap.className = 'ai-answer-cards';
    cards.forEach(card => {
      if (!card || typeof card !== 'object') return;
      const title = card.title || card.name || '';
      const description = card.description || card.subtitle || card.text || '';
      const detail = card.detail || card.value || '';
      if (!title && !description && !detail) return;
      const element = document.createElement('section');
      element.className = 'ai-answer-card';
      element.innerHTML = `${title ? `<strong>${escapeHtml(title)}</strong>` : ''}${
        description ? `<p>${escapeHtml(description)}</p>` : ''
      }${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
      wrap.appendChild(element);
    });
    if (wrap.childElementCount) bubble.appendChild(wrap);
  }
}

// =============================================
// SCROLLING
// =============================================

function scrollToLatest() {
  const stage = $('chatStage');

  if (stage) {
    stage.scrollTop = stage.scrollHeight;
  }
}

// =============================================
// RENDER CHAT MESSAGE
// =============================================

function renderMessage(role, content, actions = true) {
  const article = document.createElement('article');

  article.className = `ai-message ${role}`;

  const avatar = role === 'assistant' ? 'M' : 'U';

  const time = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  article.innerHTML = `
    <div class="ai-message-avatar">${avatar}</div>

    <div class="ai-message-body">

      <div class="ai-message-meta">
        ${role === 'assistant' ? 'MARIA AI' : 'YOU'} · ${time}
      </div>

      <div class="ai-bubble">
        ${role === 'assistant'
          ? formatText(content)
          : escapeHtml(content)}
      </div>

      ${role === 'assistant' && actions ? `
        <div class="ai-message-actions">
          <button type="button" data-copy>Copy</button>
          <button type="button" data-regenerate>Regenerate</button>
        </div>
      ` : ''}

      <div class="ai-nav-cards"></div>

    </div>
  `;

  $('messages')?.appendChild(article);

  scrollToLatest();

  return article;
}

// =============================================
// WELCOME PANEL
// =============================================

function showWelcome(show) {
  if ($('welcomePanel')) {
    $('welcomePanel').hidden = !show;
  }
}

// =============================================
// CHAT MANAGEMENT
// =============================================

function clearChat() {
  state.messages = [];
  state.conversationId = null;

  $('messages')?.replaceChildren();

  showWelcome(true);
}

function startNewChat() {
  if (state.busy) return;

  clearChat();

  $('messageInput')?.focus();
}

// =============================================
// CONVERSATION SAVING
// =============================================

async function saveIfAllowed(role, content) {
  if (!state.consent || !state.conversationId) return;

  await historyStore.saveMessage(
    state.conversationId,
    {
      role,
      content
    }
  );
}

// =============================================
// PENDING MESSAGE
// =============================================

function showPendingMessage() {
  const pending = renderMessage('assistant', '');

  const bubble = pending.querySelector('.ai-bubble');

  if (bubble) {
    bubble.innerHTML = `
      <span class="ai-typing">
        <i></i>
        <i></i>
        <i></i>
      </span>
    `;
  }

  return pending;
}

// =============================================
// ERROR HANDLING
// =============================================

function showRequestError(pending, error) {
  const message =
    error?.message ||
    'Maria AI could not complete that request. Please try again.';

  const bubble = pending?.querySelector('.ai-bubble');

  if (bubble) {
    bubble.textContent = message;
  }

  updateConnectionStatus(
    'disconnected',
    'Connection issue · See error below'
  );

  toast('Maria AI could not respond. Please try again.');

  console.error('Maria AI request failed:', error);
}

// =============================================
// SEND MESSAGE TO MARIA AI
// =============================================

async function submitMessage(value) {
  const text = String(value || '').trim();

  if (!text || state.busy) return;

  showWelcome(false);

  state.messages.push({
    role: 'user',
    content: text
  });

  renderMessage('user', text);

  const input = $('messageInput');

  if (input) {
    input.value = '';
    autoResize();
  }

  // Create conversation only when saving is enabled.
  if (state.consent && !state.conversationId) {
    try {
      state.conversationId =
        await historyStore.createConversation(
          text.slice(0, 90)
        );

    } catch (error) {
      console.warn(
        'Could not create saved conversation:',
        error
      );

      toast(
        'Chat saving is temporarily unavailable. Your message can still be sent.'
      );
    }
  }

  // Save user message when consent is enabled.
  try {
    if (state.consent) {
      await saveIfAllowed('user', text);
    }
  } catch (error) {
    console.warn('Could not save user message:', error);

    toast(
      'Your message could not be saved, but Maria AI will still receive it.'
    );
  }

  const pending = showPendingMessage();

  setBusy(true);

  updateConnectionStatus(
    'connecting',
    'Checking Maria AI connection…'
  );

  try {
    // Check the dedicated AI backend before sending.
    await checkMariaAiConnection();

    updateConnectionStatus(
      'connecting',
      'Maria AI is online · Sending message…'
    );

    const result = await askMaria(
      text,

      state.messages.slice(0, -1),

      partial => {
        const bubble = pending.querySelector('.ai-bubble');

        if (bubble) {
          bubble.innerHTML = formatText(partial);
        }

        scrollToLatest();
      },

      state.conversationId
    );

    const bubble = pending.querySelector('.ai-bubble');

    if (bubble) {
      bubble.innerHTML = formatText(result.text);
    }
    renderAnswerExtras(pending, result);

    // Render suggested navigation cards.
    renderNavigationCards(
      pending.querySelector('.ai-nav-cards'),
      result.pages
    );

    if (result.conversationId) {
      state.conversationId = result.conversationId;
    }

    state.messages.push({
      role: 'assistant',
      content: result.text
    });

    updateConnectionStatus(
      'connected',
      'Connected to Maria AI'
    );

    // Save assistant response.
    try {
      await saveIfAllowed('assistant', result.text);
    } catch (error) {
      console.warn(
        'Could not save assistant response:',
        error
      );
    }

    bindMessageActions(pending, result.text);

  } catch (error) {
    showRequestError(pending, error);

  } finally {
    setBusy(false);

    $('messageInput')?.focus();

    scrollToLatest();
  }
}

// =============================================
// MESSAGE ACTIONS
// =============================================

function bindMessageActions(node, content) {
  node.querySelector('[data-copy]')?.addEventListener(
    'click',
    async () => {
      try {
        await navigator.clipboard.writeText(content);

        toast('Response copied.');

      } catch {
        toast('Could not copy this response on your device.');
      }
    }
  );

  node.querySelector('[data-regenerate]')?.addEventListener(
    'click',
    regenerate
  );
}

// =============================================
// REGENERATE RESPONSE
// =============================================

async function regenerate() {
  if (state.busy || !state.messages.length) return;

  const last = state.messages[state.messages.length - 1];

  if (last.role === 'assistant') {
    state.messages.pop();
  }

  const latestUser = [...state.messages]
    .reverse()
    .find(item => item.role === 'user');

  if (!latestUser) return;

  $('messages')?.replaceChildren();

  state.messages.forEach(item => {
    renderMessage(item.role, item.content, false);
  });

  const pending = showPendingMessage();

  setBusy(true);

  updateConnectionStatus(
    'connecting',
    'Checking Maria AI connection…'
  );

  try {
    await checkMariaAiConnection();

    updateConnectionStatus(
      'connecting',
      'Maria AI is online · Regenerating response…'
    );

    const result = await askMaria(
      latestUser.content,

      state.messages.slice(0, -1),

      partial => {
        const bubble = pending.querySelector('.ai-bubble');

        if (bubble) {
          bubble.innerHTML = formatText(partial);
        }

        scrollToLatest();
      },

      state.conversationId
    );

    const bubble = pending.querySelector('.ai-bubble');

    if (bubble) {
      bubble.innerHTML = formatText(result.text);
    }
    renderAnswerExtras(pending, result);

    renderNavigationCards(
      pending.querySelector('.ai-nav-cards'),
      result.pages
    );

    if (result.conversationId) {
      state.conversationId = result.conversationId;
    }

    state.messages.push({
      role: 'assistant',
      content: result.text
    });

    updateConnectionStatus(
      'connected',
      'Connected to Maria AI'
    );

    try {
      await saveIfAllowed('assistant', result.text);
    } catch (error) {
      console.warn(
        'Could not save regenerated response:',
        error
      );
    }

    bindMessageActions(pending, result.text);

  } catch (error) {
    showRequestError(pending, error);

  } finally {
    setBusy(false);
    scrollToLatest();
  }
}

// =============================================
// MESSAGE INPUT AUTO RESIZE
// =============================================

function autoResize() {
  const input = $('messageInput');

  if (!input) return;

  input.style.height = 'auto';

  input.style.height =
    `${Math.min(input.scrollHeight, 150)}px`;
}

// =============================================
// CONVERSATION HISTORY
// =============================================

function renderHistory(rows) {
  const list = $('conversationList');

  if (!list) return;

  list.replaceChildren();

  if (!rows.length) {
    list.innerHTML =
      '<p class="ai-muted ai-small">No saved conversations yet.</p>';

    return;
  }

  rows.forEach(row => {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = 'ai-history-item';

    button.textContent =
      row.title || 'Conversation';

    button.title = button.textContent;

    button.addEventListener('click', () => {
      openConversation(row.id || row.conversationId);
    });

    list.appendChild(button);
  });
}

// =============================================
// OPEN SAVED CONVERSATION
// =============================================

async function openConversation(id) {
  try {
    const row = await historyStore.loadConversation(id);

    state.conversationId = id;

    const messages = Array.isArray(row.messages)
      ? row.messages
      : Object.values(row.messages || {});

    state.messages = messages.sort(
      (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
    );

    showWelcome(false);

    $('messages')?.replaceChildren();

    state.messages.forEach(message => {
      const article = renderMessage(
        message.role,
        message.content
      );

      if (message.role === 'assistant') {
        bindMessageActions(article, message.content);
      }
    });

    closeSidebar();

  } catch (error) {
    toast(
      error.message ||
      'Could not open this conversation.'
    );
  }
}

// =============================================
// LOAD CONVERSATION HISTORY
// =============================================

async function loadHistory() {
  if (!state.consent) return;

  try {
    if (state.historyUnsub) {
      state.historyUnsub();
    }

    state.historyUnsub =
      await historyStore.listConversations(renderHistory);

    if ($('consentNotice')) {
      $('consentNotice').hidden = true;
    }

  } catch (error) {
    if ($('consentNotice')) {
      $('consentNotice').hidden = false;
    }

    console.info(
      'Conversation history is unavailable:',
      error.message
    );
  }
}

// =============================================
// PRIVACY SETTINGS
// =============================================

function showPrivacy() {
  if ($('historyConsentCheck')) {
    $('historyConsentCheck').checked = state.consent;
  }

  if ($('privacyStatus')) {
    $('privacyStatus').textContent = state.consent
      ? 'Conversation saving is enabled.'
      : 'Conversation saving is disabled.';
  }

  if ($('privacyModal')) {
    $('privacyModal').hidden = false;
  }
}

// =============================================
// SAVE PRIVACY PREFERENCE
// =============================================

async function savePrivacy() {
  const checkbox = $('historyConsentCheck');

  if (!checkbox) return;

  const enabled = checkbox.checked;

  try {
    await historyStore.setConsent(enabled);

    state.consent = enabled;

    if ($('privacyModal')) {
      $('privacyModal').hidden = true;
    }

    if ($('consentNotice')) {
      $('consentNotice').hidden = enabled;
    }

    if (enabled) {
      await loadHistory();

    } else if (state.historyUnsub) {
      state.historyUnsub();
      state.historyUnsub = null;
    }

    toast(
      enabled
        ? 'Conversation saving enabled.'
        : 'Conversation saving disabled.'
    );

  } catch (error) {
    if ($('privacyStatus')) {
      $('privacyStatus').textContent = error.message;
    }
  }
}

// =============================================
// DELETE ALL CONVERSATIONS
// =============================================

async function deleteAll() {
  if (!confirm(
    'Delete all your saved Maria AI conversations? This cannot be undone.'
  )) {
    return;
  }

  try {
    await historyStore.deleteAllConversations();

    clearChat();

    renderHistory([]);

    toast('Your saved conversations have been deleted.');

  } catch (error) {
    if ($('privacyStatus')) {
      $('privacyStatus').textContent = error.message;
    }
  }
}

// =============================================
// SIDEBAR
// =============================================

function closeSidebar() {
  $('aiSidebar')?.classList.remove('open');
}

function setupSidebarDismissal() {
  const sidebar = $('aiSidebar');
  const menuButton = $('mobileMenuBtn');

  if (!sidebar || !menuButton) return;

  menuButton.addEventListener('click', event => {
    event.stopPropagation();

    sidebar.classList.toggle('open');
  });

  document.addEventListener('click', event => {
    if (!sidebar.classList.contains('open')) return;

    if (
      sidebar.contains(event.target) ||
      menuButton.contains(event.target)
    ) {
      return;
    }

    closeSidebar();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeSidebar();
    }
  });

  sidebar.addEventListener('click', event => {
    if (event.target.closest('a')) {
      closeSidebar();
    }
  });
}

// =============================================
// THEME SETTINGS
// =============================================

function setupTheme() {
  const themeButton = $('themeBtn');

  if (!themeButton) return;

  themeButton.addEventListener('click', () => {
    const dark =
      document.documentElement.dataset.theme !== 'dark';

    document.documentElement.dataset.theme =
      dark ? 'dark' : 'light';

    const values = {
      '--ai-bg': dark ? '#151625' : '#f7f8fc',
      '--ai-panel': dark ? '#202236' : '#fff',
      '--ai-text': dark ? '#f2f2fa' : '#171a2b',
      '--ai-muted': dark ? '#a4a7ba' : '#7d8295',
      '--ai-line': dark ? '#35384f' : '#e9ebf2'
    };

    Object.entries(values).forEach(([key, value]) => {
      document.documentElement.style.setProperty(
        key,
        value
      );
    });
  });
}

// =============================================
// INITIALIZE MARIA AI
// =============================================

async function initialize() {
  updateConnectionStatus(
    'connecting',
    'Checking your session and Maria AI…'
  );

  // Verify both services independently.
  const [identityResult, healthResult] =
    await Promise.allSettled([
      getMariaIdentity(),
      checkMariaAiConnection()
    ]);

  // ===========================================
  // AUTHENTICATION FAILURE
  // ===========================================

  if (identityResult.status === 'rejected') {
    const error = identityResult.reason;

    updateConnectionStatus(
      'disconnected',
      'SMMARIA session unavailable'
    );

    if ($('messages')) {
      $('messages').innerHTML = `
        <div class="ai-system-error">
          ${escapeHtml(
            error.message ||
            'Your SMMARIA session could not be verified.'
          )}
          <a href="login.html">Sign in</a>
        </div>
      `;
    }

    if ($('messageInput')) {
      $('messageInput').disabled = true;
    }

    if ($('sendBtn')) {
      $('sendBtn').disabled = true;
    }

    toast(
      error.message ||
      'Could not verify your SMMARIA session.'
    );

    console.error(
      'SMMARIA session verification failed:',
      error
    );

    return;
  }

  // ===========================================
  // LOAD USER IDENTITY
  // ===========================================

  state.identity = identityResult.value;

  const user = state.identity?.user || {};

  const name =
    user.username ||
    user.fullname ||
    user.name ||
    'SMMARIA User';

  if ($('userName')) {
    $('userName').textContent = name;
  }

  if ($('userAvatar')) {
    $('userAvatar').textContent =
      name.slice(0, 1).toUpperCase();
  }

  if ($('userRole')) {
    $('userRole').textContent =
      user.role || 'Authenticated session';
  }

  // ===========================================
  // MARIA AI BACKEND STATUS
  // ===========================================

  if (healthResult.status === 'fulfilled') {
    updateConnectionStatus(
      'connected',
      'Connected to Maria AI'
    );

  } else {
    updateConnectionStatus(
      'disconnected',
      'Maria AI unavailable · Retry when sending'
    );

    console.error(
      'Maria AI health check failed:',
      healthResult.reason
    );

    toast(
      healthResult.reason?.message ||
      'Maria AI is currently unavailable.'
    );
  }

  // Keep the composer usable after a temporary
  // AI outage. Sending a message retries the check.

  if ($('messageInput')) {
    $('messageInput').disabled = false;
  }

  if ($('sendBtn')) {
    $('sendBtn').disabled = false;
  }

  // ===========================================
  // PRIVACY AND CHAT HISTORY
  // ===========================================

  try {
    state.consent = await historyStore.getConsent();

    if ($('consentNotice')) {
      $('consentNotice').hidden = state.consent;
    }

    if (state.consent) {
      await loadHistory();
    }

  } catch (error) {
    console.warn(
      'Could not load Maria AI privacy settings:',
      error
    );
  }

  // ===========================================
  // SUGGESTIONS
  // ===========================================

  try {
    renderSuggestions(
      $('suggestionGrid'),
      prompt => submitMessage(prompt)
    );

  } catch (error) {
    console.warn(
      'Could not render Maria AI suggestions:',
      error
    );
  }
}

// =============================================
// CHAT FORM EVENTS
// =============================================

$('chatForm')?.addEventListener('submit', event => {
  event.preventDefault();

  submitMessage(
    $('messageInput')?.value
  );
});

// =============================================
// MESSAGE INPUT EVENTS
// =============================================

$('messageInput')?.addEventListener(
  'input',
  autoResize
);

$('messageInput')?.addEventListener(
  'keydown',
  event => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault();

      $('chatForm')?.requestSubmit();
    }
  }
);

// =============================================
// SIDEBAR AND PRIVACY EVENTS
// =============================================

$('newChatBtn')?.addEventListener(
  'click',
  startNewChat
);

$('privacyBtn')?.addEventListener(
  'click',
  showPrivacy
);

$('closePrivacyBtn')?.addEventListener(
  'click',
  () => {
    if ($('privacyModal')) {
      $('privacyModal').hidden = true;
    }
  }
);

$('savePrivacyBtn')?.addEventListener(
  'click',
  savePrivacy
);

$('deleteAllChatsBtn')?.addEventListener(
  'click',
  deleteAll
);

$('enableHistoryBtn')?.addEventListener(
  'click',
  showPrivacy
);

// =============================================
// START APPLICATION
// =============================================

setupSidebarDismissal();

setupTheme();

initialize();
