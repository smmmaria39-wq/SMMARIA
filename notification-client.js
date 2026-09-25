/**
 * SMMARIA NOTIFICATIONS — Universal Client
 *
 * Two delivery methods:
 * 1. Web Push   — for Chrome/Edge/Firefox (Android + desktop)
 * 2. In-App     — for ALL browsers including iPhone/iOS Safari
 *
 * The in-app system shows notification popup cards on the website
 * when the user visits. This means iPhone users also receive
 * notifications — they just see them inside the website instead
 * of in the phone's notification panel.
 *
 * The existing Web Push system is NOT modified.
 */

(function () {
  'use strict';

  var config = window.SMMARIA_NOTIF || {};
  var API_URL = config.apiUrl || 'https://notifications-production-4281.up.railway.app';
  var SW_PATH = config.swPath || 'sw.js';

  // ═══════════════════════════════════════════════════════════════
  //  VISITOR ID — unique per browser, persists across visits
  // ═══════════════════════════════════════════════════════════════

  function getVisitorId() {
    try {
      var id = localStorage.getItem('smmaria_visitor_id');
      if (!id) {
        id = 'visitor_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('smmaria_visitor_id', id);
      }
      return id;
    } catch (e) {
      return 'visitor_temp_' + Date.now();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  TOKEN (optional — for authenticated users)
  // ═══════════════════════════════════════════════════════════════

  function getToken() {
    if (config.getToken && typeof config.getToken === 'function') {
      try { return config.getToken() || ''; } catch (e) { return ''; }
    }
    try {
      return (
        localStorage.getItem('smmmaria_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('smmaria_token') ||
        localStorage.getItem('access_token') ||
        ''
      );
    } catch (e) { return ''; }
  }

  // ═══════════════════════════════════════════════════════════════
  //  FEATURE DETECTION
  // ═══════════════════════════════════════════════════════════════

  function pushSupported() {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  API HELPERS
  // ═══════════════════════════════════════════════════════════════

  async function fetchWithTimeout(url, options, timeoutMs) {
    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs || 15000);
    try {
      var res = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
      clearTimeout(timeoutId);
      return res;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  async function apiFetch(path, method, body) {
    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var opts = { method: method || 'GET', headers: headers };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetchWithTimeout(API_URL + path, opts, 15000);
    return res.json();
  }

  // ═══════════════════════════════════════════════════════════════
  //  WEB PUSH (existing system — unchanged)
  // ═══════════════════════════════════════════════════════════════

  async function getVapidKey() {
    try {
      var r = await apiFetch('/api/config', 'GET');
      return r.vapidPublicKey || null;
    } catch (e) { return null; }
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function registerSW() {
    try {
      var reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
      return reg;
    } catch (e) { return null; }
  }

  async function subscribeToPush() {
    var reg = await registerSW();
    if (!reg) return false;
    var vapidKey = await getVapidKey();
    if (!vapidKey) return false;
    var subscription;
    try {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
    } catch (e) { return false; }
    var device = { browser: getBrowserName(), platform: navigator.platform || 'unknown' };
    try {
      var r = await apiFetch('/api/subscribe', 'POST', { subscription: subscription, device: device });
      return r.success === true;
    } catch (e) { return false; }
  }

  async function hasLocalSubscription() {
    try {
      var reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return false;
      var sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch (e) { return false; }
  }

  function getBrowserName() {
    var ua = navigator.userAgent;
    if (ua.indexOf('Firefox') !== -1) return 'Firefox';
    if (ua.indexOf('Edg') !== -1) return 'Edge';
    if (ua.indexOf('Chrome') !== -1) return 'Chrome';
    if (ua.indexOf('Safari') !== -1) return 'Safari';
    return 'Unknown';
  }

  // ═══════════════════════════════════════════════════════════════
  //  IN-APP SUBSCRIPTION (for iPhone/iOS + all browsers)
  // ═══════════════════════════════════════════════════════════════

  async function subscribeInApp() {
    var visitorId = getVisitorId();
    var device = { browser: getBrowserName(), platform: navigator.platform || 'unknown' };
    try {
      var r = await apiFetch('/api/in-app/subscribe', 'POST', {
        visitorId: visitorId,
        device: device
      });
      return r.success === true;
    } catch (e) { return false; }
  }

  async function isInAppSubscribed() {
    var visitorId = getVisitorId();
    try {
      var r = await apiFetch('/api/in-app/status?visitorId=' + visitorId, 'GET');
      return r.success && r.subscribed === true;
    } catch (e) { return false; }
  }

  async function dismissInAppNotification(notificationId) {
    var visitorId = getVisitorId();
    try {
      await apiFetch('/api/in-app/dismiss', 'POST', {
        visitorId: visitorId,
        notificationId: notificationId
      });
    } catch (e) {}
  }

  async function trackClick(notificationId, event) {
    try {
      await apiFetch('/api/analytics/click', 'POST', {
        notificationId: notificationId,
        event: event
      });
    } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════
  //  FETCH IN-APP NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════

  async function fetchInAppNotifications() {
    var visitorId = getVisitorId();
    try {
      var r = await apiFetch('/api/in-app/notifications?visitorId=' + visitorId, 'GET');
      if (r.success && r.notifications && r.notifications.length > 0) {
        return r.notifications;
      }
    } catch (e) {}
    return [];
  }

  // ═══════════════════════════════════════════════════════════════
  //  NOTIFICATION POPUP CARD (in-website notification display)
  // ═══════════════════════════════════════════════════════════════

  var notifQueue = [];
  var currentNotifIndex = 0;

  function injectStyles() {
    if (document.getElementById('smmaria-notif-styles')) return;
    var style = document.createElement('style');
    style.id = 'smmaria-notif-styles';
    style.textContent = `
      #smmaria-notif-popup {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 2147483647 !important;
        background: #0A1530 !important;
        border-bottom: 3px solid #D4AF37 !important;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        box-sizing: border-box !important;
        display: block !important;
      }
      #smmaria-notif-popup .np-inner {
        max-width: 560px !important;
        margin: 0 auto !important;
        padding: 20px !important;
        box-sizing: border-box !important;
        position: relative !important;
      }
      #smmaria-notif-popup .np-header {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        margin-bottom: 12px !important;
      }
      #smmaria-notif-popup .np-brand {
        font-size: 12px !important;
        font-weight: 700 !important;
        color: #F4D068 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.1em !important;
      }
      #smmaria-notif-popup .np-close {
        position: absolute !important;
        top: 16px !important;
        right: 16px !important;
        background: none !important;
        border: none !important;
        color: rgba(245,240,225,0.4) !important;
        font-size: 24px !important;
        cursor: pointer !important;
        padding: 0 !important;
        line-height: 1 !important;
        width: 32px !important;
        height: 32px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      #smmaria-notif-popup .np-close:hover { color: #F5F0E1 !important; }
      #smmaria-notif-popup .np-icon {
        width: 40px !important;
        height: 40px !important;
        flex-shrink: 0 !important;
        object-fit: contain !important;
      }
      #smmaria-notif-popup .np-title {
        font-size: 16px !important;
        font-weight: 700 !important;
        color: #F5F0E1 !important;
        margin: 0 0 6px 0 !important;
        line-height: 1.3 !important;
        padding-right: 40px !important;
      }
      #smmaria-notif-popup .np-body {
        font-size: 14px !important;
        color: rgba(245,240,225,0.7) !important;
        margin: 0 0 16px 0 !important;
        line-height: 1.5 !important;
      }
      #smmaria-notif-popup .np-image {
        width: 100% !important;
        max-height: 200px !important;
        object-fit: cover !important;
        margin-bottom: 16px !important;
        display: block !important;
        border: 1px solid rgba(212,175,55,0.2) !important;
      }
      #smmaria-notif-popup .np-actions {
        display: flex !important;
        gap: 8px !important;
      }
      #smmaria-notif-popup .np-btn {
        background: #D4AF37 !important;
        color: #0A1530 !important;
        border: none !important;
        padding: 12px 24px !important;
        font-weight: 700 !important;
        font-size: 14px !important;
        cursor: pointer !important;
        font-family: inherit !important;
        text-decoration: none !important;
        display: inline-block !important;
      }
      #smmaria-notif-popup .np-btn:hover { background: #F4D068 !important; }
      #smmaria-notif-popup .np-btn-outline {
        background: transparent !important;
        color: rgba(245,240,225,0.6) !important;
        border: 1px solid rgba(212,175,55,0.3) !important;
      }
      #smmaria-notif-popup .np-badge {
        display: inline-block !important;
        background: #FE2C55 !important;
        color: #fff !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        padding: 2px 8px !important;
        margin-left: auto !important;
      }
      @media (max-width: 600px) {
        #smmaria-notif-popup .np-inner { padding: 16px !important; }
        #smmaria-notif-popup .np-title { font-size: 15px !important; padding-right: 36px !important; }
        #smmaria-notif-popup .np-body { font-size: 13px !important; }
        #smmaria-notif-popup .np-btn { width: 100% !important; text-align: center !important; }
        #smmaria-notif-popup .np-actions { flex-direction: column !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function showNotificationPopup(notification) {
    // Remove any existing popup
    var existing = document.getElementById('smmaria-notif-popup');
    if (existing) existing.remove();

    injectStyles();

    var popup = document.createElement('div');
    popup.id = 'smmaria-notif-popup';

    var iconHtml = notification.iconUrl
      ? '<img class="np-icon" src="' + escapeAttr(notification.iconUrl) + '" alt="" onerror="this.style.display=\'none\'">'
      : '<div style="font-size:24px;">🔔</div>';

    var imageHtml = notification.imageUrl
      ? '<img class="np-image" src="' + escapeAttr(notification.imageUrl) + '" alt="" onerror="this.style.display=\'none\'">'
      : '';

    var actionHtml = notification.actionText
      ? '<button class="np-btn" id="np-action-btn">' + escapeHtml(notification.actionText) + '</button>'
      : '';

    var countBadge = notifQueue.length > 1
      ? '<span class="np-badge">' + (currentNotifIndex + 1) + ' / ' + notifQueue.length + '</span>'
      : '';

    popup.innerHTML = `
      <div class="np-inner">
        <button class="np-close" id="np-close-btn">&times;</button>
        <div class="np-header">
          ${iconHtml}
          <span class="np-brand">SMMARIA</span>
          ${countBadge}
        </div>
        <div class="np-title">${escapeHtml(notification.title)}</div>
        <div class="np-body">${escapeHtml(notification.body)}</div>
        ${imageHtml}
        <div class="np-actions">
          ${actionHtml}
          <button class="np-btn np-btn-outline" id="np-dismiss-btn">Dismiss</button>
        </div>
      </div>
    `;

    if (document.body) {
      document.body.insertBefore(popup, document.body.firstChild);
    } else {
      document.documentElement.appendChild(popup);
    }

    // Wire up close button
    document.getElementById('np-close-btn').addEventListener('click', function () {
      dismissInAppNotification(notification.id);
      popup.remove();
      showNextNotification();
    });

    // Wire up dismiss button
    document.getElementById('np-dismiss-btn').addEventListener('click', function () {
      dismissInAppNotification(notification.id);
      popup.remove();
      showNextNotification();
    });

    // Wire up action button
    var actionBtn = document.getElementById('np-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', function () {
        trackClick(notification.id, 'action_click');
        dismissInAppNotification(notification.id);
        popup.remove();
        showNextNotification();
        // Open destination URL
        if (notification.destinationUrl) {
          window.open(notification.destinationUrl, '_blank');
        }
      });
    }

    // Click on title/body also opens the destination
    var titleEl = popup.querySelector('.np-title');
    var bodyEl = popup.querySelector('.np-body');
    [titleEl, bodyEl].forEach(function (el) {
      if (el) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', function () {
          trackClick(notification.id, 'notification_click');
          dismissInAppNotification(notification.id);
          popup.remove();
          showNextNotification();
          if (notification.destinationUrl) {
            window.open(notification.destinationUrl, '_blank');
          }
        });
      }
    });
  }

  function showNextNotification() {
    currentNotifIndex++;
    if (currentNotifIndex < notifQueue.length) {
      showNotificationPopup(notifQueue[currentNotifIndex]);
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ═══════════════════════════════════════════════════════════════
  //  SUBSCRIBE BANNER (Enable Notifications)
  // ═══════════════════════════════════════════════════════════════

  function createBanner() {
    if (document.getElementById('smmaria-notif-banner')) return;

    var style = document.createElement('style');
    style.textContent = `
      #smmaria-notif-banner {
        position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important;
        z-index: 2147483646 !important; background: #0A1530 !important;
        border-bottom: 2px solid #D4AF37 !important; box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        display: block !important;
      }
      #smmaria-notif-banner .sn-inner {
        max-width: 1200px !important; margin: 0 auto !important; padding: 14px 20px !important;
        display: flex !important; align-items: center !important; gap: 12px !important; box-sizing: border-box !important;
      }
      #smmaria-notif-banner .sn-icon { font-size: 20px !important; flex-shrink: 0 !important; }
      #smmaria-notif-banner .sn-text { flex: 1 !important; min-width: 0 !important; }
      #smmaria-notif-banner .sn-title { font-size: 14px !important; font-weight: 700 !important; color: #F4D068 !important; margin: 0 0 2px 0 !important; }
      #smmaria-notif-banner .sn-desc { font-size: 12px !important; color: rgba(245,240,225,0.7) !important; margin: 0 !important; }
      #smmaria-notif-banner .sn-btn { background: #D4AF37 !important; color: #0A1530 !important; border: none !important; padding: 10px 20px !important; font-weight: 700 !important; font-size: 13px !important; cursor: pointer !important; white-space: nowrap !important; flex-shrink: 0 !important; font-family: inherit !important; }
      #smmaria-notif-banner .sn-btn:hover { background: #F4D068 !important; }
      #smmaria-notif-banner .sn-btn:disabled { opacity: 0.6 !important; }
      #smmaria-notif-banner .sn-close { background: none !important; border: none !important; color: rgba(245,240,225,0.4) !important; font-size: 22px !important; cursor: pointer !important; padding: 0 4px !important; flex-shrink: 0 !important; }
      @media (max-width: 600px) {
        #smmaria-notif-banner .sn-inner { flex-wrap: wrap !important; padding: 10px 14px !important; position: relative !important; }
        #smmaria-notif-banner .sn-btn { width: 100% !important; margin-top: 4px !important; padding: 12px !important; }
        #smmaria-notif-banner .sn-close { position: absolute !important; top: 8px !important; right: 8px !important; }
      }
    `;
    document.head.appendChild(style);

    var banner = document.createElement('div');
    banner.id = 'smmaria-notif-banner';
    banner.innerHTML = `
      <div class="sn-inner">
        <div class="sn-icon">🔔</div>
        <div class="sn-text">
          <div class="sn-title">Stay Updated with SMMARIA</div>
          <div class="sn-desc">Get order alerts, new services, promotions and announcements.</div>
        </div>
        <button class="sn-btn" id="smmaria-notif-enable">Enable Notifications</button>
        <button class="sn-close" id="smmaria-notif-close">&times;</button>
      </div>
    `;

    if (document.body) {
      document.body.insertBefore(banner, document.body.firstChild);
    } else {
      document.documentElement.appendChild(banner);
    }

    document.getElementById('smmaria-notif-close').addEventListener('click', function () {
      banner.remove();
      try { sessionStorage.setItem('smmaria_notif_dismissed', '1'); } catch (e) {}
    });

    document.getElementById('smmaria-notif-enable').addEventListener('click', onEnableClick);
  }

  async function onEnableClick() {
    var btn = document.getElementById('smmaria-notif-enable');
    if (!btn) return;
    btn.textContent = 'Setting up...';
    btn.disabled = true;

    try {
      if (pushSupported()) {
        // ── Browser supports Web Push ──
        // Request permission first
        var permission = await Notification.requestPermission();

        if (permission !== 'granted') {
          // Permission denied — still subscribe to in-app notifications
          var inAppOk = await subscribeInApp();
          if (inAppOk) {
            btn.textContent = '✓ Subscribed!';
            btn.style.background = '#25D366';
            btn.style.color = '#050B1F';
            setTimeout(function () {
              var b = document.getElementById('smmaria-notif-banner');
              if (b) b.remove();
            }, 1500);
          } else {
            btn.textContent = 'Failed — try again';
            btn.disabled = false;
            btn.style.background = '#FE2C55';
            btn.style.color = '#fff';
          }
          return;
        }

        // Permission granted — subscribe to both push AND in-app
        btn.textContent = 'Subscribing...';
        var pushOk = await subscribeToPush();
        var inAppOk2 = await subscribeInApp(); // Also enable in-app so they see popups on the website

        if (pushOk || inAppOk2) {
          btn.textContent = '✓ Subscribed!';
          btn.style.background = '#25D366';
          btn.style.color = '#050B1F';
          setTimeout(function () {
            var b = document.getElementById('smmaria-notif-banner');
            if (b) b.remove();
          }, 1500);
        } else {
          btn.textContent = 'Failed — try again';
          btn.disabled = false;
          btn.style.background = '#FE2C55';
          btn.style.color = '#fff';
        }
      } else {
        // ── Browser does NOT support Web Push (iPhone/iOS Safari) ──
        // Subscribe to in-app notifications only
        btn.textContent = 'Subscribing...';
        var ok = await subscribeInApp();

        if (ok) {
          btn.textContent = '✓ Subscribed!';
          btn.style.background = '#25D366';
          btn.style.color = '#050B1F';
          setTimeout(function () {
            var b = document.getElementById('smmaria-notif-banner');
            if (b) b.remove();
          }, 1500);
        } else {
          btn.textContent = 'Failed — try again';
          btn.disabled = false;
          btn.style.background = '#FE2C55';
          btn.style.color = '#fff';
        }
      }
    } catch (e) {
      btn.textContent = 'Error — try again';
      btn.disabled = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  MAIN INIT
  // ═══════════════════════════════════════════════════════════════

  async function init() {
    // ── 1. Fetch in-app notifications (for ALL browsers) ──
    // This runs for everyone — iPhone, Android, desktop
    try {
      notifQueue = await fetchInAppNotifications();
      currentNotifIndex = 0;
      if (notifQueue.length > 0) {
        // Show the first notification popup
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function () {
            showNotificationPopup(notifQueue[0]);
          });
        } else {
          showNotificationPopup(notifQueue[0]);
        }
        return; // Don't show the subscribe banner if there are notifications to show
      }
    } catch (e) {
      // Backend might be offline — continue to show banner
    }

    // ── 2. Check if user has dismissed the banner this session ──
    try {
      if (sessionStorage.getItem('smmaria_notif_dismissed') === '1') return;
    } catch (e) {}

    // ── 3. Check if already subscribed ──
    var alreadySubscribed = false;

    // Check in-app subscription (works for ALL browsers including iPhone)
    var inAppSub = await isInAppSubscribed();
    if (inAppSub) alreadySubscribed = true;

    // Check push subscription (only for push-capable browsers)
    if (!alreadySubscribed && pushSupported()) {
      var localSub = await hasLocalSubscription();
      if (localSub) alreadySubscribed = true;
    }

    if (alreadySubscribed) return;

    // ── 4. Check if permission was denied (push browsers only) ──
    if (pushSupported() && Notification.permission === 'denied') {
      // Permission denied for push, but still show banner for in-app subscription
      // Don't return — continue to show the banner
    }

    // ── 5. Show the subscribe banner ──
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createBanner);
    } else {
      createBanner();
    }
  }

  // ── Start — never breaks the website ──────────────────────────
  try { init(); } catch (e) {}

  // ── Re-check on DOM ready (for SPA navigation) ───────────────
  try {
    document.addEventListener('DOMContentLoaded', function () {
      if (!document.getElementById('smmaria-notif-banner') &&
          !document.getElementById('smmaria-notif-popup')) {
        var dismissed = false;
        try { dismissed = sessionStorage.getItem('smmaria_notif_dismissed') === '1'; } catch (e) {}
        if (!dismissed) {
          // Try fetching notifications again
          fetchInAppNotifications().then(function (notifs) {
            if (notifs.length > 0) {
              notifQueue = notifs;
              currentNotifIndex = 0;
              showNotificationPopup(notifs[0]);
            } else {
              // No notifications — show banner if not subscribed
              isInAppSubscribed().then(function (subscribed) {
                if (!subscribed) createBanner();
              });
            }
          }).catch(function () {});
        }
      }
    });
  } catch (e) {}
})();
