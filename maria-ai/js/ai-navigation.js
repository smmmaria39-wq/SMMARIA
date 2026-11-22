const PAGES = [
  {key:'dashboard',title:'Dashboard',url:'dashboard.html',description:'Account overview, statistics and recent activity',terms:['dashboard','overview','home']},
  {key:'new-order',title:'New Order',url:'new-order.html',description:'Create a new service order',terms:['new order','place order','order service']},
  {key:'mass-order',title:'Mass Order',url:'mass-order.html',description:'Prepare multiple orders in one submission',terms:['mass order','bulk order']},
  {key:'services',title:'Services',url:'services.html',description:'Browse the available service catalogue',terms:['services','catalogue','catalog']},
  {key:'orders',title:'Orders',url:'orders.html',description:'View your order records and statuses',terms:['orders','my order','order status']},
  {key:'wallet',title:'Wallet',url:'wallet.html',description:'View your wallet and payment activity',terms:['wallet','balance','deposit','payments']},
  {key:'refill',title:'Refill',url:'refill.html',description:'Review refill requests and eligibility',terms:['refill']},
  {key:'tickets',title:'Tickets',url:'tickets.html',description:'Create and follow support tickets',terms:['ticket','tickets']},
  {key:'support',title:'Support',url:'support.html',description:'Get help from SMMARIA support',terms:['support','help desk']},
  {key:'notifications',title:'Notifications',url:'notifications.html',description:'View account notifications',terms:['notification','notifications','alerts']},
  {key:'settings',title:'Settings',url:'settings.html',description:'Manage permitted profile settings',terms:['settings','profile']},
  {key:'buy-account',title:'Buy Account',url:'buy-account.html',description:'Browse marketplace account listings',terms:['buy account','marketplace']},
  {key:'my-accounts',title:'My Accounts',url:'my-accounts.html',description:'View your account purchases',terms:['my accounts','purchased accounts']},
  {key:'buy-child-panel',title:'Buy Child Panel',url:'buy-child-panel.html',description:'Review child-panel options',terms:['child panel','reseller panel']},
  {key:'affiliate',title:'Affiliate',url:'affiliate.html',description:'View referral and affiliate information',terms:['affiliate','referral']},
  {key:'api',title:'API',url:'api.html',description:'Read API integration documentation',terms:['api','integration']},
  {key:'documentation',title:'Documentation',url:'documentation.html',description:'Read SMMARIA platform documentation',terms:['documentation','docs','guide']},
  {key:'invoice',title:'Invoice',url:'invoice.html',description:'View available invoices',terms:['invoice','invoices']}
];
export function getPageCards(text='') {
  const q=String(text).toLowerCase();
  return PAGES.filter(p=>p.terms.some(t=>q.includes(t))).slice(0,3);
}
export function renderNavigationCards(container,pages) {
  if(!container) return;
  container.innerHTML=pages.map(p=>`<div class="ai-nav-card"><div><strong>${escapeHtml(p.title)}</strong><span>${escapeHtml(p.description)}</span></div><a href="${p.url}">Open page →</a></div>`).join('');
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export const SMMARIA_PAGES=PAGES;
