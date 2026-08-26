// ===============================================
// Reseller Tickets Module
// ===============================================

import { api } from '../utils/api.js';
import { formatDate } from '../utils/formatter.js';

export default async function initTickets() {
 const tbody = document.querySelector('.table tbody');
 if (!tbody) return;
 
 try {
  const response = await api.getPanelTickets();
  const tickets = response.data || [];
  
  if (tickets.length === 0) {
   tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No tickets found.</td></tr>`;
   return;
  }
  
  tbody.innerHTML = tickets.map(t => `
      <tr>
        <td>#${t.id?.substring(0, 8)}</td>
        <td>${t.subject}</td>
        <td><span class="badge badge--${t.priority}">${t.priority}</span></td>
        <td><span class="badge badge--${t.status === 'open' ? 'success' : 'danger'}">${t.status}</span></td>
        <td>${formatDate(t.createdAt)}</td>
      </tr>
    `).join('');
 } catch (error) {
  tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load tickets.</td></tr>`;
 }
};