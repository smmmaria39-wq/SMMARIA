// SM ADVERT Firebase Realtime Database configuration.
// Replace the placeholder values with your Firebase Web App configuration.
// Firebase client config is public; protect all data with Realtime Database Rules.
export const firebaseConfig = {
  apiKey: "AIzaSyDIPHbWe5Z5oT4n3UZRs5bQy3haI__Fbrg",
  authDomain: "smmarket-39bbf.firebaseapp.com",
  projectId: "smmarket-39bbf",
  storageBucket: "smmarket-39bbf.firebasestorage.app",
  messagingSenderId: "175807183628",
  appId: "1:175807183628:web:20de0ab2077531676fe729",
  measurementId: "G-SZLQG41DB1"
};

export const SM_ADVERT_CONFIG = {
  // Existing SMMARIA backend API base (the same backend used by assets/utils/api.js).
  apiBaseUrl: "https://smmmaria-backend-production-4513.up.railway.app/api/v1",
  // This secure endpoint must validate smmmaria_token and return a Firebase custom token.
  // Expected JSON: { customToken: "...", uid: "...", displayName: "...", email: "..." }
  firebaseTokenEndpoint: "/sm-advert/auth/firebase-token",
  imgbbKey: "47f7dff148164ff31a5947e6ee635363";
  maxUploadImages: 10,
  maxProductImages: 5
};
