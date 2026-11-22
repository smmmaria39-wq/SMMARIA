// Conversation history is managed by the Maria AI backend.
import { apiRequest } from './ai-auth.js';
import { MARIA_AI_ENDPOINTS } from './ai-config.js';

const endpoint = MARIA_AI_ENDPOINTS.conversations;

function unwrap(payload) {
  return payload && payload.data !== undefined ? payload.data : payload;
}

export async function listConversations(onUpdate = () => {}) {
  const data = unwrap(await apiRequest(endpoint, { method: 'GET' }));
  const rows = Array.isArray(data) ? data : (data.conversations || []);
  onUpdate(rows);
  // Return an unsubscribe-compatible function so the UI can use the same API
  // shape as its previous history implementation. Refresh is manual/API-driven.
  return () => {};
}

export async function loadConversation(id) {
  if (!id) throw new Error('Conversation not found.');
  return unwrap(await apiRequest(MARIA_AI_ENDPOINTS.conversation(id), { method: 'GET' }));
}

export async function createConversation(title) {
  const payload = unwrap(await apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify({ title: String(title || 'New conversation').slice(0, 100) })
  }));
  const id = payload.id || payload.conversationId;
  if (!id) throw new Error('The server did not return a conversation ID.');
  return id;
}

export async function saveMessage(conversationId, message) {
  if (!conversationId) return;
  return unwrap(await apiRequest(MARIA_AI_ENDPOINTS.conversation(conversationId) + '/messages', {
    method: 'POST',
    body: JSON.stringify({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content || '').slice(0, 12000)
    })
  }));
}

export async function deleteAllConversations() {
  return unwrap(await apiRequest(endpoint, { method: 'DELETE' }));
}

// Consent is stored on this browser. The backend must still enforce the
// authenticated user's ownership for every history endpoint.
const CONSENT_KEY = 'maria_ai_history_consent';
export async function getConsent() {
  return localStorage.getItem(CONSENT_KEY) === 'true';
}
export async function setConsent(enabled) {
  localStorage.setItem(CONSENT_KEY, enabled ? 'true' : 'false');
  return enabled;
}
