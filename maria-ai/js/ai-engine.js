
// ===============================================
// MARIA AI RESPONSE CLIENT
// ===============================================
// Sends chat requests to the dedicated Maria AI backend.
//
// SMMARIA backend:
//   Handles user authentication.
//
// Maria AI backend:
//   Handles knowledge retrieval, response composition,
//   permissions, conversations and database access.
//
// All trusted operations remain on the backend.
// ===============================================

import { mariaAiApiRequest } from './ai-auth.js';
import { MARIA_AI_ENDPOINTS } from './ai-config.js';
import { getPageCards } from './ai-navigation.js';

// ===============================================
// NORMALIZE CONVERSATION HISTORY
// ===============================================

function normalizeHistory(history) {
  return (Array.isArray(history) ? history : [])
    .slice(-12)
    .map(item => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content || '').slice(0, 8000)
    }));
}

// ===============================================
// EXTRACT BACKEND RESPONSE
// ===============================================

function extractResponseText(data) {
  return String(
    data.reply ||
    data.text ||
    data.answer ||
    data.response ||
    ''
  ).trim();
}

// ===============================================
// ASK MARIA AI
// ===============================================

export async function askMaria(
  question,
  history = [],
  onChunk = () => {},
  conversationId = null
) {
  const cleanQuestion = String(question || '').trim();

  if (!cleanQuestion) {
    throw new Error('Please enter a message.');
  }

  if (cleanQuestion.length > 8000) {
    throw new Error(
      'Your message is too long. Please shorten it.'
    );
  }

  // Send the request to the dedicated Maria AI backend.
  const payload = await mariaAiApiRequest(
    MARIA_AI_ENDPOINTS.chat,
    {
      method: 'POST',
      body: JSON.stringify({
        message: cleanQuestion,
        history: normalizeHistory(history),
        conversationId
      })
    }
  );

  // Support both { data: {...} } and direct response objects.
  const data = payload?.data || payload || {};

  const responseText = extractResponseText(data);

  if (!responseText) {
    throw new Error(
      'Maria AI returned an empty response. Please try again.'
    );
  }

  // The current API returns a complete JSON response.
  // This callback preserves compatibility with the chat interface.
  // It can later be connected to an actual streaming endpoint.
  if (typeof onChunk === 'function') {
    onChunk(responseText);
  }

  // Prefer navigation suggestions supplied by the backend.
  const backendPages = Array.isArray(data.pages)
    ? data.pages
    : [];

  const pages = backendPages.length
    ? backendPages
    : getPageCards(cleanQuestion);

  return {
    text: responseText,
    pages,
    conversationId:
      data.conversationId ||
      conversationId ||
      null,
    messageId: data.messageId || null
  };
}
