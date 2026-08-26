// ===============================================
// Reseller Dashboard Module (Handles Owner & Child User)
// ===============================================

import { api } from '../utils/api.js';
import { formatCurrency } from '../utils/formatter.js';

export default async function initDashboard() {
 const balanceEl = document.querySelector('.navbar__balance strong');
 const statCards = document.querySelectorAll('.stat-card__value');
 const tbody = document.querySelector('.table tbody');
 
 try {
  // 1. Fetch User Profile (Works for both Owner and Child User)
  const meRes = await api.getMe();
  const user = meRes.data || {};
  const role = user.role;
  
  // Update Navbar Balance
  const balance = user.balance || 0;
  if (balanceEl) balanceEl.textContent = formatCurrency(balance);
  
  // 2. If the user is the RESELLER OWNER, fetch panel stats
  if (role === 'reseller') {
   try {
    const statsRes = await api.getPanelStats();
    const stats = statsRes.data || {};
    
    if (statCards.length >= 3) {
     statCards[0].textContent = stats.totalUsers || 0;
     statCards[1].textContent = stats.totalOrders || 0;
     statCards[2].textContent = formatCurrency(stats.totalRevenue || 0);
    }
    
    const ordersRes = await api.getPanelOrders();
    const orders = ordersRes.data || [];
    
    if (tbody) {
     if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No orders yet.</td></tr>`;
     } else {
      tbody.innerHTML = orders.slice(0, 5).map(o => `
              <tr>
                <td>#${o.id?.substring(0, 8)}</td>
                <td>${o.username || 'Unknown'}</td>
                <td>${o.serviceName || 'N/A'}</td>
                <td>${formatCurrency(o.charge)}</td>
                <td><span class="badge badge--${o.status}">${o.status}</span></td>
              </tr>
            `).join('');
     }
    }
   } catch (error) {
    console.error('Could not load reseller stats:', error);
   }
   
  }
  // 3. If the user is a CHILD USER (Customer), show their personal stats
  else if (role === 'child_user') {
   if (statCards.length >= 3) {
    // Change the labels for the customer
    const labels = document.querySelectorAll('.stat-card__label');
    if (labels[0]) labels[0].textContent = 'My Orders';
    if (labels[1]) labels[1].textContent = 'Total Spent';
    if (labels[2]) labels[2].textContent = 'Account Balance';
    
    // Hide the withdrawal button for customers
    const withdrawBtn = document.getElementById('withdrawBtn');
    if (withdrawBtn) withdrawBtn.style.display = 'none';
    
    // Fetch customer orders to get count and spent
    try {
     const ordersRes = await api.getPanelOrders(); // This endpoint will return only THEIR orders based on JWT
     const orders = ordersRes.data || [];
     
     statCards[0].textContent = orders.length;
     statCards[1].textContent = formatCurrency(user.spent || 0);
     statCards[2].textContent = formatCurrency(user.balance || 0);
     
     if (tbody) {
      if (orders.length === 0) {
       tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No orders yet.</td></tr>`;
      } else {
       tbody.innerHTML = orders.slice(0, 5).map(o => `
                <tr>
                  <td>#${o.id?.substring(0, 8)}</td>
                  <td>${user.username}</td>
                  <td>${o.serviceName || 'N/A'}</td>
                  <td>${formatCurrency(o.charge)}</td>
                  <td><span class="badge badge--${o.status}">${o.status}</span></td>
                </tr>
              `).join('');
      }
     }
    } catch (error) {
     console.error('Could not load customer orders:', error);
    }
   }
  }
 } catch (error) {
  console.error('Dashboard load error:', error);
 }
}