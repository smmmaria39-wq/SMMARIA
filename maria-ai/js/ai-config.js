// Maria AI configuration.
// No Gemini, OpenAI, Firebase AI Logic, or other AI-model API is used here.
// Firebase is optional and is only used for conversation history.

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyA79GKNHZ9OjaenhXDDFi-IEU58KfqvmYA',
  authDomain: 'smmmaria-ai-assistant.firebaseapp.com',
  // Add the exact Realtime Database URL from Firebase Console to enable history.
  databaseURL: 'https://smmmaria-ai-assistant-default-rtdb.firebaseio.com',
  projectId: 'smmmaria-ai-assistant',
  storageBucket: 'smmmaria-ai-assistant.firebasestorage.app',
  messagingSenderId: '915315015465',
  appId: '1:915315015465:web:6bd62a14add2a3cac94138',
  measurementId: 'G-ZD7N6BNZK5'
};

// History remains optional. Local knowledge search works even when Firebase is unset.
export const FIREBASE_CONFIGURED = !Object.values(firebaseConfig)
  .some(value => String(value).includes('YOUR_'));

let app = null;
let auth = null;
let database = null;

export function getFirebaseServices() {
  if (!FIREBASE_CONFIGURED) {
    throw new Error('Conversation history is not configured.');
  }

  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app, firebaseConfig.databaseURL);
  }

  return { app, auth, database };
}
