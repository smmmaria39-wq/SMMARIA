// ===============================================
// Reseller Orders Module
// ===============================================

import { api } from '../utils/api.js';
import { formatCurrency, formatDate } from '../utils/formatter.js';

export default async function initOrders() {
 const tbody = document.querySelector('.table tbody');
 if (!tbody) return;
 
 try {
  const response = await api.getPanelOrders();
  const orders = response.data || [];
  
  if (orders.length === 0) {
   tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No orders found.</td></tr>`;
   return;
  }
  
  tbody.innerHTML = orders.map(o => `
      <tr>
        <td>#${o.id?.substring(0, 8)}</td>
        <td>${o.username || 'N/A'}</td>
        <td>${o.serviceName || 'N/A'}</td>
        <td><a href="${o.link}" target="_blank" class="text-link">View</a></td>
        <td>${o.quantity}</td>
        <td>${formatCurrency(o.charge)}</td>
        <td><span class="badge badge--${o.status}">${o.status}</span></td>
      </tr>
    `).join('');
 } catch (error) {
  tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load orders.</td></tr>`;
 }
};