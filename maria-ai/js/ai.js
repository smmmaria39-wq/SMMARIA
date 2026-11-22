
import { getMariaIdentity } from './ai-auth.js';
import { FIREBASE_CONFIGURED, getFirebaseServices } from './ai-config.js';
import * as historyStore from './ai-history.js';
import { askMaria } from './ai-engine.js';
import { renderNavigationCards } from './ai-navigation.js';
import { renderSuggestions } from './ai-suggestions.js';

// ===============================================
// MARIA AI — CORE CONFIGURATION
// ===============================================

const $ = id => document.getElementById(id);

const state = {
    messages: [],
    conversationId: null,
    busy: false,
    consent: false,
    historyUnsub: null,
    identity: null
};

// HTML escaping
const esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[c]));

// ===============================================
// TOAST NOTIFICATIONS
// ===============================================

function toast(msg) {
    const el = $('aiToast');

    if (!el) return;

    el.textContent = msg;
    el.classList.add('show');

    setTimeout(() => {
        el.classList.remove('show');
    }, 2800);
}

// ===============================================
// CHAT BUSY STATE
// ===============================================

function setBusy(v) {
    state.busy = v;

    $('sendBtn').disabled = v;
    $('messageInput').disabled = v;
}

// ===============================================
// MESSAGE FORMATTING
// ===============================================

function formatText(text) {
    // HTML is escaped before applying limited Markdown formatting.
    let s = esc(text);

    s = s
        .replace(/^### (.*)$/gm, '<strong>$1</strong>')
        .replace(/^## (.*)$/gm, '<strong>$1</strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');

    return s;
}

// ===============================================
// RENDER CHAT MESSAGES
// ===============================================

function renderMessage(role, content, appendActions = true) {
    const wrap = document.createElement('article');

    wrap.className = `ai-message ${role}`;

    const avatar = role === 'assistant' ? 'M' : 'U';

    const body = role === 'assistant'
        ? formatText(content)
        : esc(content);

    wrap.innerHTML = `
        <div class="ai-message-avatar">${avatar}</div>

        <div class="ai-message-body">

            <div class="ai-message-meta">
                ${role === 'assistant' ? 'MARIA AI' : 'YOU'}
                ·
                ${new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                })}
            </div>

            <div class="ai-bubble">${body}</div>

            ${
                role === 'assistant' && appendActions
                    ? `
                        <div class="ai-message-actions">
                            <button data-copy>Copy</button>
                            <button data-regenerate>Regenerate</button>
                        </div>
                    `
                    : ''
            }

            <div class="ai-nav-cards"></div>

        </div>
    `;

    $('messages').appendChild(wrap);

    $('chatStage').scrollTop = $('chatStage').scrollHeight;

    return wrap;
}

// ===============================================
// CLEAR AND START NEW CHAT
// ===============================================

function clearChat() {
    state.messages = [];
    state.conversationId = null;

    $('messages').innerHTML = '';
    $('welcomePanel').hidden = false;
}

async function startNewChat() {
    clearChat();
    $('messageInput').focus();
}

// ===============================================
// SAVE CONVERSATION HISTORY
// ===============================================

async function saveIfAllowed(role, content) {
    if (!state.consent || !state.conversationId) return;

    try {
        await historyStore.saveMessage(
            state.conversationId,
            { role, content }
        );
    } catch (e) {
        toast('Chat is active, but history could not be saved.');
        console.warn(e);
    }
}

// ===============================================
// SUBMIT MESSAGE TO MARIA AI
// ===============================================

async function submitMessage(text) {
    text = text.trim();

    if (!text || state.busy) return;

    $('welcomePanel').hidden = true;

    state.messages.push({
        role: 'user',
        content: text
    });

    renderMessage('user', text);

    $('messageInput').value = '';

    autoResize();

    // Save user message when consent is enabled
    if (state.consent) {
        try {
            if (!state.conversationId) {
                state.conversationId =
                    await historyStore.createConversation(
                        text.slice(0, 55)
                    );
            }

            await saveIfAllowed('user', text);

        } catch (e) {
            toast(e.message);
            state.consent = false;
        }
    }

    // Display typing indicator
    const pending = renderMessage('assistant', '');

    pending.querySelector('.ai-bubble').innerHTML = `
        <span class="ai-typing">
            <i></i>
            <i></i>
            <i></i>
        </span>
    `;

    setBusy(true);

    try {
        const result = await askMaria(
            text,
            state.messages.slice(0, -1),
            partial => {
                pending.querySelector('.ai-bubble').textContent = partial;

                $('chatStage').scrollTop =
                    $('chatStage').scrollHeight;
            }
        );

        pending.querySelector('.ai-bubble').innerHTML =
            formatText(result.text);

        // Render navigation cards
        renderNavigationCards(
            pending.querySelector('.ai-nav-cards'),
            result.pages
        );

        state.messages.push({
            role: 'assistant',
            content: result.text
        });

        // Save assistant response
        if (state.consent) {
            await saveIfAllowed('assistant', result.text);
        }

        bindMessageActions(pending, result.text);

    } catch (e) {
        pending.querySelector('.ai-bubble').textContent =
            e.message || 'Maria AI could not complete that request.';

        toast('Unable to get a response.');

    } finally {
        setBusy(false);
        $('messageInput').focus();
    }
}

// ===============================================
// MESSAGE ACTIONS
// ===============================================

function bindMessageActions(node, text) {

    // Copy response
    node.querySelector('[data-copy]')?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(text);
            toast('Response copied.');
        } catch (e) {
            toast('Unable to copy response.');
        }
    });

    // Regenerate response
    node.querySelector('[data-regenerate]')?.addEventListener('click', () => {
        regenerate();
    });
}

// ===============================================
// REGENERATE MARIA AI RESPONSE
// ===============================================

async function regenerate() {
    if (state.busy || !state.messages.length) return;

    const last = state.messages[state.messages.length - 1];

    if (last.role === 'assistant') {
        state.messages.pop();
    }

    const user = [...state.messages]
        .reverse()
        .find(m => m.role === 'user');

    if (!user) return;

    const prompt = user.content;

    $('messages').innerHTML = '';

    state.messages.forEach(m => {
        renderMessage(m.role, m.content, false);
    });

    const pending = renderMessage('assistant', '');

    pending.querySelector('.ai-bubble').innerHTML = `
        <span class="ai-typing">
            <i></i>
            <i></i>
            <i></i>
        </span>
    `;

    setBusy(true);

    try {
        const result = await askMaria(
            prompt,
            state.messages.slice(0, -1),
            partial => {
                pending.querySelector('.ai-bubble').textContent = partial;
            }
        );

        pending.querySelector('.ai-bubble').innerHTML =
            formatText(result.text);

        renderNavigationCards(
            pending.querySelector('.ai-nav-cards'),
            result.pages
        );

        state.messages.push({
            role: 'assistant',
            content: result.text
        });

        if (state.consent) {
            await saveIfAllowed('assistant', result.text);
        }

        bindMessageActions(pending, result.text);

    } catch (e) {
        pending.querySelector('.ai-bubble').textContent =
            e.message || 'Could not regenerate response.';

    } finally {
        setBusy(false);
    }
}

// ===============================================
// MESSAGE INPUT AUTO RESIZE
// ===============================================

function autoResize() {
    const el = $('messageInput');

    el.style.height = 'auto';

    el.style.height =
        Math.min(el.scrollHeight, 150) + 'px';
}

// ===============================================
// CONVERSATION HISTORY
// ===============================================

function renderHistory(rows) {
    const list = $('conversationList');

    list.innerHTML = '';

    if (!rows.length) {
        list.innerHTML = `
            <p class="ai-muted ai-small">
                No saved conversations yet.
            </p>
        `;

        return;
    }

    rows.forEach(row => {
        const b = document.createElement('button');

        b.className = 'ai-history-item';
        b.textContent = row.title || 'Conversation';
        b.title = row.title || 'Conversation';

        b.addEventListener('click', () => {
            openConversation(row.id);
        });

        list.appendChild(b);
    });
}

// ===============================================
// OPEN SAVED CONVERSATION
// ===============================================

async function openConversation(id) {
    try {
        const row = await historyStore.loadConversation(id);

        state.conversationId = id;

        state.messages = Object.values(row.messages || {})
            .sort((a, b) => a.timestamp - b.timestamp);

        $('welcomePanel').hidden = true;
        $('messages').innerHTML = '';

        state.messages.forEach(m => {
            renderMessage(m.role, m.content);
        });

        // Close mobile sidebar after selecting a conversation
        closeAISidebar();

    } catch (e) {
        toast(e.message);
    }
}

// ===============================================
// LOAD CONVERSATION HISTORY
// ===============================================

async function loadHistory() {
    if (!state.consent) return;

    try {
        if (state.historyUnsub) {
            state.historyUnsub();
        }

        state.historyUnsub =
            await historyStore.listConversations(renderHistory);

    } catch (e) {
        $('consentNotice').hidden = false;

        console.info(
            'Realtime history not connected:',
            e.message
        );
    }
}

// ===============================================
// PRIVACY SETTINGS
// ===============================================

function showPrivacy() {
    $('historyConsentCheck').checked = state.consent;

    $('privacyStatus').textContent = state.consent
        ? 'Conversation saving is enabled.'
        : 'Conversation saving is disabled.';

    $('privacyModal').hidden = false;
}

async function savePrivacy() {
    const checked = $('historyConsentCheck').checked;

    try {
        await historyStore.setConsent(checked);

        state.consent = checked;

        $('privacyModal').hidden = true;
        $('consentNotice').hidden = checked;

        if (checked) {
            await loadHistory();

        } else if (state.historyUnsub) {
            state.historyUnsub();
            state.historyUnsub = null;
        }

        toast(
            checked
                ? 'Conversation saving enabled.'
                : 'Conversation saving disabled.'
        );

    } catch (e) {
        $('privacyStatus').textContent = e.message;
    }
}

// ===============================================
// DELETE SAVED CONVERSATIONS
// ===============================================

async function deleteAll() {
    if (!confirm(
        'Delete all saved Maria AI conversations? This cannot be undone.'
    )) return;

    try {
        await historyStore.deleteAllConversations();

        clearChat();

        toast('Saved conversations deleted.');

    } catch (e) {
        $('privacyStatus').textContent = e.message;
    }
}

// ===============================================
// MOBILE SIDEBAR CONTROLS
// ===============================================

const aiSidebar = $('aiSidebar');
const mobileMenuBtn = $('mobileMenuBtn');

let aiSidebarBackdrop = null;

// Create mobile sidebar backdrop
function createSidebarBackdrop() {
    if (!aiSidebar || !document.querySelector('.ai-shell')) {
        return;
    }

    aiSidebarBackdrop = document.querySelector('.ai-sidebar-backdrop');

    if (!aiSidebarBackdrop) {
        aiSidebarBackdrop = document.createElement('div');

        aiSidebarBackdrop.className = 'ai-sidebar-backdrop';

        aiSidebarBackdrop.setAttribute(
            'aria-hidden',
            'true'
        );

        document.querySelector('.ai-shell').appendChild(
            aiSidebarBackdrop
        );
    }

    aiSidebarBackdrop.addEventListener(
        'click',
        closeAISidebar
    );
}

// Close sidebar
function closeAISidebar() {
    if (aiSidebar) {
        aiSidebar.classList.remove('open');
    }

    if (aiSidebarBackdrop) {
        aiSidebarBackdrop.classList.remove('active');
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.setAttribute('aria-expanded', 'false');
    }
}

// Open sidebar
function openAISidebar() {
    if (aiSidebar) {
        aiSidebar.classList.add('open');
    }

    if (aiSidebarBackdrop) {
        aiSidebarBackdrop.classList.add('active');
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.setAttribute('aria-expanded', 'true');
    }
}

// Toggle sidebar
mobileMenuBtn?.addEventListener('click', e => {
    e.stopPropagation();

    if (aiSidebar?.classList.contains('open')) {
        closeAISidebar();
    } else {
        openAISidebar();
    }
});

// Close sidebar when clicking outside it
document.addEventListener('click', e => {
    if (!aiSidebar?.classList.contains('open')) {
        return;
    }

    if (
        aiSidebar.contains(e.target) ||
        mobileMenuBtn?.contains(e.target)
    ) {
        return;
    }

    closeAISidebar();
});

// Close sidebar with Escape key
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeAISidebar();
    }
});

// ===============================================
// THEME SWITCHING
// ===============================================

function toggleTheme() {
    const dark = document.documentElement.dataset.theme !== 'dark';

    document.documentElement.dataset.theme =
        dark ? 'dark' : 'light';

    document.documentElement.style.setProperty(
        '--ai-bg',
        dark ? '#151625' : '#f7f8fc'
    );

    document.documentElement.style.setProperty(
        '--ai-panel',
        dark ? '#202236' : '#fff'
    );

    document.documentElement.style.setProperty(
        '--ai-text',
        dark ? '#f2f2fa' : '#171a2b'
    );

    document.documentElement.style.setProperty(
        '--ai-muted',
        dark ? '#a4a7ba' : '#7d8295'
    );

    document.documentElement.style.setProperty(
        '--ai-line',
        dark ? '#35384f' : '#e9ebf2'
    );
}

// ===============================================
// INITIALIZE MARIA AI
// ===============================================

async function initialize() {

    // Create sidebar backdrop
    createSidebarBackdrop();

    // Authenticate SMMARIA user
    try {
        state.identity = await getMariaIdentity();

        const user = state.identity.user || {};

        const name =
            user.username ||
            user.fullname ||
            user.name ||
            'SMMARIA User';

        $('userName').textContent = name;

        $('userAvatar').textContent =
            name.slice(0, 1).toUpperCase();

        $('userRole').textContent =
            user.role || 'Authenticated session';

    } catch (e) {
        $('messages').innerHTML = `
            <div class="ai-system-error">
                ${esc(e.message)}
                <a href="login.html">Sign in</a>
            </div>
        `;

        $('messageInput').disabled = true;
        $('sendBtn').disabled = true;

        toast(e.message);

        return;
    }

    // Initialize Firebase and conversation history
    if (FIREBASE_CONFIGURED) {
        try {
            getFirebaseServices();

            state.consent = await historyStore.getConsent();

            $('consentNotice').hidden = state.consent;

            await loadHistory();

        } catch (e) {
            $('consentNotice').hidden = false;

            console.info(e.message);
        }

    } else {
        $('consentNotice').hidden = false;

        $('consentNotice').querySelector('span').textContent =
            'Firebase is not configured yet. Chat history saving is unavailable.';

        $('enableHistoryBtn').disabled = true;
    }

    // Render starter suggestions
    renderSuggestions(
        $('suggestionGrid'),
        p => submitMessage(p)
    );
}

// ===============================================
// EVENT LISTENERS
// ===============================================

// Chat form
$('chatForm').addEventListener('submit', e => {
    e.preventDefault();

    submitMessage(
        $('messageInput').value
    );
});

// Message input
$('messageInput').addEventListener('input', autoResize);

$('messageInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        $('chatForm').requestSubmit();
    }
});

// New conversation
$('newChatBtn').addEventListener('click', startNewChat);

// Privacy controls
$('privacyBtn').addEventListener('click', showPrivacy);

$('closePrivacyBtn').addEventListener('click', () => {
    $('privacyModal').hidden = true;
});

$('savePrivacyBtn').addEventListener('click', savePrivacy);

$('deleteAllChatsBtn').addEventListener('click', deleteAll);

$('enableHistoryBtn').addEventListener('click', showPrivacy);

// Theme switch
$('themeBtn').addEventListener('click', toggleTheme);

// ===============================================
// START MARIA AI
// ===============================================

initialize();
