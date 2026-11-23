
import {
  SMMARIA_API_BASE_URL,
  SMMARIA_ENDPOINTS,
  MARIA_AI_REQUEST_TIMEOUT
} from './ai-config.js';

// =============================================
// JWT TOKEN
// =============================================

export function getJwtToken() {
  return localStorage.getItem('smmmaria_token');
}

export function requireJwtToken() {
  const token = getJwtToken();

  if (!token) {
    throw new Error(
      'Your session has expired. Please sign in to SMMARIA again.'
    );
  }

  return token;
}

// =============================================
// SMMARIA BACKEND REQUEST
// Used for authentication and user identity
// =============================================

export async function smmariaApiRequest(path, options = {}) {
  const token = requireJwtToken();
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    MARIA_AI_REQUEST_TIMEOUT
  );

  try {
    const response = await fetch(
      `${SMMARIA_API_BASE_URL}${path}`,
      {
        ...options,
        signal: options.signal || controller.signal,

        headers: {
          Accept: 'application/json',
          ...(options.body
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`
        }
      }
    );

    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      localStorage.removeItem('smmmaria_token');

      throw new Error(
        'Your session has expired. Please sign in again.'
      );
    }

    if (!response.ok) {
      throw new Error(
        payload.message ||
        payload.error ||
        `SMMARIA request failed (${response.status}).`
      );
    }

    return payload;

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'The SMMARIA authentication request took too long.'
      );
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}

// =============================================
// MARIA AI BACKEND REQUEST
// Used for chat, knowledge and conversations
// =============================================

export async function mariaAiApiRequest(path, options = {}) {
  const token = requireJwtToken();
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    MARIA_AI_REQUEST_TIMEOUT
  );

  try {
    const response = await fetch(
      `${MARIA_AI_API_BASE_URL}${path}`,
      {
        ...options,
        signal: options.signal || controller.signal,

        headers: {
          Accept: 'application/json',
          ...(options.body
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`
        }
      }
    );

    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
      localStorage.removeItem('smmmaria_token');

      throw new Error(
        'Your SMMARIA session is no longer valid. Please sign in again.'
      );
    }

    if (!response.ok) {
      throw new Error(
        payload.message ||
        payload.error ||
        `Maria AI request failed (${response.status}).`
      );
    }

    return payload;

  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        'Maria AI took too long to respond. Please try again.'
      );
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}

// =============================================
// VERIFY SMMARIA USER SESSION
// =============================================

export async function getSmmariaSession() {
  const payload = await smmariaApiRequest(
    SMMARIA_ENDPOINTS.session,
    { method: 'GET' }
  );

  return payload.data || payload.user || payload;
}

// =============================================
// MARIA AI USER IDENTITY
// =============================================

export async function getMariaIdentity() {
  const user = await getSmmariaSession();

  return {
    user,
    canSaveHistory: true
  };
}
