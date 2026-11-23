// Maria AI frontend configuration.
// The browser talks only to your SMMARIA backend. No model API keys or
// Firebase Admin credentials belong in frontend code.

// Use the backend's API root. Change this if Maria AI is hosted by a
// separate backend service.
export const MARIA_AI_API_BASE_URL =
  'https://smmmaria-backend-production-4513.up.railway.app/api/v1';

export const MARIA_AI_ENDPOINTS = Object.freeze({
  session: '/auth/me',
  chat: '/maria-ai/chat',
  conversations: '/maria-ai/conversations',
  conversation: id => `/maria-ai/conversations/${encodeURIComponent(id)}`
});

export const MARIA_AI_REQUEST_TIMEOUT = 45000;
