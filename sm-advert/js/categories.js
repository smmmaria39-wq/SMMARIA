export const BUSINESS_CATEGORIES = [
  "Web Design & Development","Software & App Development","Graphic Design","UI/UX Design",
  "Digital Marketing","SEO Services","Social Media Management","IT Support & Consulting",
  "Computer & Laptop Sales","Computer Accessories","Mobile Phones & Accessories","Networking & Internet",
  "Cybersecurity","Cloud Services","Data Recovery","Printing & Branding","Photography & Videography",
  "Computer Repair","Phone Repair","CCTV & Security Systems","Electronics & Gadgets",
  "Hosting & Domains","AI & Automation","E-commerce Solutions","Training & Education",
  "Tech Recruitment","POS & Business Systems","Gaming & Streaming Equipment","Digital Products","Other ICT Services"
];

export function categoryOptions(selected = "") {
  return BUSINESS_CATEGORIES.map(c => `<option value="${escapeHtml(c)}" ${c===selected?"selected":""}>${escapeHtml(c)}</option>`).join("");
}
export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
