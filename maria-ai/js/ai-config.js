// Maria AI Firebase configuration.
// IMPORTANT: Replace the placeholder values with your Firebase Web App config.
// This project ZIP did not contain the Firebase web config or frontend initialization.
// Reuse the same Firebase project as SMMARIA. Do not put service-account keys here.

import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA79GKNHZ9OjaenhXDDFi-IEU58KfqvmYA",
  authDomain: "smmmaria-ai-assistant.firebaseapp.com",
  projectId: "smmmaria-ai-assistant",
  storageBucket: "smmmaria-ai-assistant.firebasestorage.app",
  messagingSenderId: "915315015465",
  appId: "1:915315015465:web:6bd62a14add2a3cac94138",
  measurementId: "G-ZD7N6BNZK5"
};

export const AI_MODEL_NAME = 'gemini-2.5-flash';
export const FIREBASE_CONFIGURED = !Object.values(firebaseConfig).some(v => String(v).includes('YOUR_'));

let app = null, auth = null, database = null, model = null;
export function getFirebaseServices() {
  if (!FIREBASE_CONFIGURED) throw new Error('Firebase is not configured. Edit maria-ai/js/ai-config.js with your Firebase Web App settings first.');
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app);
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    model = getGenerativeModel(ai, { model: AI_MODEL_NAME });
  }
  return { app, auth, database, model };
}

export function getConfiguredModel() { return getFirebaseServices().model; }
