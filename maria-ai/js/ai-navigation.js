const PAGES = [
  { key: 'dashboard', title: 'Dashboard', url: 'dashboard.html', description: 'Account overview, statistics and recent activity', terms: ['dashboard', 'overview', 'home'] },
  { key: 'new-order', title: 'New Order', url: 'new-order.html', description: 'Create a new service order', terms: ['new order', 'place order', 'order service'] },
  { key: 'mass-order', title: 'Mass Order', url: 'mass-order.html', description: 'Prepare multiple orders in one submission', terms: ['mass order', 'bulk order'] },
  { key: 'services', title: 'Services', url: 'services.html', description: 'Browse the available service catalogue', terms: ['services', 'catalogue', 'catalog'] },
  { key: 'orders', title: 'Orders', url: 'orders.html', description: 'View your order records and statuses', terms: ['orders', 'my order', 'order status'] },
  { key: 'wallet', title: 'Wallet', url: 'wallet.html', description: 'View your wallet and payment activity', terms: ['wallet', 'balance', 'deposit', 'payments'] },
  { key: 'refill', title: 'Refill', url: 'refill.html', description: 'Review refill requests and eligibility', terms: ['refill'] },
  { key: 'tickets', title: 'Tickets', url: 'tickets.html', description: 'Create and follow support tickets', terms: ['ticket', 'tickets'] },
  { key: 'support', title: 'Support', url: 'support.html', description: 'Get help from SMMARIA support', terms: ['support', 'help desk'] },
  { key: 'notifications', title: 'Notifications', url: 'notifications.html', description: 'View account notifications', terms: ['notification', 'notifications', 'alerts'] },
  { key: 'settings', title: 'Settings', url: 'settings.html', description: 'Manage permitted profile settings', terms: ['settings', 'profile'] },
  { key: 'buy-account', title: 'Buy Account', url: 'buy-account.html', description: 'Browse marketplace account listings', terms: ['buy account', 'marketplace'] },
  { key: 'my-accounts', title: 'My Accounts', url: 'my-accounts.html', description: 'View your account purchases', terms: ['my accounts', 'purchased accounts'] },
  { key: 'buy-child-panel', title: 'Buy Child Panel', url: 'buy-child-panel.html', description: 'Review child-panel options', terms: ['child panel', 'reseller panel'] },
  { key: 'affiliate', title: 'Affiliate', url: 'affiliate.html', description: 'View referral and affiliate information', terms: ['affiliate', 'referral'] },
  { key: 'api', title: 'API', url: 'api.html', description: 'Read API integration documentation', terms: ['api', 'integration'] },
  { key: 'documentation', title: 'Documentation', url: 'documentation.html', description: 'Read SMMARIA platform documentation', terms: ['documentation', 'docs', 'guide'] },
  { key: 'invoice', title: 'Invoice', url: 'invoice.html', description: 'View available invoices', terms: ['invoice', 'invoices'] }
];

const PAGE_BY_URL = new Map(PAGES.map(page => [page.url, page]));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

export function getPageCards(text = '') {
  const query = String(text).toLowerCase();
  return PAGES.filter(page => page.terms.some(term => query.includes(term))).slice(0, 3);
}

export function renderNavigationCards(container, pages = []) {
  if (!container) return;
  container.replaceChildren();
  pages.forEach(item => {
    // Only allow destinations that exist in this local allowlist. Never trust
    // arbitrary hrefs supplied by a knowledge upload or backend response.
    const page = PAGE_BY_URL.get(String(item.url || '')) || PAGES.find(p => p.key === item.key);
    if (!page) return;

    const card = document.createElement('div');
    card.className = 'ai-nav-card';
    const details = document.createElement('div');
    const title = document.createElement('strong');
    const description = document.createElement('span');
    const link = document.createElement('a');
    title.textContent = item.title || page.title;
    description.textContent = item.description || page.description;
    link.href = page.url;
    link.textContent = 'Open page →';
    details.append(title, description);
    card.append(details, link);
    container.appendChild(card);
  });
}

export const SMMARIA_PAGES = PAGES;
