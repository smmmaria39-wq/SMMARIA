import { firebaseConfig } from "./firebase-config.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, get, set, update, push, query, orderByChild, equalTo, limitToLast, onValue } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, get, set, update, push, query, orderByChild, equalTo, limitToLast, onValue };
export const timestamp = () => Date.now();
export const readValue = async path => (await get(ref(db,path))).val();
