import { SM_ADVERT_CONFIG } from "./firebase-config.js";

export async function uploadImage(file) {
  if (!file || !file.type?.startsWith("image/")) throw new Error("Choose a valid image file.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Each image must be 8 MB or smaller.");
  if (!SM_ADVERT_CONFIG.imgbbKey || SM_ADVERT_CONFIG.imgbbKey === "YOUR_IMGBB_API_KEY") {
    throw new Error("Add your ImgBB API key in sm-advert/js/firebase-config.js first.");
  }
  const form = new FormData();
  form.append("image", file);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(SM_ADVERT_CONFIG.imgbbKey)}`, { method:"POST", body:form });
  const data = await response.json();
  if (!response.ok || !data.success || !data.data?.url) throw new Error(data.error?.message || "Image upload failed.");
  return data.data.url;
}

export async function uploadImages(fileList, max = 5) {
  const files = Array.from(fileList || []);
  if (files.length > max) throw new Error(`You can upload up to ${max} images.`);
  return Promise.all(files.map(uploadImage));
}
