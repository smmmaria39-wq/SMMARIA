// ===============================================
// API Utility (Reseller Frontend)
// resellers/assets/js/utils/api.js
// ===============================================

const API_BASE_URL = 'https://smmmaria-backend-production.up.railway.app/api/v1';

async function request(endpoint, method = 'GET', body = null) {
 const token = localStorage.getItem('smmmaria_reseller_token');
 const panelDomain = window.location.hostname;
 
 const headers = { 'Content-Type': 'application/json' };
 if (token) headers['Authorization'] = `Bearer ${token}`;
 if (panelDomain) headers['X-Panel-Domain'] = panelDomain;
 
 const config = { method, headers };
 if (body) config.body = JSON.stringify(body);
 
 try {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  const data = await response.json();
  
  if (!response.ok) {
   throw new Error(data.message || 'Something went wrong');
  }
  return data;
 } catch (error) {
  console.error(`API Error [${endpoint}]:`, error.message);
  throw error;
 }
}

export const api = {
 // --- Authentication ---
 login: (identifier, password) => request('/child-panel/auth/login', 'POST', { identifier, password }),
 register: (data) => request('/child-panel/auth/register', 'POST', data),
 getMe: () => request('/child-panel/auth/me'),
 
 // --- Dashboard & Panel Info ---
 getPanelStats: () => request('/child-panel/stats'),
 getMyPanel: () => request('/child-panel/me'),
 updatePanelBranding: (data) => request('/child-panel/branding', 'PUT', data),
 
 // --- User Management ---
 getPanelUsers: () => request('/child-panel/users'),
 updatePanelUserStatus: (id, status) => request(`/child-panel/users/${id}/status`, 'PUT', { status }),
 fundChildUser: (id, amount) => request(`/child-panel/users/${id}/fund`, 'POST', { amount }),
 
 // --- Orders ---
 getPanelOrders: () => request('/child-panel/orders'),
 createChildOrder: (data) => request('/child-panel/orders', 'POST', data),
 
 // --- Services & Pricing ---
 getPanelServices: () => request('/child-panel/services'),
 bulkUpdatePanelPrices: (updates) => request('/child-panel/services/bulk-update', 'PUT', { updates }),
 
 // --- Wallet & Announcements ---
 getPanelTransactions: () => request('/child-panel/wallet/transactions'),
 requestPanelDeposit: (data) => request('/child-panel/wallet/deposit', 'POST', data),
 getPanelAnnouncements: () => request('/child-panel/announcements'),
 createPanelAnnouncement: (data) => request('/child-panel/announcements', 'POST', data),
 deletePanelAnnouncement: (id) => request(`/child-panel/announcements/${id}`, 'DELETE')
};