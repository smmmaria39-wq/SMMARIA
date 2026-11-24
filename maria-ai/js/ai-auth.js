
import {
    SMMARIA_API_BASE_URL,
    MARIA_AI_API_BASE_URL,
    SMMARIA_ENDPOINTS,
    MARIA_AI_REQUEST_TIMEOUT
} from './ai-config.js';

// =============================================
// JWT TOKEN MANAGEMENT
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
// SHARED REQUEST HANDLER
// =============================================

async function sendApiRequest(baseUrl, path, options = {}, serviceName = 'API') {

    const token = requireJwtToken();

    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        MARIA_AI_REQUEST_TIMEOUT
    );

    try {

        const url =
            `${baseUrl.replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;

        const response = await fetch(url, {

            ...options,

            signal: options.signal || controller.signal,

            headers: {
                Accept: 'application/json',

                ...(options.body ? {
                    'Content-Type': 'application/json'
                } : {}),

                ...(options.headers || {}),

                Authorization: `Bearer ${token}`
            }

        });

        const payload = await response.json().catch(() => ({}));

        // =====================================
        // AUTHENTICATION ERRORS
        // =====================================

        if (response.status === 401) {

            // Only invalidate the central SMMARIA
            // session when its own authentication fails.
            if (serviceName === 'SMMARIA') {
                localStorage.removeItem('smmmaria_token');

                throw new Error(
                    'Your SMMARIA session has expired. Please sign in again.'
                );
            }

            throw new Error(
                payload.message ||
                'Maria AI could not authenticate your session. Please verify the backend authentication configuration.'
            );
        }

        // =====================================
        // OTHER SERVER ERRORS
        // =====================================

        if (!response.ok) {

            throw new Error(
                payload.message ||
                payload.error ||
                `${serviceName} request failed (${response.status}).`
            );

        }

        return payload;

    } catch (error) {

        if (error.name === 'AbortError') {

            throw new Error(
                `${serviceName} request timed out. Please try again.`
            );

        }

        if (
            error instanceof TypeError &&
            error.message
        ) {

            throw new Error(
                `Unable to connect to ${serviceName}. Check the server, internet connection and CORS configuration.`
            );

        }

        throw error;

    } finally {

        clearTimeout(timeout);

    }

}

// =============================================
// SMMARIA BACKEND REQUEST
// Authentication and user identity
// =============================================

export async function smmariaApiRequest(path, options = {}) {

    return sendApiRequest(
        SMMARIA_API_BASE_URL,
        path,
        options,
        'SMMARIA'
    );

}

// =============================================
// MARIA AI BACKEND REQUEST
// Chat, knowledge and conversations
// =============================================

export async function mariaAiApiRequest(path, options = {}) {

    return sendApiRequest(
        MARIA_AI_API_BASE_URL,
        path,
        options,
        'Maria AI'
    );

}

// =============================================
// VERIFY SMMARIA USER SESSION
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
