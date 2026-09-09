// assets/modules/notifications.js

import { api } from '../utils/api.js';
import { formatDate } from '../utils/formatter.js';
import { showToast } from '../components/toast.js';

export default async function initNotificationsPage() {
 const notifList = document.getElementById('notifications-list');
 const giveawayContainer = document.getElementById('giveawayCardContainer');
 const advertContainer = document.getElementById('advertCardContainer'); 
 const emergencyContainer = document.getElementById('emergencyCardContainer');
 
 if (!notifList) return;
 
 // FIX: Robust media URL extractor that handles query parameters correctly
 const parseMediaFromMessage = (message) => {
  if (!message) return { text: '', mediaHtml: '' };
  
  const words = message.split(/\s+/);
  let mediaUrl = null;
  const textWords = [];
  
  words.forEach(word => {
   if (/^https?:\/\//i.test(word)) {
    // Check if it ends with an image or video extension (allowing query strings like ?v=1)
    if (/\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg)(\?.*)?$/i.test(word)) {
     if (!mediaUrl) {
      mediaUrl = word; // Extract the first media URL found
      return; // Skip adding this word to the text
     }
    }
   }
   textWords.push(word);
  });
  
  if (!mediaUrl) return { text: message, mediaHtml: '' };
  
  const text = textWords.join(' ').trim();
  let mediaHtml = '';
  
  const isVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(mediaUrl);
  
  if (isVideo) {
   // Video WITH controls, user can play/pause and it has sound. NO autoplay.
   mediaHtml = `<video src="${mediaUrl}" controls style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">Your browser does not support the video tag.</video>`;
  } else {
   // Image
   mediaHtml = `<img src="${mediaUrl}" alt="Media" style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;">`;
  }
  
  return { text, mediaHtml };
 };

 try {
  const res = await api.getNotifications();
  const allNotifications = res.data || [];
  
  if (allNotifications.length === 0) {
   notifList.innerHTML = `<li class="text-muted text-center" style="padding: 40px;">No notifications found.</li>`;
   return;
  }
  
  let giveaways = [];
  let adverts = [];
  let emergencies = [];
  let regularNotifs = [];
  
  allNotifications.forEach(n => {
   // Extract media for ALL notification types
   const { text, mediaHtml } = parseMediaFromMessage(n.message);
   n.cleanMessage = text;
   n.mediaHtml = mediaHtml;

   const title = (n.title || '').toLowerCase();
   const messageCheck = (n.cleanMessage || '').toLowerCase(); // Use cleaned text for keyword check
   
   const isEmergency = title.includes('emergency') || messageCheck.includes('emergency');
   const isAdvert = title.includes('advert') || messageCheck.includes('advertisement') || title.includes('ad');
   const isGiveaway = title.includes('giveaway') || title.includes('give away') || messageCheck.includes('giveaway') || messageCheck.includes('give away');
   
   if (isEmergency) {
    emergencies.push(n);
   } else if (isAdvert) {
    adverts.push(n);
   } else if (isGiveaway) {
    giveaways.push(n);
   } else {
    regularNotifs.push(n);
   }
  });
  
  // 1. Render Emergency Card
  if (emergencyContainer) {
   if (emergencies.length > 0) {
    emergencyContainer.innerHTML = emergencies.map(e => `
     <div class="card" style="margin-bottom: 20px; border: 2px solid var(--color-danger, #ef4444); background: linear-gradient(135deg, rgba(239, 68, 68, 0.05), var(--bg-card));">
      <div class="card__header" style="border-bottom: none; padding-bottom: 0;">
       <h3 class="card__title" style="display: flex; align-items: center; gap: 8px; color: var(--color-danger, #ef4444);">
        🚨 ${e.title || 'EMERGENCY NOTICE'}
       </h3>
      </div>
      <div class="card__body" style="padding-top: 10px;">
       ${e.mediaHtml || ''}
       ${e.cleanMessage ? `<p style="font-size: 15px; color: var(--text-primary); line-height: 1.6; margin-bottom: 10px;">${e.cleanMessage}</p>` : ''}
       <span class="notification__time" style="font-size: 12px; color: var(--text-muted);">${formatDate(e.createdAt)}</span>
      </div>
     </div>
    `).join('');
    emergencyContainer.style.display = 'block';
   } else {
    emergencyContainer.style.display = 'none';
   }
  }
  
  // 2. Render Advert Card (With Image/Video)
  if (advertContainer) {
   if (adverts.length > 0) {
    advertContainer.innerHTML = adverts.map(a => `
     <div class="card" style="margin-bottom: 20px; border: 2px solid var(--color-primary, #3b82f6); background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), var(--bg-card));">
      <div class="card__header" style="border-bottom: none; padding-bottom: 0;">
       <h3 class="card__title" style="display: flex; align-items: center; gap: 8px; color: var(--color-primary, #3b82f6);">
        📢 ${a.title || 'ADVERTISEMENT'}
       </h3>
      </div>
      <div class="card__body" style="padding-top: 10px;">
       ${a.mediaHtml || ''}
       ${a.cleanMessage ? `<p style="font-size: 15px; color: var(--text-primary); line-height: 1.6; margin-bottom: 10px;">${a.cleanMessage}</p>` : ''}
       <span class="notification__time" style="font-size: 12px; color: var(--text-muted);">${formatDate(a.createdAt)}</span>
      </div>
     </div>
    `).join('');
    advertContainer.style.display = 'block';
   } else {
    advertContainer.style.display = 'none';
   }
  }
  
  // 3. Render Giveaway Card
  if (giveawayContainer) {
   if (giveaways.length > 0) {
    giveawayContainer.innerHTML = giveaways.map(g => `
     <div class="card" style="margin-bottom: 20px; border: 2px solid var(--color-gold); background: linear-gradient(135deg, rgba(244, 179, 66, 0.05), var(--bg-card));">
      <div class="card__header" style="border-bottom: none; padding-bottom: 0;">
       <h3 class="card__title" style="display: flex; align-items: center; gap: 8px; color: var(--color-gold);">
        🎉 ${g.title || 'GIVE AWAY'}
       </h3>
      </div>
      <div class="card__body" style="padding-top: 10px;">
       ${g.mediaHtml || ''}
       ${g.cleanMessage ? `<p style="font-size: 15px; color: var(--text-primary); line-height: 1.6; margin-bottom: 10px;">${g.cleanMessage}</p>` : ''}
       <span class="notification__time" style="font-size: 12px; color: var(--text-muted);">${formatDate(g.createdAt)}</span>
      </div>
     </div>
    `).join('');
    giveawayContainer.style.display = 'block';
   } else {
    giveawayContainer.style.display = 'none';
   }
  }
  
  // 4. Render Regular Notifications List
  if (regularNotifs.length === 0) {
   notifList.innerHTML = `<li class="text-muted text-center" style="padding: 40px;">No other notifications found.</li>`;
   return;
  }
  
  notifList.innerHTML = regularNotifs.map(n => {
   const iconClass = n.type === 'announcement' ? 'notification__icon--warning' : 'notification__icon--info';
   const iconText = n.type === 'announcement' ? '📢' : 'i';
   
   return `
    <li class="notification-item" style="margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 15px;">
     <div class="notification__icon ${iconClass}">${iconText}</div>
     <div class="notification__content" style="width: 100%;">
      <p><strong>${n.title || 'Notification'}</strong>: ${n.cleanMessage || ''}</p>
      ${n.mediaHtml || ''}
      <span class="notification__time">${formatDate(n.createdAt)}</span>
     </div>
    </li>
   `;
  }).join('');
  
 } catch (error) {
  console.error('Failed to load notifications:', error);
  showToast('Failed to load notifications', 'error');
  notifList.innerHTML = `<li class="text-muted text-center text-danger">Failed to load notifications.</li>`;
 }
}
