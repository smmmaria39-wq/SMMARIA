
import { getMariaIdentity } from './ai-auth.js';
import * as historyStore from './ai-history.js';
import { askMaria } from './ai-engine.js';
import { renderNavigationCards } from './ai-navigation.js';
import { renderSuggestions } from './ai-suggestions.js';

const $ = id => document.getElementById(id);

const state = {
  messages: [],
  conversationId: null,
  busy: false,
  consent: false,
  historyUnsub: null,
  identity: null,
  connected: false
};

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

function toast(message) {
  const element = $('aiToast');
  if (!element) return;

  element.textContent = message;
  element.classList.add('show');

  window.setTimeout(() => {
    element.classList.remove('show');
  }, 2800);
}

/* =====================================
   MARIA AI CONNECTION STATUS
===================================== */

function updateConnectionStatus(status, message) {
  const dot = $('aiStatusDot');
  const label = $('aiConnectionLabel');

  if (dot) {
    dot.classList.remove('connected', 'disconnected', 'connecting');

    if (status === 'connected') {
      dot.classList.add('connected');
    } else if (status === 'disconnected') {
      dot.classList.add('disconnected');
    } else {
      dot.classList.add('connecting');
    }
  }

  if (label) {
    label.textContent = message;
  }

  state.connected = status === 'connected';
}

function setBusy(busy) {
  state.busy = busy;

  const sendButton = $('sendBtn');
  const messageInput = $('messageInput');

  if (sendButton) sendButton.disabled = busy;
  if (messageInput) messageInput.disabled = busy;
}

/* =====================================
   MESSAGE FORMATTING
===================================== */

function formatText(value) {
  let text = escapeHtml(value);

  text = text
    .replace(/^### (.*)$/gm, '<strong>$1</strong>')
    .replace(/^## (.*)$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');

  return text.replace(/\n/g, '<br>');
}

function scrollToLatest() {
  const stage = $('chatStage');

  if (stage) {
    stage.scrollTop = stage.scrollHeight;
  }
}

function renderMessage(role, content, actions = true) {
  const article = document.createElement('article');

  article.className = `ai-message ${role}`;

  const avatar = role === 'assistant' ? 'M' : 'U';

  article.innerHTML = `
    <div class="ai-message-avatar">${avatar}</div>

    <div class="ai-message-body">

      <div class="ai-message-meta">
        ${role === 'assistant' ? 'MARIA AI' : 'YOU'} ·
        ${new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>

      <div class="ai-bubble">
        ${role === 'assistant' ? formatText(content) : escapeHtml(content)}
      </div>

      ${
        role === 'assistant' && actions
          ? `
            <div class="ai-message-actions">
              <button type="button" data-copy>Copy</button>
              <button type="button" data-regenerate>Regenerate</button>
            </div>
          `
          : ''
      }

      <div class="ai-nav-cards"></div>

    </div>
  `;

  $('messages')?.appendChild(article);

  scrollToLatest();

  return article;
}

/* =====================================
   CHAT MANAGEMENT
===================================== */

function clearChat() {
  state.messages = [];
  state.conversationId = null;

  $('messages')?.replaceChildren();

  const welcomePanel = $('welcomePanel');

  if (welcomePanel) {
    welcomePanel.hidden = false;
  }
}

async function startNewChat() {
  if (state.busy) return;

  clearChat();

  $('messageInput')?.focus();
}

async function saveIfAllowed(role, content) {
  if (!state.consent || !state.conversationId) return;

  await historyStore.saveMessage(state.conversationId, {
    role,
    content
  });
}

/* =====================================
   SEND MESSAGE TO MARIA AI
===================================== */

async function submitMessage(value) {
  const text = String(value || '').trim();

  if (!text || state.busy) return;

  const welcomePanel = $('welcomePanel');

  if (welcomePanel) {
    welcomePanel.hidden = true;
  }

  state.messages.push({
    role: 'user',
    content: text
  });

  renderMessage('user', text);

  const messageInput = $('messageInput');

  if (messageInput) {
    messageInput.value = '';
    autoResize();
  }

  /* Save user message when consent is enabled. */

  if (state.consent) {
    try {
      if (!state.conversationId) {
        state.conversationId = await historyStore.createConversation(
          text.slice(0, 90)
        );
      }

      await saveIfAllowed('user', text);

    } catch (error) {
      toast('Your message was sent, but conversation saving is unavailable.');

      console.warn('Maria AI history save failed:', error);

      state.consent = false;
    }
  }

  const pending = renderMessage('assistant', '');

  pending.querySelector('.ai-bubble').innerHTML =
    '<span class="ai-typing"><i></i><i></i><i></i></span>';

  setBusy(true);

  updateConnectionStatus('connecting', 'Connecting to Maria AI…');

  try {
    const result = await askMaria(
      text,
      state.messages.slice(0, -1),
      partial => {
        pending.querySelector('.ai-bubble').innerHTML = formatText(partial);

        scrollToLatest();
      },
      state.conversationId
    );

    pending.querySelector('.ai-bubble').innerHTML = formatText(result.text);

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

    updateConnectionStatus('connected', 'Connected to Maria AI');

    if (state.consent) {
      try {
        await saveIfAllowed('assistant', result.text);
      } catch (error) {
        console.warn('Assistant response history save failed:', error);
      }
    }

    bindMessageActions(pending, result.text);

  } catch (error) {
    pending.querySelector('.ai-bubble').textContent =
      error.message || 'Maria AI could not complete that request.';

    updateConnectionStatus('disconnected', 'Connection issue');

    toast('Maria AI could not respond. Please try again.');

    console.error('Maria AI request failed:', error);

  } finally {
    setBusy(false);

    $('messageInput')?.focus();

    scrollToLatest();
  }
}

/* =====================================
   MESSAGE ACTIONS
===================================== */

function bindMessageActions(node, content) {
  node.querySelector('[data-copy]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(content);

      toast('Response copied.');

    } catch {
      toast('Could not copy this response on your device.');
    }
  });

  node.querySelector('[data-regenerate]')?.addEventListener(
    'click',
    regenerate
  );
}

/* =====================================
   REGENERATE RESPONSE
===================================== */

async function regenerate() {
  if (state.busy || !state.messages.length) return;

  const last = state.messages[state.messages.length - 1];

  if (last.role === 'assistant') {
    state.messages.pop();
  }

  const latestUser = [...state.messages]
    .reverse()
    .find(message => message.role === 'user');

  if (!latestUser) return;

  $('messages')?.replaceChildren();

  state.messages.forEach(message => {
    renderMessage(message.role, message.content, false);
  });

  const pending = renderMessage('assistant', '');

  pending.querySelector('.ai-bubble').innerHTML =
    '<span class="ai-typing"><i></i><i></i><i></i></span>';

  setBusy(true);

  updateConnectionStatus('connecting', 'Connecting to Maria AI…');

  try {
    const result = await askMaria(
      latestUser.content,
      state.messages.slice(0, -1),
      partial => {
        pending.querySelector('.ai-bubble').innerHTML = formatText(partial);

        scrollToLatest();
      },
      state.conversationId
    );

    pending.querySelector('.ai-bubble').innerHTML = formatText(result.text);

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

    updateConnectionStatus('connected', 'Connected to Maria AI');

    if (state.consent) {
      try {
        await saveIfAllowed('assistant', result.text);
      } catch (error) {
        console.warn('Assistant response history save failed:', error);
      }
    }

    bindMessageActions(pending, result.text);

  } catch (error) {
    pending.querySelector('.ai-bubble').textContent =
      error.message || 'Could not regenerate the response.';

    updateConnectionStatus('disconnected', 'Connection issue');

    console.error('Maria AI regeneration failed:', error);

  } finally {
    setBusy(false);

    scrollToLatest();
  }
}

/* =====================================
   MESSAGE INPUT
===================================== */

function autoResize() {
  const input = $('messageInput');

  if (!input) return;

  input.style.height = 'auto';

  input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
}

/* =====================================
   CONVERSATION HISTORY
===================================== */

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
    button.textContent = row.title || 'Conversation';
    button.title = button.textContent;

    button.addEventListener('click', () => {
      openConversation(row.id || row.conversationId);
    });

    list.appendChild(button);
  });
}

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

    const welcomePanel = $('welcomePanel');

    if (welcomePanel) {
      welcomePanel.hidden = true;
    }

    $('messages')?.replaceChildren();

    state.messages.forEach(message => {
      const article = renderMessage(message.role, message.content);

      if (message.role === 'assistant') {
        bindMessageActions(article, message.content);
      }
    });

    closeSidebar();

  } catch (error) {
    toast(error.message || 'Could not open this conversation.');
  }
}

async function loadHistory() {
  if (!state.consent) return;

  try {
    if (state.historyUnsub) {
      state.historyUnsub();
    }

    state.historyUnsub = await historyStore.listConversations(renderHistory);

    const notice = $('consentNotice');

    if (notice) {
      notice.hidden = true;
    }

  } catch (error) {
    const notice = $('consentNotice');

    if (notice) {
      notice.hidden = false;
    }

    console.info('Conversation history is unavailable:', error.message);
  }
}

/* =====================================
   PRIVACY SETTINGS
===================================== */

function showPrivacy() {
  const checkbox = $('historyConsentCheck');
  const status = $('privacyStatus');
  const modal = $('privacyModal');

  if (checkbox) {
    checkbox.checked = state.consent;
  }

  if (status) {
    status.textContent = state.consent
      ? 'Conversation saving is enabled.'
      : 'Conversation saving is disabled.';
  }

  if (modal) {
    modal.hidden = false;
  }
}

async function savePrivacy() {
  const checkbox = $('historyConsentCheck');

  if (!checkbox) return;

  const enabled = checkbox.checked;

  try {
    await historyStore.setConsent(enabled);

    state.consent = enabled;

    const modal = $('privacyModal');
    const notice = $('consentNotice');

    if (modal) modal.hidden = true;
    if (notice) notice.hidden = enabled;

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
    const status = $('privacyStatus');

    if (status) {
      status.textContent = error.message;
    }
  }
}

async function deleteAll() {
  if (
    !confirm(
      'Delete all your saved Maria AI conversations? This cannot be undone.'
    )
  ) {
    return;
  }

  try {
    await historyStore.deleteAllConversations();

    clearChat();

    renderHistory([]);

    toast('Your saved conversations have been deleted.');

  } catch (error) {
    const status = $('privacyStatus');

    if (status) {
      status.textContent = error.message;
    }
  }
}

/* =====================================
   SIDEBAR
===================================== */

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

/* =====================================
   THEME SETTINGS
===================================== */

function setupTheme() {
  const themeButton = $('themeBtn');

  if (!themeButton) return;

  themeButton.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';

    document.documentElement.dataset.theme = dark ? 'dark' : 'light';

    const values = {
      '--ai-bg': dark ? '#151625' : '#f7f8fc',
      '--ai-panel': dark ? '#202236' : '#fff',
      '--ai-text': dark ? '#f2f2fa' : '#171a2b',
      '--ai-muted': dark ? '#a4a7ba' : '#7d8295',
      '--ai-line': dark ? '#35384f' : '#e9ebf2'
    };

    Object.entries(values).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  });
}

/* =====================================
   INITIALIZE MARIA AI
===================================== */

async function initialize() {
  updateConnectionStatus('connecting', 'Connecting to Maria AI…');

  try {
    state.identity = await getMariaIdentity();

    const user = state.identity?.user || {};

    const name =
      user.username ||
      user.fullname ||
      user.name ||
      'SMMARIA User';

    const userName = $('userName');
    const userAvatar = $('userAvatar');
    const userRole = $('userRole');

    if (userName) userName.textContent = name;

    if (userAvatar) {
      userAvatar.textContent = name.slice(0, 1).toUpperCase();
    }

    if (userRole) {
      userRole.textContent = user.role || 'Authenticated session';
    }

    updateConnectionStatus('connecting', 'Session verified · Ready to chat');

  } catch (error) {
    updateConnectionStatus('disconnected', 'Unable to connect');

    const messages = $('messages');

    if (messages) {
      messages.innerHTML = `
        <div class="ai-system-error">
          ${escapeHtml(error.message || 'Your session could not be verified.')}
          <a href="login.html">Sign in</a>
        </div>
      `;
    }

    const input = $('messageInput');
    const sendButton = $('sendBtn');

    if (input) input.disabled = true;
    if (sendButton) sendButton.disabled = true;

    toast(error.message || 'Could not verify your session.');

    console.error('Maria AI initialization failed:', error);

    return;
  }

  try {
    state.consent = await historyStore.getConsent();

    const notice = $('consentNotice');

    if (notice) {
      notice.hidden = state.consent;
    }

    if (state.consent) {
      await loadHistory();
    }

  } catch (error) {
    console.warn('Could not load Maria AI privacy settings:', error);
  }

  try {
    renderSuggestions(
      $('suggestionGrid'),
      prompt => submitMessage(prompt)
    );
  } catch (error) {
    console.warn('Could not render Maria AI suggestions:', error);
  }
}

/* =====================================
   EVENT LISTENERS
===================================== */

$('chatForm')?.addEventListener('submit', event => {
  event.preventDefault();

  submitMessage($('messageInput')?.value);
});

$('messageInput')?.addEventListener('input', autoResize);

$('messageInput')?.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();

    $('chatForm')?.requestSubmit();
  }
});

$('newChatBtn')?.addEventListener('click', startNewChat);

$('privacyBtn')?.addEventListener('click', showPrivacy);

$('closePrivacyBtn')?.addEventListener('click', () => {
  const modal = $('privacyModal');

  if (modal) modal.hidden = true;
});

$('savePrivacyBtn')?.addEventListener('click', savePrivacy);

$('deleteAllChatsBtn')?.addEventListener('click', deleteAll);

$('enableHistoryBtn')?.addEventListener('click', showPrivacy);

/* =====================================
   START APPLICATION
===================================== */

setupSidebarDismissal();
setupTheme();
initialize();
