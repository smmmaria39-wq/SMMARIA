
/*
=====================================================
 MARIA AI — DUAL BACKEND CONFIGURATION
=====================================================

SMMARIA BACKEND:
- User authentication
- Main SMMARIA account services

MARIA AI BACKEND:
- AI chat processing
- Conversation history
- AI knowledge retrieval

No Gemini or OpenAI API keys are required here.
No Firebase Admin credentials belong in frontend code.
=====================================================
*/

// SMMARIA existing backend
export const SMMARIA_API_BASE_URL =
    'https://smmmaria-backend-production-4513.up.railway.app/api/v1';

// Dedicated Maria AI backend
export const MARIA_AI_API_BASE_URL =
    'https://ai-assistant-production-3804f48e.up.railway.app';

// Authentication endpoints — SMMARIA backend
export const SMMARIA_ENDPOINTS = Object.freeze({
    session: '/auth/me'
});

// Maria AI endpoints — dedicated AI backend
export const MARIA_AI_ENDPOINTS = Object.freeze({
    chat: '/api/v1/maria-ai/chat',
    conversations: '/api/v1/maria-ai/conversations',

    conversation: (id) =>
        `/api/v1/maria-ai/conversations/${encodeURIComponent(id)}`,

    saveMessage: (id) =>
        `/api/v1/maria-ai/conversations/${encodeURIComponent(id)}/messages`
});

// Request timeout
export const MARIA_AI_REQUEST_TIMEOUT = 45000;

// URL helper
export function smmariaApiUrl(endpoint) {
    return `${SMMARIA_API_BASE_URL}${endpoint}`;
}

export function mariaAiApiUrl(endpoint) {
    return `${MARIA_AI_API_BASE_URL}${endpoint}`;
}
