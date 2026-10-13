// assets/modules/notifications.js

import { api } from '../utils/api.js';
import { formatDate } from '../utils/formatter.js';
import { showToast } from '../components/toast.js';

/* ------------------------------------------------------------------ *
 * Security helpers
 * ------------------------------------------------------------------ */

const escapeHtml = (value) => {
 if (value === null || value === undefined) return '';
 return String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
};

const escapeAttr = escapeHtml;

const isSafeMediaUrl = (url) => {
 if (!url || typeof url !== 'string') return false;
 if (!/^https?:\/\//i.test(url)) return false;
 try {
  const parsed = new URL(url);
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
 } catch (_) {
  return false;
 }
};

/* ------------------------------------------------------------------ *
 * Media parsing
 * ------------------------------------------------------------------ */

const MEDIA_RE = /\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg)(\?.*)?$/i;
const VIDEO_RE = /\.(mp4|webm|ogg)(\?.*)?$/i;

/**
 * Extracts the first supported media URL from a notification message.
 * Returns the cleaned text plus ready-to-render media HTML.
 */
const parseMediaFromMessage = (message) => {
 if (!message) return { text: '', mediaHtml: '' };

 const source = String(message);
 const words = source.split(/\s+/);
 let mediaUrl = null;
 let isVideo = false;
 const textWords = [];

 for (const word of words) {
  if (!word) continue;
  if (
   !mediaUrl &&
   /^https?:\/\//i.test(word) &&
   MEDIA_RE.test(word) &&
   isSafeMediaUrl(word)
  ) {
   mediaUrl = word;
   isVideo = VIDEO_RE.test(word);
   continue; // remove the URL from the visible text
  }
  textWords.push(word);
 }

 if (!mediaUrl) {
  return { text: source, mediaHtml: '' };
 }

 const safeUrl = escapeAttr(mediaUrl);
 const text = textWords.join(' ').trim();

 let mediaHtml;
 if (isVideo) {
  mediaHtml = `
   <div class="notification__media">
    <video class="notification__media-video"
      src="${safeUrl}"
      controls
      playsinline
      preload="metadata">Your browser does not support the video tag.</video>
   </div>`;
 } else {
  mediaHtml = `
   <div class="notification__media">
    <img class="notification__media-image"
      src="${safeUrl}"
      alt="Notification media"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer" />
   </div>`;
 }

 return { text, mediaHtml };
};

/* ------------------------------------------------------------------ *
 * Classification
 * ------------------------------------------------------------------ */

const classify = (n) => {
 const title = (n.title || '').toLowerCase();
 const message = (n.cleanMessage || '').toLowerCase();

 // Whole-word "ad" matching — avoids "admin", "add", "adobe", "header", etc.
 const advertWordRe = /\b(advert|advertisement|ad)\b/i;

 const isEmergency =
  /\bemergenc(?:y|ies)\b/i.test(title) ||
  /\bemergenc(?:y|ies)\b/i.test(message);

 const isAdvert =
  advertWordRe.test(title) ||
  advertWordRe.test(message);

 const isGiveaway =
  /\bgive\s?away\b/i.test(title) ||
  /\bgive\s?away\b/i.test(message);

 if (isEmergency) return 'emergency';
 if (isAdvert) return 'advert';
 if (isGiveaway) return 'giveaway';
 return 'regular';
};

/* ------------------------------------------------------------------ *
 * Reusable card renderers
 * ------------------------------------------------------------------ */

const SPECIAL_META = {
 emergency: {
  cardClass: 'notification-card--emergency',
  icon: '🚨',
  fallbackTitle: 'EMERGENCY NOTICE'
 },
 advert: {
  cardClass: 'notification-card--advert',
  icon: '📢',
  fallbackTitle: 'ADVERTISEMENT'
 },
 giveaway: {
  cardClass: 'notification-card--giveaway',
  icon: '🎉',
  fallbackTitle: 'GIVEAWAY'
 }
};

const messageToHtml = (cleanMessage) => {
 if (!cleanMessage) return '';
 return `<p class="notification__message">${escapeHtml(cleanMessage).replace(/\r?\n/g, '<br>')}</p>`;
};

const renderSpecialCard = (n, kind) => {
 const meta = SPECIAL_META[kind];
 const title = escapeHtml(n.title || meta.fallbackTitle);
 const mediaHtml = n.mediaHtml || '';
 const bodyHtml = messageToHtml(n.cleanMessage);
 const time = escapeHtml(formatDate(n.createdAt));

 return `
  <article class="card notification-card ${meta.cardClass}">
   <header class="notification-item__header">
    <span class="notification__icon" aria-hidden="true">${meta.icon}</span>
    <div class="notification-item__heading">
     <h3 class="notification-item__title">${meta.icon} ${title}</h3>
    </div>
   </header>
   <div class="notification-item__body">
    ${mediaHtml}
    ${bodyHtml}
   </div>
   <footer class="notification-item__footer">
    <span class="notification__time">${time}</span>
   </footer>
  </article>`;
};

const renderSpecialContainer = (container, items, kind) => {
 if (!container) return;
 if (!items || items.length === 0) {
  container.innerHTML = '';
  container.style.display = 'none';
  return;
 }
 container.innerHTML = items.map((n) => renderSpecialCard(n, kind)).join('');
 container.style.display = 'block';
 attachImageErrorHandlers(container);
};

const renderRegularCard = (n) => {
 const isAnnouncement = n.type === 'announcement';
 const iconClass = isAnnouncement
  ? 'notification__icon notification__icon--warning'
  : 'notification__icon notification__icon--info';
 const iconText = isAnnouncement ? '📢' : 'i';
 const badgeLabel = isAnnouncement ? 'Announcement' : 'Update';

 const title = escapeHtml(n.title || 'Notification');
 const mediaHtml = n.mediaHtml || '';
 const bodyHtml = messageToHtml(n.cleanMessage);
 const time = escapeHtml(formatDate(n.createdAt));

 return `
  <li class="notification-item">
   <header class="notification-item__header">
    <span class="${iconClass}" aria-hidden="true">${iconText}</span>
    <div class="notification-item__heading">
     <h3 class="notification-item__title">${title}</h3>
     <span class="notification-item__badge">${badgeLabel}</span>
    </div>
   </header>
   <div class="notification-item__body">
    ${mediaHtml}
    ${bodyHtml}
   </div>
   <footer class="notification-item__footer">
    <span class="notification__time">${time}</span>
   </footer>
  </li>`;
};

/* ------------------------------------------------------------------ *
 * Graceful image failure handling
 * ------------------------------------------------------------------ */

const attachImageErrorHandlers = (root) => {
 if (!root) return;
 const imgs = root.querySelectorAll('img.notification__media-image');
 imgs.forEach((img) => {
  if (img.dataset.errorBound === '1') return;
  img.dataset.errorBound = '1';
  img.addEventListener('error', () => {
   const wrapper = img.closest('.notification__media');
   if (wrapper && wrapper.parentNode) {
    wrapper.parentNode.removeChild(wrapper);
   }
  });
 });
};

/* ------------------------------------------------------------------ *
 * Empty-state helpers
 * ------------------------------------------------------------------ */

const EMPTY_STATE = (text) =>
 `<li class="text-muted text-center" style="padding:40px;">${escapeHtml(text)}</li>`;

const hideContainer = (c) => {
 if (!c) return;
 c.innerHTML = '';
 c.style.display = 'none';
};

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export default async function initNotificationsPage() {
 const notifList = document.getElementById('notifications-list');
 const giveawayContainer = document.getElementById('giveawayCardContainer');
 const advertContainer = document.getElementById('advertCardContainer');
 const emergencyContainer = document.getElementById('emergencyCardContainer');

 if (!notifList) return;

 // Loading state
 notifList.innerHTML = EMPTY_STATE('Loading notifications…');

 try {
  const res = await api.getNotifications();
  const allNotifications = Array.isArray(res?.data) ? res.data : [];

  if (allNotifications.length === 0) {
   notifList.innerHTML = EMPTY_STATE('No notifications found.');
   hideContainer(emergencyContainer);
   hideContainer(advertContainer);
   hideContainer(giveawayContainer);
   return;
  }

  const buckets = {
   emergency: [],
   advert: [],
   giveaway: [],
   regular: []
  };

  allNotifications.forEach((n) => {
   const { text, mediaHtml } = parseMediaFromMessage(n.message);
   n.cleanMessage = text;
   n.mediaHtml = mediaHtml;
   buckets[classify(n)].push(n);
  });

  // 1. Emergency
  renderSpecialContainer(emergencyContainer, buckets.emergency, 'emergency');

  // 2. Advertisement
  renderSpecialContainer(advertContainer, buckets.advert, 'advert');

  // 3. Giveaway
  renderSpecialContainer(giveawayContainer, buckets.giveaway, 'giveaway');

  // 4. Regular notifications (do NOT early-return before special cards)
  if (buckets.regular.length === 0) {
   notifList.innerHTML = EMPTY_STATE('No other notifications found.');
   return;
  }

  notifList.innerHTML = buckets.regular.map(renderRegularCard).join('');
  attachImageErrorHandlers(notifList);
 } catch (error) {
  console.error('Failed to load notifications:', error);
  showToast('Failed to load notifications', 'error');
  notifList.innerHTML =
   '<li class="text-muted text-center text-danger">Failed to load notifications.</li>';
 }
}
