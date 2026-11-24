
/*
=====================================================
 MARIA AI — CONVERSATION HISTORY
=====================================================

All conversation operations use the dedicated
Maria AI backend.

Authentication uses the existing SMMARIA JWT.
=====================================================
*/

import { mariaAiApiRequest } from './ai-auth.js';

import {
    MARIA_AI_ENDPOINTS
} from './ai-config.js';

// =============================================
// RESPONSE NORMALIZATION
// =============================================

function unwrap(payload) {

    return payload && payload.data !== undefined
        ? payload.data
        : payload;

}

// =============================================
// LIST CONVERSATIONS
// =============================================

export async function listConversations(onUpdate = () => {}) {

    const payload = await mariaAiApiRequest(
        MARIA_AI_ENDPOINTS.conversations,
        {
            method: 'GET'
        }
    );

    const data = unwrap(payload);

    const rows = Array.isArray(data)
        ? data
        : (data?.conversations || []);

    onUpdate(rows);

    return () => {};

}

// =============================================
// LOAD INDIVIDUAL CONVERSATION
// =============================================

export async function loadConversation(id) {

    if (!id) {
        throw new Error('Conversation not found.');
    }

    const payload = await mariaAiApiRequest(
        MARIA_AI_ENDPOINTS.conversation(id),
        {
            method: 'GET'
        }
    );

    return unwrap(payload);

}

// =============================================
// CREATE CONVERSATION
// =============================================

export async function createConversation(title) {

    const payload = await mariaAiApiRequest(
        MARIA_AI_ENDPOINTS.conversations,
        {
            method: 'POST',

            body: JSON.stringify({
                title: String(title || 'New conversation').slice(0, 100)
            })
        }
    );

    const data = unwrap(payload);

    const id = data?.id || data?.conversationId;

    if (!id) {
        throw new Error(
            'The Maria AI server did not return a conversation ID.'
        );
    }

    return id;

}

// =============================================
// SAVE MESSAGE
// =============================================

export async function saveMessage(conversationId, message) {

    if (!conversationId) return;

    const payload = await mariaAiApiRequest(
        MARIA_AI_ENDPOINTS.saveMessage(conversationId),
        {
            method: 'POST',

            body: JSON.stringify({

                role: message.role === 'assistant'
                    ? 'assistant'
                    : 'user',

                content: String(message.content || '').slice(0, 8000)

            })
        }
    );

    return unwrap(payload);

}

// =============================================
// DELETE ALL CONVERSATIONS
// =============================================

export async function deleteAllConversations() {

    const payload = await mariaAiApiRequest(
        MARIA_AI_ENDPOINTS.conversations,
        {
            method: 'DELETE'
        }
    );

    return unwrap(payload);

}

// =============================================
// LOCAL CONVERSATION CONSENT
// =============================================

const CONSENT_KEY = 'maria_ai_history_consent';

export async function getConsent() {

    return localStorage.getItem(CONSENT_KEY) === 'true';

}

export async function setConsent(enabled) {

    localStorage.setItem(
        CONSENT_KEY,
        enabled ? 'true' : 'false'
    );

    return enabled;

}
