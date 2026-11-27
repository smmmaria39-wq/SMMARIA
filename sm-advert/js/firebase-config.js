// SM ADVERT Firebase Realtime Database configuration.
// Replace the placeholder values with your Firebase Web App configuration.
// Firebase client config is public; protect all data with Realtime Database Rules.
export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID"
};

export const SM_ADVERT_CONFIG = {
  // Existing SMMARIA backend API base (the same backend used by assets/utils/api.js).
  apiBaseUrl: "https://smmmaria-backend-production-4513.up.railway.app/api/v1",
  // This secure endpoint must validate smmmaria_token and return a Firebase custom token.
  // Expected JSON: { customToken: "...", uid: "...", displayName: "...", email: "..." }
  firebaseTokenEndpoint: "/sm-advert/auth/firebase-token",
  imgbbKey: "YOUR_IMGBB_API_KEY",
  maxUploadImages: 10,
  maxProductImages: 5
};
