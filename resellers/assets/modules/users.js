// ===============================================
// Reseller Users Module
// ===============================================

import { api } from '../utils/api.js';
import { formatCurrency } from '../utils/formatter.js';

let showToast = (msg, type) => alert((type === 'error' ? 'Error: ' : '') + msg);
try {
 const toastMod = await import('../components/toast.js');
 if (toastMod.showToast) showToast = toastMod.showToast;
} catch (e) {
 console.warn('toast.js not found, using native alert.');
}

export default async function initUsers() {
 const tbody = document.getElementById('usersTableBody');
 if (!tbody) return;
 
 await fetchAndRenderUsers();
 
 // Handle Fund User Form Submission
 const fundForm = document.getElementById('fundUserForm');
 if (fundForm) {
  fundForm.addEventListener('submit', async (e) => {
   e.preventDefault();
   const userId = document.getElementById('fundUserId').value;
   const amount = parseFloat(document.getElementById('fundAmount').value);
   
   if (!userId || isNaN(amount) || amount <= 0) {
    return showToast('Please enter a valid amount', 'error');
   }
   
   try {
    showToast('Processing...', 'info');
    await api.fundChildUser(userId, amount);
    showToast('User wallet funded successfully!', 'success');
    
    // Close modal and reset form
    document.getElementById('fundUserModal').classList.remove('active');
    document.body.style.overflow = '';
    fundForm.reset();
    
    // Reload users table
    await fetchAndRenderUsers();
   } catch (error) {
    showToast(error.message || 'Failed to fund user', 'error');
   }
  });
 }
}

async function fetchAndRenderUsers() {
 const tbody = document.getElementById('usersTableBody');
 try {
  const response = await api.getPanelUsers();
  const users = response.data || [];
  
  if (users.length === 0) {
   tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No users found.</td></tr>`;
   return;
  }
  
  tbody.innerHTML = users.map(u => `
      <tr>
        <td>#${u.id?.substring(0, 8)}</td>
        <td>${u.username}</td>
        <td>${u.email}</td>
        <td class="text-gold">${formatCurrency(u.balance || 0)}</td>
        <td><span class="badge badge--${u.status === 'active' ? 'success' : 'danger'}">${u.status}</span></td>
        <td style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn--outline btn--sm" onclick="toggleUserStatus('${u.id}', '${u.status}')">Toggle Status</button>
          <button class="btn btn--primary btn--sm" onclick="openFundModal('${u.id}', '${u.username}')">Fund Wallet</button>
        </td>
      </tr>
    `).join('');
 } catch (error) {
  tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load users.</td></tr>`;
 }
}

// Expose functions to window for inline onclick events
window.toggleUserStatus = async (userId, currentStatus) => {
 try {
  const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
  await api.updatePanelUserStatus(userId, newStatus);
  showToast('User status updated!', 'success');
  fetchAndRenderUsers(); // Reload table
 } catch (error) {
  showToast('Failed to update user', 'error');
 }
};

window.openFundModal = (userId, username) => {
 document.getElementById('fundUserId').value = userId;
 document.getElementById('fundUsername').value = username;
 document.getElementById('fundAmount').value = '';
 
 // Open modal using the global modal component logic
 const modal = document.getElementById('fundUserModal');
 modal.classList.add('active');
 document.body.style.overflow = 'hidden';
};