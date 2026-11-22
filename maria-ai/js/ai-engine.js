// Maria AI response client. All knowledge retrieval, response composition,
// permission checks and database access happen on the trusted backend.
import { apiRequest } from './ai-auth.js';
import { MARIA_AI_ENDPOINTS } from './ai-config.js';
import { getPageCards } from './ai-navigation.js';

function normalizeHistory(history) {
  return (Array.isArray(history) ? history : []).slice(-12).map(item => ({
    role: item.role === 'assistant' ? 'assistant' : 'user',
    content: String(item.content || '').slice(0, 8000)
  }));
}

export async function askMaria(question, history = [], onChunk = () => {}, conversationId = null) {
  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion) throw new Error('Please enter a message.');
  if (cleanQuestion.length > 8000) throw new Error('Your message is too long. Please shorten it.');

  const payload = await apiRequest(MARIA_AI_ENDPOINTS.chat, {
    method: 'POST',
    body: JSON.stringify({
      message: cleanQuestion,
      history: normalizeHistory(history),
      conversationId
    })
  });

  const data = payload.data || payload;
  const text = String(data.reply || data.text || data.answer || '').trim();
  if (!text) throw new Error('Maria AI returned an empty response. Please try again.');

  // The API currently returns a complete JSON response. This callback keeps
  // compatibility with the chat UI and can later be connected to SSE streaming.
  onChunk(text);
  const backendPages = Array.isArray(data.pages) ? data.pages : [];
  const pages = backendPages.length ? backendPages : getPageCards(cleanQuestion);

  return {
    text,
    pages,
    conversationId: data.conversationId || conversationId || null,
    messageId: data.messageId || null
  };
}
