import { db, ref, get, set, push, onValue, timestamp } from "./db.js";
import { requireAdvertAuth } from "./auth.js";
import { escapeHtml } from "./categories.js";
const params=new URLSearchParams(location.search), targetUid=params.get("uid");
const inbox=document.getElementById("conversationList"), thread=document.getElementById("chatMessages"), form=document.getElementById("messageForm");
const input=document.getElementById("messageInput");
async function init(){
 try{
  const user=await requireAdvertAuth();
  if(targetUid&&targetUid!==user.uid) await openConversation(user,targetUid);
  onValue(ref(db,`smAdvert/userConversations/${user.uid}`),snap=>renderInbox(snap.val()||{}));
 }catch(e){if(thread)thread.innerHTML=`<p class="sa-empty">${escapeHtml(e.message)}</p>`;}
}
async function openConversation(user,otherUid){
 const conversationId=[user.uid,otherUid].sort().join("_");
 const path=`smAdvert/conversations/${conversationId}`;
 await set(ref(db,`smAdvert/userConversations/${user.uid}/${conversationId}`),{otherUid,updatedAt:timestamp()});
 if(thread) onValue(ref(db,`${path}/messages`),snap=>{
  const messages=Object.values(snap.val()||{}).sort((a,b)=>a.createdAt-b.createdAt);
  thread.innerHTML=messages.map(m=>`<div class="sa-message ${m.senderUid===user.uid?"mine":""}"><p>${escapeHtml(m.text)}</p><small>${escapeHtml(m.senderName||"User")}</small></div>`).join("")||'<p class="sa-empty">Start the conversation.</p>';
  thread.scrollTop=thread.scrollHeight;
 });
 if(form)form.onsubmit=async e=>{
  e.preventDefault();const text=input?.value.trim();if(!text)return;
  const message=push(ref(db,`${path}/messages`));
  await set(message,{senderUid:user.uid,senderName:user.displayName,text,createdAt:timestamp()});
  await set(ref(db,`smAdvert/userConversations/${otherUid}/${conversationId}`),{otherUid:user.uid,updatedAt:timestamp()});
  input.value="";
 };
}
function renderInbox(items){
 if(!inbox)return;
 const rows=Object.entries(items).sort((a,b)=>(b[1].updatedAt||0)-(a[1].updatedAt||0));
 inbox.innerHTML=rows.map(([id,c])=>`<a href="messages.html?uid=${encodeURIComponent(c.otherUid)}" class="sa-inbox-item">Conversation <small>${new Date(c.updatedAt||Date.now()).toLocaleString()}</small></a>`).join("")||'<p class="sa-empty">No conversations yet.</p>';
}
init();
