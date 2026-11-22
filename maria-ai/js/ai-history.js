import { getFirebaseServices } from './ai-config.js';
import { ref, push, set, get, update, remove, onValue, query, orderByChild, limitToLast } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js';

function userRoot(uid) { return `mariaAI/users/${uid}`; }
function requireUid() {
  const { auth } = getFirebaseServices();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Conversation saving needs a signed-in Firebase Authentication user. Your SMMARIA JWT alone is not a Firebase Auth credential.');
  return uid;
}
export async function getConsent() {
  try { const uid=requireUid(); const {database}=getFirebaseServices(); const s=await get(ref(database,`${userRoot(uid)}/preferences/conversationConsent`)); return s.val()===true; }
  catch { return false; }
}
export async function setConsent(value) {
  const uid=requireUid(), {database}=getFirebaseServices();
  await set(ref(database,`${userRoot(uid)}/preferences/conversationConsent`),Boolean(value));
}
export async function createConversation(title='New conversation') {
  const uid=requireUid(), {database}=getFirebaseServices();
  const listRef=ref(database,`${userRoot(uid)}/conversations`);
  const newRef=push(listRef); const now=Date.now();
  await set(newRef,{title,createdAt:now,updatedAt:now,messages:{}});
  return newRef.key;
}
export async function saveMessage(conversationId,message) {
  const uid=requireUid(), {database}=getFirebaseServices();
  const base=`${userRoot(uid)}/conversations/${conversationId}`;
  const msgRef=push(ref(database,`${base}/messages`));
  await set(msgRef,{role:message.role,content:String(message.content).slice(0,12000),timestamp:Date.now()});
  await update(ref(database,base),{updatedAt:Date.now()});
  return msgRef.key;
}
export async function listConversations(callback) {
  const uid=requireUid(), {database}=getFirebaseServices();
  return onValue(query(ref(database,`${userRoot(uid)}/conversations`),orderByChild('updatedAt'),limitToLast(50)),snap=>{
    const rows=[]; snap.forEach(child=>rows.push({id:child.key,...child.val()}));
    callback(rows.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)));
  });
}
export async function loadConversation(id) {
  const uid=requireUid(), {database}=getFirebaseServices();
  const snap=await get(ref(database,`${userRoot(uid)}/conversations/${id}`));
  if(!snap.exists()) throw new Error('Conversation not found.');
  return {id,...snap.val()};
}
export async function renameConversation(id,title) {
  const uid=requireUid(), {database}=getFirebaseServices();
  await update(ref(database,`${userRoot(uid)}/conversations/${id}`),{title:String(title).slice(0,80),updatedAt:Date.now()});
}
export async function deleteConversation(id) {
  const uid=requireUid(), {database}=getFirebaseServices();
  await remove(ref(database,`${userRoot(uid)}/conversations/${id}`));
}
export async function deleteAllConversations() {
  const uid=requireUid(), {database}=getFirebaseServices();
  await remove(ref(database,`${userRoot(uid)}/conversations`));
}
