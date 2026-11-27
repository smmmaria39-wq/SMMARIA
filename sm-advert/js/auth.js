import { firebaseConfig, SM_ADVERT_CONFIG } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export let currentAdvertUser = null;

const token = () => localStorage.getItem("smmmaria_token");

export async function requireAdvertAuth() {
  if (!token()) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = `login.html?redirect=${next}`;
    throw new Error("Please sign in to SMMARIA first.");
  }
  if (currentAdvertUser) return currentAdvertUser;

  const response = await fetch(`${SM_ADVERT_CONFIG.apiBaseUrl}${SM_ADVERT_CONFIG.firebaseTokenEndpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.customToken) {
    throw new Error(payload.message || "SM ADVERT secure sign-in is not configured. The SMMARIA backend must provide the Firebase custom-token bridge.");
  }
  const credential = await signInWithCustomToken(firebaseAuth, payload.customToken);
  currentAdvertUser = {
    uid: credential.user.uid,
    displayName: payload.displayName || credential.user.displayName || "SMMARIA User",
    email: payload.email || credential.user.email || ""
  };
  return currentAdvertUser;
}

export function watchAdvertAuth(callback) {
  return onAuthStateChanged(firebaseAuth, user => {
    currentAdvertUser = user ? { uid: user.uid, displayName: user.displayName || "SMMARIA User", email: user.email || "" } : null;
    callback(currentAdvertUser);
  });
}
