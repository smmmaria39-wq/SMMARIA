import { db, ref, get, set, update, timestamp } from "./db.js";
import { requireAdvertAuth } from "./auth.js";
import { BUSINESS_CATEGORIES, categoryOptions } from "./categories.js";
import { uploadImages } from "./uploads.js";

const $ = id => document.getElementById(id);
const form = $("portfolioForm");
if (form) initPortfolio();

async function initPortfolio() {
  try {
    const user = await requireAdvertAuth();
    const existing = (await get(ref(db,`smAdvert/users/${user.uid}/business`))).val() || {};
    fillForm(existing);
    const category = $("businessCategory");
    if (category) category.innerHTML = `<option value="">Select a category</option>${categoryOptions(existing.category || "")}`;
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const profileFiles = $("businessProfileImage")?.files;
        const coverFiles = $("businessCoverImage")?.files;
        const profileImages = profileFiles?.length ? await uploadImages(profileFiles,1) : [];
        const coverImages = coverFiles?.length ? await uploadImages(coverFiles,1) : [];
        const methods = [...form.querySelectorAll('[name="paymentMethods"]:checked')].map(x=>x.value);
        const business = {
          businessName:$("businessName").value.trim(),
          username:$("businessUsername").value.trim().replace(/^@/,""),
          location:$("businessLocation").value.trim(),
          category:$("businessCategory").value,
          description:$("businessDescription").value.trim(),
          paymentMethods:methods,
          profilePhoto:profileImages[0] || existing.profilePhoto || "",
          coverImage:coverImages[0] || existing.coverImage || "",
          ownerUid:user.uid, ownerName:user.displayName, updatedAt:timestamp(), status:"active"
        };
        if (!business.businessName || !business.username || !business.category) throw new Error("Complete the business name, username and category.");
        await set(ref(db,`smAdvert/users/${user.uid}/business`),business);
        await set(ref(db,`smAdvert/publicBusinesses/${user.uid}`),business);
        showNotice("Business portfolio saved.");
      } catch(err) { showNotice(err.message,true); }
      finally { submit.disabled=false; }
    });
  } catch(err) { showNotice(err.message,true); }
}
function fillForm(data) {
  const map={businessName:"businessName",businessUsername:"username",businessLocation:"location",businessCategory:"category",businessDescription:"description"};
  Object.entries(map).forEach(([id,key])=>{if($(id)) $(id).value=data[key]||"";});
  (data.paymentMethods||[]).forEach(v=>{const el=[...document.querySelectorAll('[name="paymentMethods"]')].find(x=>x.value===v);if(el)el.checked=true;});
}
function showNotice(message,error=false){const el=$("portfolioNotice")||$("formNotice");if(el){el.textContent=message;el.hidden=false;el.dataset.type=error?"error":"success";}else alert(message);}
