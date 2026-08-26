// ===============================================
// Reseller Wallet Module
// ===============================================

import { api } from '../utils/api.js';
import { formatCurrency, formatDate } from '../utils/formatter.js';
import { showToast } from '../components/toast.js';

export default async function initWallet() {
 const balanceEl = document.querySelector('.balance-card p');
 const tbody = document.querySelector('.table tbody');
 const depositForm = document.getElementById('deposit-form');
 
 try {
  // Get Main Wallet Balance
  const meRes = await api.getMe();
  const balance = meRes.data?.balance || 0;
  if (balanceEl) balanceEl.textContent = formatCurrency(balance);
  
  // Get Transactions
  const txRes = await api.getPanelTransactions();
  const transactions = txRes.data || [];
  
  if (tbody) {
   if (transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No transactions yet.</td></tr>`;
   } else {
    tbody.innerHTML = transactions.map(t => `
          <tr>
            <td>#${t.id?.substring(0, 8)}</td>
            <td>${t.type}</td>
            <td>${formatCurrency(t.amount)}</td>
            <td><span class="badge badge--${t.status === 'approved' ? 'success' : 'warning'}">${t.status}</span></td>
          </tr>
        `).join('');
   }
  }
 } catch (error) {
  console.error('Wallet load error:', error);
 }
 
 // Handle Manual Deposit Request
 if (depositForm) {
  depositForm.addEventListener('submit', async (e) => {
   e.preventDefault();
   const amount = e.target.elements[0].value;
   const method = e.target.elements[1].value;
   
   try {
    showToast('Submitting deposit request...', 'info');
    await api.requestPanelDeposit({ amount, method });
    showToast('Deposit request submitted! Admin will review shortly.', 'success');
    e.target.reset();
    initWallet(); // Reload
   } catch (error) {
    showToast(error.message || 'Failed to submit request', 'error');
   }
  });
 }
};