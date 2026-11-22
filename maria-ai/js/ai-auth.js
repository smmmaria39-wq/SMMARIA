// SMMARIA still uses its existing JWT session. This module validates that session
// through the existing /auth/me API. Firebase Auth is separate and is required
// for private Realtime Database rules. No anonymous/public database access is enabled.

import { getFirebaseServices, FIREBASE_CONFIGURED } from './ai-config.js';

const API_BASE = 'https://smmmaria-backend-production-4513.up.railway.app/api/v1';
export async function getSmmariaSession() {
  const token = localStorage.getItem('smmmaria_token');
  if (!token) throw new Error('Your SMMARIA session has expired. Please sign in again.');
  const response = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Could not verify your SMMARIA session.');
  return payload.data || payload.user || payload;
}

export async function getMariaIdentity() {
  const user = await getSmmariaSession();
  let firebaseUser = null;
  if (FIREBASE_CONFIGURED) {
    const { auth } = getFirebaseServices();
    firebaseUser = auth.currentUser;
  }
  return { user, firebaseUser, canSaveHistory: Boolean(firebaseUser) };
}

export function getJwtToken() { return localStorage.getItem('smmmaria_token'); }
