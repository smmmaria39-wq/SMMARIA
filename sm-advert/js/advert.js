import { db, ref, get, query, orderByChild, limitToLast } from "./db.js";
import { escapeHtml } from "./categories.js";
import { requireAdvertAuth } from "./auth.js";

const productsGrid=document.getElementById("advertProducts");
const businessesGrid=document.getElementById("advertBusinesses");
const search=document.getElementById("advertSearch");
const category=document.getElementById("advertCategory");

async function loadMarketplace(){
  try {
    await requireAdvertAuth();
    const [productsSnap,businessesSnap]=await Promise.all([
      get(query(ref(db,"smAdvert/publicProducts"),orderByChild("createdAt"),limitToLast(100))),
      get(ref(db,"smAdvert/publicBusinesses"))
    ]);
    const products=Object.entries(productsSnap.val()||{}).map(([id,v])=>({id,...v})).reverse();
    const businesses=Object.entries(businessesSnap.val()||{}).map(([id,v])=>({id,...v}));
    renderProducts(products); renderBusinesses(businesses);
    [search,category].forEach(el=>el?.addEventListener("input",()=>renderProducts(products)));
  } catch(e){ if(productsGrid) productsGrid.innerHTML=`<p class="sa-empty">${escapeHtml(e.message)}</p>`; }
}
function renderProducts(items){
  if(!productsGrid)return;
  const term=(search?.value||"").toLowerCase(), cat=category?.value||"";
  const filtered=items.filter(p=>(!cat||p.category===cat)&&(`${p.name||""} ${p.description||""} ${p.category||""}`).toLowerCase().includes(term));
  productsGrid.innerHTML=filtered.length?filtered.map(p=>`<a class="sa-product" href="product.html?id=${encodeURIComponent(p.id)}"><img src="${escapeHtml(p.images?.[0]||"")}" alt=""><div class="sa-product-body"><span class="sa-kicker">${escapeHtml(p.category||"ICT")}</span><h3>${escapeHtml(p.name||"Untitled")}</h3><p>${escapeHtml(p.description||"")}</p><strong>${p.price?escapeHtml(p.currency||"USD")+" "+escapeHtml(p.price):"Contact seller"}</strong></div></a>`).join(""):`<p class="sa-empty">No listings found yet.</p>`;
}
function renderBusinesses(items){
  if(!businessesGrid)return;
  businessesGrid.innerHTML=items.length?items.map(b=>`<a class="sa-business" href="portfolio.html?uid=${encodeURIComponent(b.ownerUid||b.id)}"><img src="${escapeHtml(b.profilePhoto||"")}" alt=""><div><h3>${escapeHtml(b.businessName||"ICT Business")}</h3><p>${escapeHtml(b.category||"ICT")} · ${escapeHtml(b.location||"")}</p></div></a>`).join(""):`<p class="sa-empty">No business portfolios yet.</p>`;
}
loadMarketplace();
