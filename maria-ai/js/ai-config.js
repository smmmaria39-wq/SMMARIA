
/*
=====================================================
 MARIA AI — DUAL BACKEND CONFIGURATION
=====================================================

SMMARIA BACKEND:
- User authentication
- User identity verification

MARIA AI BACKEND:
- AI chat
- Knowledge retrieval
- Conversation history
- AI administration

IMPORTANT:
Never put Firebase Admin credentials or private
API keys in this frontend configuration.
=====================================================
*/

// =============================================
// SMMARIA MAIN BACKEND
// =============================================

export const SMMARIA_API_BASE_URL =
    'https://smmmaria-backend-production-4513.up.railway.app/api/v1';

// =============================================
// DEDICATED MARIA AI BACKEND
// =============================================

export const MARIA_AI_API_BASE_URL =
    'https://ai-assistant-production-3804f48e.up.railway.app';

// =============================================
// SMMARIA AUTHENTICATION ENDPOINTS
// =============================================

export const SMMARIA_ENDPOINTS = Object.freeze({
    session: '/auth/me'
});

// =============================================
// MARIA AI BACKEND ENDPOINTS
// =============================================

export const MARIA_AI_ENDPOINTS = Object.freeze({

    // AI chat
    chat: '/api/v1/maria-ai/chat',

    // Conversation management
    conversations: '/api/v1/maria-ai/conversations',

    // Individual conversation
    conversation: (id) =>
        `/api/v1/maria-ai/conversations/${encodeURIComponent(id)}`,

    // Save conversation message
    saveMessage: (id) =>
        `/api/v1/maria-ai/conversations/${encodeURIComponent(id)}/messages`

});

// =============================================
// REQUEST CONFIGURATION
// =============================================

export const MARIA_AI_REQUEST_TIMEOUT = 45000;

// =============================================
// URL HELPERS
// =============================================

export function smmariaApiUrl(endpoint) {
    return `${SMMARIA_API_BASE_URL.replace(/\/+$/, '')}/${String(endpoint).replace(/^\/+/, '')}`;
}

export function mariaAiApiUrl(endpoint) {
    return `${MARIA_AI_API_BASE_URL.replace(/\/+$/, '')}/${String(endpoint).replace(/^\/+/, '')}`;
}
