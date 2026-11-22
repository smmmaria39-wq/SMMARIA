// Navigation targets verified against the SMMARIA-main (6).zip root files.
const PAGES = [
  { key:'dashboard', title:'Dashboard', url:'dashboard.html', description:'Account overview and dashboard information', terms:['dashboard','overview','home'] },
  { key:'new-order', title:'New Order', url:'new-order.html', description:'Create a new service order', terms:['new order','place order','order service'] },
  { key:'mass-order', title:'Mass Order', url:'mass-order.html', description:'Submit multiple orders', terms:['mass order','bulk order'] },
  { key:'services', title:'Services', url:'services.html', description:'Browse the service catalogue', terms:['services','service','catalogue','catalog','category'] },
  { key:'orders', title:'Orders', url:'orders.html', description:'View order records and statuses', terms:['orders','my order','order status'] },
  { key:'wallet', title:'Wallet', url:'wallet.html', description:'View wallet and payment information', terms:['wallet','balance','deposit','payments','transaction'] },
  { key:'refill', title:'Refill', url:'refill.html', description:'Review refill information', terms:['refill'] },
  { key:'tickets', title:'Tickets', url:'tickets.html', description:'Create and follow support tickets', terms:['ticket','tickets'] },
  { key:'support', title:'Support', url:'support.html', description:'Find support information', terms:['support','help desk'] },
  { key:'notifications', title:'Notifications', url:'notifications.html', description:'View account notifications', terms:['notification','notifications','alerts'] },
  { key:'settings', title:'Settings', url:'settings.html', description:'Manage profile settings', terms:['settings','profile'] },
  { key:'buy-account', title:'Buy Account', url:'buy-account.html', description:'Browse account marketplace information', terms:['buy account','marketplace'] },
  { key:'my-accounts', title:'My Accounts', url:'my-accounts.html', description:'View purchased accounts', terms:['my accounts','purchased accounts'] },
  { key:'buy-child-panel', title:'Buy Child Panel', url:'buy-child-panel.html', description:'Review child panel information', terms:['child panel','reseller panel'] },
  { key:'affiliate', title:'Affiliate', url:'affiliate.html', description:'View affiliate information', terms:['affiliate','referral'] },
  { key:'api', title:'API', url:'api.html', description:'Read API integration documentation', terms:['api','integration'] },
  { key:'documentation', title:'Documentation', url:'documentation.html', description:'Read SMMARIA platform documentation', terms:['documentation','docs','guide'] },
  { key:'invoice', title:'Invoice', url:'invoice.html', description:'View invoice information', terms:['invoice','invoices'] },
  { key:'updates', title:'Updates', url:'updates.html', description:'View platform updates', terms:['updates','update','release notes'] }
];

export function getPageCards(text = '') {
  const query = String(text).toLowerCase();
  return PAGES.filter(page => page.terms.some(term => query.includes(term))).slice(0, 3);
}

export function renderNavigationCards(container, pages = []) {
  if (!container) return;
  const safePages = Array.isArray(pages) ? pages : [];
  container.innerHTML = safePages.map(page =>
    `<div class="ai-nav-card"><div><strong>${escapeHtml(page.title)}</strong><span>${escapeHtml(page.description)}</span></div><a href="${escapeAttribute(page.url)}">Open page →</a></div>`
  ).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}
function escapeAttribute(value) {
  const url = String(value || '');
  return /^[a-z0-9-]+\.html$/i.test(url) ? url : 'dashboard.html';
}
export const SMMARIA_PAGES = PAGES;
