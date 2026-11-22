# Maria AI — SMMARIA standalone module

This package adds a root-level `ai.html` page and keeps Maria AI's styles and modules inside `maria-ai/`.

## What was inspected

The supplied SMMARIA archive contains:
- `assets/js/app.js` as the customer frontend entry point.
- `assets/utils/api.js` with the existing JWT-authenticated API client.
- Existing API methods for `/auth/me`, services, orders, wallet, payments, tickets, refills, notifications and account purchases.
- A documented backend architecture using Node.js/Express, Firebase Admin SDK and Firebase Realtime Database.

The supplied archive did **not** contain a Firebase Web App configuration or a complete frontend Firebase initialization module. The config in `js/ai-config.js` is therefore a placeholder and must be completed before Gemini and Realtime Database history can run.

## Installation

1. Copy `ai.html` into the SMMARIA project root (beside `dashboard.html`, `wallet.html`, etc.).
2. Copy the entire `maria-ai/` directory into that same root.
3. Serve the site over HTTPS (or localhost during development). Do not open the HTML directly with `file://`.
4. Edit `maria-ai/js/ai-config.js` with the Firebase Web App configuration for the existing SMMARIA Firebase project. Include the correct `databaseURL` for your Realtime Database instance.
5. In Firebase Console, enable Firebase AI Logic and select the Gemini Developer API backend. Confirm the selected model is available for your project/region; change `AI_MODEL_NAME` if necessary.
6. Enable Firebase Authentication for the identity provider used by the AI page, or integrate the existing SMMARIA JWT session with Firebase Authentication using a backend-issued Firebase custom token. **Do not enable public Realtime Database rules.**
7. Apply `database.rules.json` to the Realtime Database rules editor, after confirming the authentication integration. These rules permit each Firebase Auth UID to access only `mariaAI/users/{uid}`.
8. Test with a non-admin customer account and verify that a second account cannot read the first account's chat path.

## Important authentication note

SMMARIA's existing frontend uses `localStorage.smmmaria_token` and the backend `/auth/me` endpoint. A SMMARIA JWT is **not** automatically a Firebase Authentication credential. This package validates the SMMARIA session for AI use and calls the existing API with the existing JWT. Realtime Database chat history requires `auth.currentUser` from Firebase Authentication.

For a production deployment where chat history follows the same SMMARIA account across devices, the recommended integration is for the existing backend to verify the SMMARIA JWT and issue a Firebase custom token with the Firebase Admin SDK. Then the frontend signs into Firebase Auth with that custom token. That endpoint is not present in the supplied archive, so this ZIP does not invent it or pretend history is already connected. Until Firebase Auth is integrated, chat can run once Firebase config is complete, but history saving remains unavailable.

## Existing API access included

The assistant uses the existing `assets/utils/api.js` client and only requests account data relevant to the user's question:
- Profile: `getMe()`
- Wallet and payment records: `getWallet()`, `getPayments()`
- Services and categories: `getServices()`, `getCategories()`
- Orders: `getOrders()`
- Tickets: `getTickets()`
- Refills: `getRefills()`
- Notifications: `getNotifications()`
- Account purchases: `getMyAccountPurchases()`

The assistant is read-only. It does not submit orders, deposits, purchases, refill requests, profile changes or other financial/account-changing actions.

## Realtime Database data structure

```text
mariaAI/
  users/
    {firebaseAuthUid}/
      preferences/
        conversationConsent: true|false
      conversations/
        {conversationId}/
          title
          createdAt
          updatedAt
          messages/
            {messageId}/
              role
              content
              timestamp
```

Conversation persistence is opt-in. Users can view their saved conversations and delete individual conversations (the store module supports this) or all saved conversations from the privacy dialog.

## Notes

- Firebase web configuration values identify the project; never place Firebase Admin service-account JSON, private keys, payment credentials or supplier secrets in browser files.
- Configure Firebase App Check and review Firebase AI Logic quotas/usage before production.
- This package uses Firebase JS SDK 12.19.0 modules from Google's CDN. If your deployment uses a Content Security Policy, allow the required Firebase module origins.
- `ai-navigation.js` contains links to the page names listed in the project documentation. If your deployed filenames differ, update that file.
- No existing sidebar, navbar, or `assets/js/app.js` files are modified by this package.
