// ===============================================
// Settings Module
// ===============================================

import { api } from '../utils/api.js';
import { $ } from '../utils/helpers.js';
import { formatDate } from '../utils/formatter.js';
import { showToast } from '../components/toast.js';

export default async function initSettings() {
 const profileForm = $('#profile-form');
 const notifList = $('#settings-notifications-list');
 let userData = null;
 let notifications = [];
 
 // 1. Fetch real user data AND notifications simultaneously
 try {
  const [meRes, notifRes] = await Promise.all([
   api.getMe(),
   api.getNotifications()
  ]);
  
  userData = meRes.data;
  notifications = notifRes.data || [];
  
  if (userData) {
   // --- Populate Profile Tab ---
   if ($('#settings-fullname')) $('#settings-fullname').value = userData.fullname || userData.username || '';
   if ($('#settings-username')) $('#settings-username').value = userData.username || '';
   if ($('#settings-country')) $('#settings-country').value = userData.country || '';
   if ($('#settings-phone')) $('#settings-phone').value = userData.phone || '';
   
   // --- Populate Security Tab ---
   if ($('#settings-account-id')) $('#settings-account-id').value = userData.accountId || 'N/A';
   if ($('#settings-email')) $('#settings-email').value = userData.email || 'N/A';
   if ($('#settings-security-phone')) $('#settings-security-phone').value = userData.phone || 'N/A';
   if ($('#settings-referral-code')) $('#settings-referral-code').value = userData.referralCode || 'N/A';
   
   // --- Update Avatar Initials ---
   const avatarEl = $('#settings-avatar');
   if (avatarEl && userData.username) {
    avatarEl.textContent = userData.username.substring(0, 2).toUpperCase();
   }
  }
  
  // 2. Render Notifications List
  if (notifList) {
   if (notifications.length === 0) {
    notifList.innerHTML = `<li class="text-muted text-center">No notifications found.</li>`;
   } else {
    notifList.innerHTML = notifications.map(n => {
     const iconClass = n.type === 'announcement' ? 'notification__icon--warning' : 'notification__icon--info';
     const iconText = n.type === 'announcement' ? '📢' : 'i';
     return `
            <li class="notification-item">
              <div class="notification__icon ${iconClass}">${iconText}</div>
              <div class="notification__content">
                <p><strong>${n.title || 'Notification'}</strong>: ${n.message}</p>
                <span class="notification__time">${formatDate(n.createdAt)}</span>
              </div>
            </li>
          `;
    }).join('');
   }
  }
  
  // 3. Inject Notification Counter to Navbar Bell Icon
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const navBell = document.querySelector('.navbar__icon-btn[aria-label="Notifications"]');
  
  if (navBell) {
   // Remove existing badge if any
   const existingBadge = navBell.querySelector('.badge');
   if (existingBadge) existingBadge.remove();
   
   if (unreadCount > 0) {
    const badge = document.createElement('span');
    badge.className = 'badge badge--notification';
    badge.textContent = unreadCount;
    navBell.appendChild(badge);
   }
  }
  
 } catch (error) {
  showToast('Failed to load profile data or notifications', 'error');
  if (notifList) notifList.innerHTML = `<li class="text-muted text-center">Failed to load notifications.</li>`;
 }
 
 // 4. Handle Form Submit (Update Profile)
 if (profileForm) {
  profileForm.addEventListener('submit', async (e) => {
   e.preventDefault();
   
   const fullname = $('#settings-fullname').value;
   const username = $('#settings-username').value;
   const country = $('#settings-country').value;
   const phone = $('#settings-phone').value;
   
   try {
    showToast('Saving changes...', 'info');
    // Call the real backend API to update profile
    await api.updateProfile({ fullname, username, country, phone });
    showToast('Profile updated successfully!', 'success');
   } catch (error) {
    showToast(error.message || 'Failed to update profile', 'error');
   }
  });
 }
 
 // Note: Tab switching logic is already handled by the inline script in settings.html
}