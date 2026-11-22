# Maria AI installation checklist

- [ ] Place `ai.html` in the project root.
- [ ] Place `maria-ai/` in the project root.
- [ ] Add Firebase Web App config to `maria-ai/js/ai-config.js`.
- [ ] Confirm the Realtime Database URL and Firebase project ID.
- [ ] Enable Firebase AI Logic and the Gemini Developer API backend.
- [ ] Confirm the configured Gemini model is enabled for the project.
- [ ] Integrate Firebase Authentication with the SMMARIA JWT session (recommended: backend-issued Firebase custom token).
- [ ] Apply `maria-ai/database.rules.json` only after Firebase Auth integration is tested.
- [ ] Enable Firebase App Check and review quotas.
- [ ] Test chat using a normal customer account.
- [ ] Test that a second user cannot read the first user's history.
- [ ] Test consent off, consent on, chat history loading and deletion.

Do not make Realtime Database publicly readable or writable to make the demo work.
