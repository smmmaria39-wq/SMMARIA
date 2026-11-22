import { MARIA_AI_API_BASE_URL, MARIA_AI_ENDPOINTS, MARIA_AI_REQUEST_TIMEOUT } from './ai-config.js';

export function getJwtToken() {
  return localStorage.getItem('smmmaria_token');
}

export function requireJwtToken() {
  const token = getJwtToken();
  if (!token) {
    throw new Error('Your session has expired. Please sign in to SMMARIA again.');
  }
  return token;
}

export async function apiRequest(path, options = {}) {
  const token = requireJwtToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MARIA_AI_REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${MARIA_AI_API_BASE_URL}${path}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });

    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem('smmmaria_token');
      throw new Error('Your session has expired. Please sign in again.');
    }
    if (!response.ok) {
      throw new Error(payload.message || payload.error || `Request failed (${response.status}).`);
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The request took too long. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSmmariaSession() {
  const payload = await apiRequest(MARIA_AI_ENDPOINTS.session, { method: 'GET' });
  return payload.data || payload.user || payload;
}

export async function getMariaIdentity() {
  const user = await getSmmariaSession();
  return { user, canSaveHistory: true };
}
