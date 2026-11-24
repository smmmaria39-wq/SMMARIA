
import {
  SMMARIA_API_BASE_URL,
  MARIA_AI_API_BASE_URL,
  SMMARIA_ENDPOINTS,
  MARIA_AI_REQUEST_TIMEOUT
} from './ai-config.js';

const TOKEN_KEY = 'smmmaria_token';

// =============================================
// JWT TOKEN MANAGEMENT
// =============================================

export function getJwtToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function requireJwtToken() {
  const token = getJwtToken();

  if (!token) {
    throw new Error(
      'Your SMMARIA session was not found. Please sign in again.'
    );
  }

  return token;
}

// =============================================
// URL MANAGEMENT
// =============================================

function joinUrl(base, path) {
  return `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
}

// =============================================
// RESPONSE HANDLING
// =============================================

async function readPayload(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }

  const text = await response.text().catch(() => '');

  return text
    ? { message: text.slice(0, 500) }
    : {};
}

// =============================================
// NETWORK ERROR HANDLING
// =============================================

function networkError(error, serviceName) {
  if (error?.name === 'AbortError') {
    return new Error(
      `${serviceName} did not respond before the request timed out. Please try again.`
    );
  }

  if (error instanceof TypeError) {
    return new Error(
      `Could not reach ${serviceName}. Check that the service is online and that its domain and CORS settings allow https://smmaria.site. Browser network errors can also be caused by DNS or an internet connection problem.`
    );
  }

  return error instanceof Error
    ? error
    : new Error(`An unexpected ${serviceName} error occurred.`);
}

// =============================================
// UNIVERSAL API REQUEST
// =============================================

async function request(
  baseUrl,
  path,
  options,
  serviceName,
  needsAuth = true
) {
  const token = needsAuth
    ? requireJwtToken()
    : null;

  const controller = new AbortController();

  const externalSignal = options.signal;

  const timeoutId = setTimeout(
    () => controller.abort(),
    MARIA_AI_REQUEST_TIMEOUT
  );

  let abortListener;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      abortListener = () => controller.abort();

      externalSignal.addEventListener(
        'abort',
        abortListener,
        { once: true }
      );
    }
  }

  const headers = new Headers(options.headers || {});

  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (needsAuth) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(
      joinUrl(baseUrl, path),
      {
        ...options,
        headers,
        signal: controller.signal,
        cache: options.cache || 'no-store'
      }
    );

    const payload = await readPayload(response);

    // Expired authentication
    if (response.status === 401 && needsAuth) {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {
        // Storage may be unavailable.
      }

      throw new Error(
        'Your SMMARIA session is invalid or expired. Please sign in again.'
      );
    }

    // HTTP errors
    if (!response.ok) {
      throw new Error(
        payload.message ||
        payload.error ||
        `${serviceName} request failed (HTTP ${response.status}).`
      );
    }

    if (payload && payload.success === false) {
      throw new Error(
        payload.message ||
        `${serviceName} rejected the request.`
      );
    }

    return payload;

  } catch (error) {
    if (
      error instanceof TypeError ||
      error?.name === 'AbortError'
    ) {
      throw networkError(error, serviceName);
    }

    throw error;

  } finally {
    clearTimeout(timeoutId);

    if (externalSignal && abortListener) {
      externalSignal.removeEventListener(
        'abort',
        abortListener
      );
    }
  }
}

// =============================================
// SMMMARIA BACKEND REQUEST
// =============================================

export function smmariaApiRequest(path, options = {}) {
  return request(
    SMMARIA_API_BASE_URL,
    path,
    options,
    'SMMARIA authentication service',
    true
  );
}

// =============================================
// MARIA AI BACKEND REQUEST
// =============================================

export function mariaAiApiRequest(path, options = {}) {
  return request(
    MARIA_AI_API_BASE_URL,
    path,
    options,
    'Maria AI service',
    true
  );
}

// =============================================
// VERIFY SMMARIA SESSION
// =============================================

export async function getSmmariaSession() {
  const payload = await smmariaApiRequest(
    SMMARIA_ENDPOINTS.session,
    {
      method: 'GET'
    }
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

// =============================================
// MARIA AI HEALTH CHECK
// =============================================

export async function checkMariaAiConnection() {
  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    10000
  );

  try {
    const response = await fetch(
      joinUrl(MARIA_AI_API_BASE_URL, '/health'),
      {
        method: 'GET',

        headers: {
          Accept: 'application/json'
        },

        signal: controller.signal,

        cache: 'no-store'
      }
    );

    const payload = await readPayload(response);

    if (!response.ok) {
      throw new Error(
        payload.message ||
        `Maria AI health check failed (HTTP ${response.status}).`
      );
    }

    if (
      payload.status !== 'healthy' ||
      payload.service !== 'maria-ai'
    ) {
      throw new Error(
        'The Maria AI server responded, but its health response was not the expected format.'
      );
    }

    return payload;

  } catch (error) {
    if (
      error?.name === 'AbortError' ||
      error instanceof TypeError
    ) {
      throw networkError(error, 'Maria AI service');
    }

    throw error;

  } finally {
    clearTimeout(timeoutId);
  }
}
