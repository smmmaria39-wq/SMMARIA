import { db, ref, get, push, set, timestamp } from "./db.js";
import { requireAdvertAuth } from "./auth.js";
import { uploadImages } from "./uploads.js";
import { escapeHtml } from "./categories.js";
const params=new URLSearchParams(location.search), id=params.get("id"), uid=params.get("uid");
const detail=document.getElementById("productDetail") || document.getElementById("productInfo"), form=document.getElementById("productForm");
const $=id=>document.getElementById(id);
async function init(){
 try{
  const user=await requireAdvertAuth();
  if(id){const p=(await get(ref(db,`smAdvert/publicProducts/${id}`))).val();if(!p)throw new Error("This listing could not be found.");renderProduct(p);return;}
  if(uid){const b=(await get(ref(db,`smAdvert/publicBusinesses/${uid}`))).val();if(!b)throw new Error("Business not found.");renderBusiness(b,uid);return;}
  if(form) initForm(user);
 }catch(e){if(detail)detail.innerHTML=`<p class="sa-empty">${escapeHtml(e.message)}</p>`;}
}
function renderProduct(p){
 if(!detail)return;
 detail.innerHTML=`<div class="sa-detail"><div class="sa-gallery">${(p.images||[]).map(src=>`<img src="${escapeHtml(src)}" alt="${escapeHtml(p.name)}">`).join("")}</div><div><span class="sa-kicker">${escapeHtml(p.category||"ICT")}</span><h1>${escapeHtml(p.name||"")}</h1><p>${escapeHtml(p.description||"")}</p><h2>${p.price?escapeHtml(p.currency||"USD")+" "+escapeHtml(p.price):"Contact seller"}</h2><p>${escapeHtml(p.availability||"Available")}</p><a class="sa-button" href="portfolio.html?uid=${encodeURIComponent(p.ownerUid)}">View seller</a>${p.externalUrl?`<a class="sa-button sa-button-light" target="_blank" rel="noopener noreferrer" href="${escapeHtml(p.externalUrl)}">Visit seller link</a>`:""}</div></div>`;
}
function renderBusiness(b,ownerUid){
 if(!detail)return;
 detail.innerHTML=`<section class="sa-business-profile"><div class="sa-cover" style="background-image:url('${escapeHtml(b.coverImage||"")}')"></div><img class="sa-avatar" src="${escapeHtml(b.profilePhoto||"")}" alt=""><h1>${escapeHtml(b.businessName||"")}</h1><p>@${escapeHtml(b.username||"")} · ${escapeHtml(b.location||"")}</p><span>${escapeHtml(b.category||"")}</span><p>${escapeHtml(b.description||"")}</p><p>Payment: ${escapeHtml((b.paymentMethods||[]).join(", "))}</p><a class="sa-button" href="messages.html?uid=${encodeURIComponent(ownerUid)}">Message business</a></section>`;
}
function initForm(user){
 form.addEventListener("submit",async e=>{
  e.preventDefault();const btn=form.querySelector('[type="submit"]');btn.disabled=true;
  try{
   const files=$("productImages")?.files;const images=files?.length?await uploadImages(files,5):[];
   const product={name:$("productName").value.trim(),description:$("productDescription").value.trim(),category:$("productCategory").value,price:$("productPrice").value.trim(),currency:$("productCurrency")?.value||"USD",images,externalUrl:$("productUrl").value.trim(),availability:$("productAvailability").value||"Available",ownerUid:user.uid,ownerName:user.displayName,createdAt:timestamp(),status:"active"};
   if(!product.name||!product.category)throw new Error("Product name and category are required.");
   const item=push(ref(db,"smAdvert/publicProducts"));await set(item,product);
   await set(ref(db,`smAdvert/users/${user.uid}/products/${item.key}`),product);
   form.reset();alert("Listing published.");
  }catch(err){alert(err.message);}finally{btn.disabled=false;}
 });
}
init();
