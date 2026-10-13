/**
 * SMMARIA NOTIFICATIONS — Universal Client (upgraded)
 * Preserves all existing IDs, API routes, storage keys, and auth behavior.
 */
(function () {
  'use strict';

  var config   = window.SMMARIA_NOTIF || {};
  var API_URL   = config.apiUrl || 'https://notifications-production-4281.up.railway.app';
  var SW_PATH   = config.swPath || 'sw.js';

  /* ═════════════ INIT GUARD ═════════════ */
  var INIT_STARTED = false;
  var INIT_DONE    = false;

  /* ═════════════ VISITOR ID (key preserved) ═════════════ */
  function getVisitorId() {
    try {
      var id = localStorage.getItem('smmaria_visitor_id');
      if (!id) {
        id = 'visitor_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('smmaria_visitor_id', id);
      }
      return id;
    } catch (e) { return 'visitor_temp_' + Date.now(); }
  }

  /* ═════════════ TOKEN (behavior preserved, incl. legacy typo) ═════════════ */
  function getToken() {
    if (config.getToken && typeof config.getToken === 'function') {
      try { return config.getToken() || ''; } catch (e) { return ''; }
    }
    try {
      return (
        localStorage.getItem('smmmaria_token')  ||
        localStorage.getItem('token')           ||
        localStorage.getItem('auth_token')      ||
        localStorage.getItem('smmaria_token')   ||
        localStorage.getItem('access_token')    ||
        ''
      );
    } catch (e) { return ''; }
  }

  /* ═════════════ FEATURE DETECTION ═════════════ */
  function pushSupported() {
    return ('serviceWorker' in navigator) &&
           ('PushManager' in window) &&
           ('Notification' in window);
  }

  function isIOS() {
    var ua = navigator.userAgent || '';
    var plat = navigator.platform || '';
    if (/iPhone|iPad|iPod/.test(ua)) return true;
    if (plat === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
    return false;
  }

  function isStandalone() {
    try {
      if (window.navigator && window.navigator.standalone === true) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
      if (window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    } catch (e) {}
    return false;
  }

  function isInstalled() { return isStandalone(); }

  function canUsePushNow() {
    if (!pushSupported()) return false;
    if (isIOS() && !isStandalone()) return false; // iOS requires installed PWA
    return true;
  }

  /* ═════════════ API HELPERS ═════════════ */
  async function fetchWithTimeout(url, options, timeoutMs) {
    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs || 12000);
    try {
      var res = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
      clearTimeout(timeoutId);
      return res;
    } catch (e) { clearTimeout(timeoutId); throw e; }
  }

  async function apiFetch(path, method, body) {
    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var opts = { method: method || 'GET', headers: headers };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetchWithTimeout(API_URL + path, opts, 12000);
    return res.json();
  }

  /* ═════════════ WEB PUSH (unchanged contract) ═════════════ */
  async function getVapidKey() {
    try { var r = await apiFetch('/api/config', 'GET'); return r.vapidPublicKey || null; }
    catch (e) { return null; }
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = atob(base64);
    var out = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
    return out;
  }

  async function registerSW() {
    try { return await navigator.serviceWorker.register(SW_PATH, { scope: '/' }); }
    catch (e) { return null; }
  }

  async function subscribeToPush() {
    var reg = await registerSW(); if (!reg) return false;
    var vapidKey = await getVapidKey(); if (!vapidKey) return false;

    // Reuse existing subscription if present
    var existing = null;
    try { existing = await reg.pushManager.getSubscription(); } catch (e) {}
    var subscription = existing;
    if (!subscription) {
      try {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        });
      } catch (e) { return false; }
    }
    var device = { browser: getBrowserName(), platform: navigator.platform || 'unknown' };
    try {
      var r = await apiFetch('/api/subscribe', 'POST', { subscription: subscription, device: device });
      return r.success === true;
    } catch (e) { return false; }
  }

  async function hasLocalSubscription() {
    try {
      var reg = await navigator.serviceWorker.getRegistration(); if (!reg) return false;
      var sub = await reg.pushManager.getSubscription();
      return !!sub;
    } catch (e) { return false; }
  }

  function getBrowserName() {
    var ua = navigator.userAgent;
    if (ua.indexOf('Firefox') !== -1) return 'Firefox';
    if (ua.indexOf('Edg')    !== -1) return 'Edge';
    if (ua.indexOf('Chrome') !== -1) return 'Chrome';
    if (ua.indexOf('Safari') !== -1) return 'Safari';
    return 'Unknown';
  }

  /* ═════════════ IN-APP SUBSCRIPTION ═════════════ */
  async function subscribeInApp() {
    var visitorId = getVisitorId();
    var device = { browser: getBrowserName(), platform: navigator.platform || 'unknown' };
    try {
      var r = await apiFetch('/api/in-app/subscribe', 'POST', { visitorId: visitorId, device: device });
      return r.success === true;
    } catch (e) { return false; }
  }

  async function isInAppSubscribed() {
    var visitorId = getVisitorId();
    try {
      var r = await apiFetch('/api/in-app/status?visitorId=' + encodeURIComponent(visitorId), 'GET');
      return r.success && r.subscribed === true;
    } catch (e) { return false; }
  }

  async function dismissInAppNotification(notificationId) {
    var visitorId = getVisitorId();
    try {
      await apiFetch('/api/in-app/dismiss', 'POST', { visitorId: visitorId, notificationId: notificationId });
    } catch (e) {}
  }

  async function trackClick(notificationId, event) {
    try {
      await apiFetch('/api/analytics/click', 'POST', { notificationId: notificationId, event: event });
    } catch (e) {}
  }

  async function fetchInAppNotifications() {
    var visitorId = getVisitorId();
    try {
      var r = await apiFetch('/api/in-app/notifications?visitorId=' + encodeURIComponent(visitorId), 'GET');
      if (r && r.success && Array.isArray(r.notifications)) return r.notifications;
    } catch (e) {}
    return [];
  }

  /* ═════════════ SAFETY / ESCAPING ═════════════ */
  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function escapeAttr(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function isSafeUrl(u) {
    if (!u || typeof u !== 'string') return false;
    try { var p = new URL(u, window.location.origin); return p.protocol === 'http:' || p.protocol === 'https:'; }
    catch (e) { return false; }
  }
  function openNotificationDestination(url) {
    if (!isSafeUrl(url)) return;
    try {
      var u = new URL(url, window.location.origin);
      if (u.origin === window.location.origin) { window.location.href = u.href; }
      else { var w = window.open(u.href, '_blank', 'noopener'); if (!w) window.location.href = u.href; }
    } catch (e) {}
  }

  /* ═════════════ RELATIVE TIME ═════════════ */
  function timeAgo(ts) {
    if (!ts) return '';
    var then;
    if (typeof ts === 'number') then = ts < 1e12 ? ts * 1000 : ts;
    else if (typeof ts === 'string') {
      var s = ts.replace(/"/g, '');
      then = Date.parse(s);
      if (isNaN(then) && /^\d+$/.test(s)) then = Number(s) < 1e12 ? Number(s) * 1000 : Number(s);
    } else return '';
    if (isNaN(then)) return '';
    var diff = Math.max(0, Date.now() - then);
    var sec = Math.floor(diff / 1000);
    if (sec < 45)    return 'just now';
    var min = Math.floor(sec / 60);
    if (min < 60)    return min + ' min ago';
    var hr  = Math.floor(min / 60);
    if (hr  < 24)    return hr  + 'h ago';
    var day = Math.floor(hr / 24);
    if (day < 7)     return day + 'd ago';
    try { return new Date(then).toLocaleDateString(); } catch (e) { return ''; }
  }

  /* ═════════════ STYLES ═════════════ */
  function injectStyles() {
    if (document.getElementById('smmaria-notif-styles')) return;
    var style = document.createElement('style');
    style.id = 'smmaria-notif-styles';
    style.textContent = `
      /* ---------- Notification popup card (preserved) ---------- */
      #smmaria-notif-popup {
        position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important;
        z-index: 2147483647 !important; background: #0A1530 !important;
        border-bottom: 3px solid #D4AF37 !important;
        box-shadow: 0 8px 40px rgba(0,0,0,0.6) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        box-sizing: border-box !important; display: block !important;
        padding-top: env(safe-area-inset-top) !important;
      }
      #smmaria-notif-popup .np-inner {
        max-width: 560px !important; margin: 0 auto !important; padding: 16px 20px !important;
        box-sizing: border-box !important; position: relative !important;
      }
      #smmaria-notif-popup .np-header { display:flex!important; align-items:center!important; gap:8px!important; margin-bottom:10px!important; }
      #smmaria-notif-popup .np-brand { font-size:11px!important; font-weight:700!important; color:#F4D068!important; text-transform:uppercase!important; letter-spacing:.1em!important; }
      #smmaria-notif-popup .np-close {
        position:absolute!important; top:12px!important; right:12px!important;
        background:none!important; border:none!important; color:rgba(245,240,225,0.4)!important;
        font-size:24px!important; cursor:pointer!important; padding:0!important; line-height:1!important;
        width:32px!important; height:32px!important; display:flex!important; align-items:center!important; justify-content:center!important;
        border-radius:4px!important;
      }
      #smmaria-notif-popup .np-close:hover, #smmaria-notif-popup .np-close:focus-visible { color:#F5F0E1!important; background:rgba(212,175,55,0.1)!important; outline:2px solid #D4AF37!important; outline-offset:1px!important; }
      #smmaria-notif-popup .np-icon { width:36px!important; height:36px!important; flex-shrink:0!important; object-fit:contain!important; }
      #smmaria-notif-popup .np-title { font-size:15px!important; font-weight:700!important; color:#F5F0E1!important; margin:0 0 6px 0!important; line-height:1.3!important; padding-right:36px!important; }
      #smmaria-notif-popup .np-body { font-size:13px!important; color:rgba(245,240,225,0.72)!important; margin:0 0 12px 0!important; line-height:1.5!important; }
      #smmaria-notif-popup .np-image { width:100%!important; max-height:180px!important; object-fit:cover!important; margin-bottom:12px!important; display:block!important; border:1px solid rgba(212,175,55,0.2)!important; }
      #smmaria-notif-popup .np-actions { display:flex!important; gap:8px!important; }
      #smmaria-notif-popup .np-btn {
        background:#D4AF37!important; color:#0A1530!important; border:none!important;
        padding:11px 22px!important; font-weight:700!important; font-size:13px!important; cursor:pointer!important;
        font-family:inherit!important; text-decoration:none!important; display:inline-block!important;
        border-radius:6px!important; min-height:42px!important;
      }
      #smmaria-notif-popup .np-btn:hover { background:#F4D068!important; }
      #smmaria-notif-popup .np-btn:focus-visible { outline:2px solid #F4D068!important; outline-offset:2px!important; }
      #smmaria-notif-popup .np-btn-outline { background:transparent!important; color:rgba(245,240,225,0.6)!important; border:1px solid rgba(212,175,55,0.3)!important; }
      #smmaria-notif-popup .np-badge { display:inline-block!important; background:#FE2C55!important; color:#fff!important; font-size:10px!important; font-weight:700!important; padding:2px 8px!important; margin-left:auto!important; border-radius:8px!important; }
      @media (max-width:600px){
        #smmaria-notif-popup .np-inner { padding:14px 16px!important; }
        #smmaria-notif-popup .np-title { font-size:14px!important; padding-right:32px!important; }
        #smmaria-notif-popup .np-body { font-size:12px!important; }
        #smmaria-notif-popup .np-btn { width:100%!important; text-align:center!important; }
        #smmaria-notif-popup .np-actions { flex-direction:column!important; }
      }

      /* ---------- Compact subscribe banner ---------- */
      #smmaria-notif-banner {
        position:fixed!important; top:0!important; left:0!important; right:0!important;
        z-index:2147483646!important; background:#0A1530!important;
        border-bottom:2px solid #D4AF37!important;
        box-shadow:0 4px 20px rgba(0,0,0,0.5)!important;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;
        box-sizing:border-box!important; display:block!important;
        padding-top:env(safe-area-inset-top)!important;
        padding-left:env(safe-area-inset-left)!important;
        padding-right:env(safe-area-inset-right)!important;
        max-height:90vh!important; overflow-y:auto!important;
        -webkit-overflow-scrolling:touch;
      }
      #smmaria-notif-banner .sn-inner {
        max-width:560px!important; margin:0 auto!important; padding:12px 14px!important;
        box-sizing:border-box!important; position:relative!important;
      }
      #smmaria-notif-banner .sn-close {
        position:absolute!important; top:8px!important; right:8px!important;
        background:none!important; border:none!important; color:rgba(245,240,225,0.5)!important;
        font-size:22px!important; cursor:pointer!important; width:32px!important; height:32px!important;
        display:flex!important; align-items:center!important; justify-content:center!important;
        padding:0!important; z-index:2!important; border-radius:4px!important;
      }
      #smmaria-notif-banner .sn-close:hover, #smmaria-notif-banner .sn-close:focus-visible { color:#F5F0E1!important; background:rgba(212,175,55,0.1)!important; outline:2px solid #D4AF37!important; outline-offset:1px!important; }
      #smmaria-notif-banner .sn-header { display:flex!important; align-items:center!important; gap:10px!important; margin-bottom:8px!important; padding-right:34px!important; }
      #smmaria-notif-banner .sn-icon { width:30px!important; height:30px!important; flex-shrink:0!important; display:flex!important; align-items:center!important; justify-content:center!important; font-size:18px!important; }
      #smmaria-notif-banner .sn-text { flex:1!important; min-width:0!important; }
      #smmaria-notif-banner .sn-title { font-size:14px!important; font-weight:700!important; color:#F4D068!important; margin:0 0 1px 0!important; line-height:1.2!important; }
      #smmaria-notif-banner .sn-desc { font-size:12px!important; color:rgba(245,240,225,0.7)!important; margin:0!important; line-height:1.3!important; }

      #smmaria-notif-banner .sn-list {
        display:flex!important; flex-direction:column!important; gap:6px!important;
        margin-bottom:8px!important; max-height:200px!important; overflow-y:auto!important;
        -webkit-overflow-scrolling:touch;
      }
      #smmaria-notif-banner .sn-item {
        display:flex!important; align-items:flex-start!important; gap:8px!important;
        padding:8px!important; background:rgba(212,175,55,0.05)!important;
        border:1px solid rgba(212,175,55,0.15)!important; border-radius:6px!important;
        cursor:pointer!important; text-decoration:none!important; color:inherit!important;
        transition:background .15s ease!important;
      }
      #smmaria-notif-banner .sn-item:hover, #smmaria-notif-banner .sn-item:focus-visible {
        background:rgba(212,175,55,0.12)!important; outline:2px solid #D4AF37!important; outline-offset:1px!important;
      }
      #smmaria-notif-banner .sn-item-icon { width:28px!important; height:28px!important; flex-shrink:0!important; border-radius:4px!important; object-fit:contain!important; }
      #smmaria-notif-banner .sn-item-icon-fallback { width:28px!important; height:28px!important; flex-shrink:0!important; display:flex!important; align-items:center!important; justify-content:center!important; font-size:14px!important; background:rgba(212,175,55,0.1)!important; border-radius:4px!important; }
      #smmaria-notif-banner .sn-item-content { flex:1!important; min-width:0!important; }
      #smmaria-notif-banner .sn-item-title { font-size:13px!important; font-weight:600!important; color:#F5F0E1!important; margin:0 0 1px 0!important; line-height:1.25!important; display:-webkit-box!important; -webkit-line-clamp:1!important; -webkit-box-orient:vertical!important; overflow:hidden!important; }
      #smmaria-notif-banner .sn-item-body { font-size:12px!important; color:rgba(245,240,225,0.65)!important; margin:0 0 2px 0!important; line-height:1.35!important; display:-webkit-box!important; -webkit-line-clamp:2!important; -webkit-box-orient:vertical!important; overflow:hidden!important; }
      #smmaria-notif-banner .sn-item-time { font-size:10px!important; color:rgba(245,240,225,0.4)!important; }
      #smmaria-notif-banner .sn-more { font-size:11px!important; color:rgba(245,240,225,0.45)!important; text-align:center!important; margin:2px 0 6px 0!important; }

      #smmaria-notif-banner .sn-actions { display:flex!important; flex-direction:column!important; gap:6px!important; }
      #smmaria-notif-banner .sn-btn {
        background:#D4AF37!important; color:#0A1530!important; border:none!important;
        padding:11px 18px!important; font-weight:700!important; font-size:14px!important;
        cursor:pointer!important; font-family:inherit!important; height:44px!important;
        border-radius:6px!important; text-align:center!important; width:100%!important;
      }
      #smmaria-notif-banner .sn-btn:hover { background:#F4D068!important; }
      #smmaria-notif-banner .sn-btn:disabled { opacity:0.6!important; cursor:default!important; }
      #smmaria-notif-banner .sn-btn:focus-visible { outline:2px solid #F4D068!important; outline-offset:2px!important; }
      #smmaria-notif-banner .sn-install-btn {
        background:transparent!important; color:#D4AF37!important; border:1px solid #D4AF37!important;
        padding:9px 18px!important; font-weight:600!important; font-size:13px!important;
        cursor:pointer!important; font-family:inherit!important; height:40px!important;
        border-radius:6px!important; width:100%!important;
      }
      #smmaria-notif-banner .sn-install-btn:focus-visible { outline:2px solid #F4D068!important; outline-offset:2px!important; }
      #smmaria-notif-banner .sn-status { font-size:11px!important; color:rgba(245,240,225,0.55)!important; text-align:center!important; margin:4px 0 0 0!important; line-height:1.4!important; }

      @media (max-width:380px){
        #smmaria-notif-banner .sn-inner { padding:10px 12px!important; }
        #smmaria-notif-banner .sn-title { font-size:13px!important; }
        #smmaria-notif-banner .sn-desc { font-size:11px!important; }
        #smmaria-notif-banner .sn-item-title { font-size:12px!important; }
        #smmaria-notif-banner .sn-item-body { font-size:11px!important; }
        #smmaria-notif-banner .sn-list { max-height:160px!important; }
        #smmaria-notif-banner .sn-btn { height:42px!important; font-size:13px!important; }
      }

      /* ---------- Install guide (small dialog, not full-screen) ---------- */
      #smmaria-install-guide { position:fixed!important; inset:0!important; z-index:2147483648!important; display:flex!important; align-items:center!important; justify-content:center!important; background:rgba(0,0,0,0.55)!important; padding:16px!important; box-sizing:border-box!important; }
      #smmaria-install-guide[hidden] { display:none!important; }
      #smmaria-install-guide .ig-panel {
        max-width:380px!important; width:100%!important; background:#0A1530!important;
        border:1px solid #D4AF37!important; border-radius:10px!important;
        padding:18px 16px 16px 16px!important; position:relative!important;
        font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;
        box-shadow:0 12px 50px rgba(0,0,0,0.6)!important; box-sizing:border-box!important;
        max-height:90vh!important; overflow-y:auto!important; -webkit-overflow-scrolling:touch;
      }
      #smmaria-install-guide .ig-close { position:absolute!important; top:8px!important; right:8px!important; background:none!important; border:none!important; color:rgba(245,240,225,0.5)!important; font-size:22px!important; cursor:pointer!important; width:30px!important; height:30px!important; display:flex!important; align-items:center!important; justify-content:center!important; border-radius:4px!important; }
      #smmaria-install-guide .ig-close:focus-visible { outline:2px solid #D4AF37!important; outline-offset:1px!important; }
      #smmaria-install-guide .ig-icon { font-size:28px!important; text-align:center!important; margin:2px 0 6px 0!important; }
      #smmaria-install-guide .ig-title { font-size:16px!important; font-weight:700!important; color:#F5F0E1!important; margin:0 0 6px 0!important; text-align:center!important; }
      #smmaria-install-guide .ig-desc { font-size:13px!important; color:rgba(245,240,225,0.7)!important; margin:0 0 12px 0!important; line-height:1.45!important; text-align:center!important; }
      #smmaria-install-guide .ig-steps { margin:0 0 12px 0!important; padding-left:20px!important; font-size:13px!important; color:rgba(245,240,225,0.85)!important; line-height:1.55!important; }
      #smmaria-install-guide .ig-steps li { margin-bottom:6px!important; }
      #smmaria-install-guide .ig-steps strong { color:#F4D068!important; }
      #smmaria-install-guide .ig-note { font-size:11px!important; color:rgba(245,240,225,0.5)!important; margin:0 0 12px 0!important; line-height:1.45!important; text-align:center!important; }
      #smmaria-install-guide .ig-btn { width:100%!important; background:#D4AF37!important; color:#0A1530!important; border:none!important; padding:11px 16px!important; font-weight:700!important; font-size:14px!important; cursor:pointer!important; font-family:inherit!important; border-radius:6px!important; height:44px!important; }
      #smmaria-install-guide .ig-btn:focus-visible { outline:2px solid #F4D068!important; outline-offset:2px!important; }
      #smmaria-install-guide .ig-btn-secondary { background:transparent!important; color:rgba(245,240,225,0.7)!important; border:1px solid rgba(212,175,55,0.3)!important; margin-top:8px!important; }

      @media (prefers-reduced-motion: reduce) {
        #smmaria-notif-banner *, #smmaria-notif-popup *, #smmaria-install-guide * { transition:none!important; animation:none!important; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ═════════════ NOTIFICATION POPUP CARD (preserved) ═════════════ */
  var notifQueue = [];
  var currentNotifIndex = 0;

  function showNotificationPopup(notification) {
    var existing = document.getElementById('smmaria-notif-popup');
    if (existing) existing.remove();
    injectStyles();

    var popup = document.createElement('div');
    popup.id = 'smmaria-notif-popup';

    var iconHtml = notification.iconUrl && isSafeUrl(notification.iconUrl)
      ? '<img class="np-icon" src="' + escapeAttr(notification.iconUrl) + '" alt="" onerror="this.style.display=\'none\'">'
      : '<div style="font-size:22px;">🔔</div>';

    var imageHtml = notification.imageUrl && isSafeUrl(notification.imageUrl)
      ? '<img class="np-image" src="' + escapeAttr(notification.imageUrl) + '" alt="" onerror="this.style.display=\'none\'">'
      : '';

    var actionHtml = notification.actionText
      ? '<button class="np-btn" id="np-action-btn" type="button">' + escapeHtml(notification.actionText) + '</button>'
      : '';

    var countBadge = notifQueue.length > 1
      ? '<span class="np-badge">' + (currentNotifIndex + 1) + ' / ' + notifQueue.length + '</span>'
      : '';

    popup.innerHTML =
      '<div class="np-inner">' +
        '<button class="np-close" id="np-close-btn" type="button" aria-label="Close notification">&times;</button>' +
        '<div class="np-header">' + iconHtml +
          '<span class="np-brand">SMMARIA</span>' + countBadge +
        '</div>' +
        '<div class="np-title">' + escapeHtml(notification.title) + '</div>' +
        '<div class="np-body">' + escapeHtml(notification.body) + '</div>' +
        imageHtml +
        '<div class="np-actions">' + actionHtml +
          '<button class="np-btn np-btn-outline" id="np-dismiss-btn" type="button">Dismiss</button>' +
        '</div>' +
      '</div>';

    if (document.body) document.body.insertBefore(popup, document.body.firstChild);
    else document.documentElement.appendChild(popup);

    var closeBtn   = document.getElementById('np-close-btn');
    var dismissBtn = document.getElementById('np-dismiss-btn');
    var actionBtn  = document.getElementById('np-action-btn');

    function closeAndAdvance() {
      if (popup.parentNode) popup.remove();
      showNextNotification();
    }

    if (closeBtn) closeBtn.addEventListener('click', function () {
      dismissInAppNotification(notification.id); closeAndAdvance();
    });
    if (dismissBtn) dismissBtn.addEventListener('click', function () {
      dismissInAppNotification(notification.id); closeAndAdvance();
    });
    if (actionBtn) actionBtn.addEventListener('click', function () {
      trackClick(notification.id, 'action_click');
      dismissInAppNotification(notification.id);
      var url = notification.destinationUrl;
      closeAndAdvance();
      if (url) openNotificationDestination(url);
    });

    // Title/body click also opens destination
    var titleEl = popup.querySelector('.np-title');
    var bodyEl  = popup.querySelector('.np-body');
    [titleEl, bodyEl].forEach(function (el) {
      if (!el) return;
      el.style.cursor = 'pointer';
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      function go() {
        trackClick(notification.id, 'notification_click');
        dismissInAppNotification(notification.id);
        var url = notification.destinationUrl;
        closeAndAdvance();
        if (url) openNotificationDestination(url);
      }
      el.addEventListener('click', go);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    });
  }

  function showNextNotification() {
    currentNotifIndex++;
    if (currentNotifIndex < notifQueue.length) {
      showNotificationPopup(notifQueue[currentNotifIndex]);
    }
  }

  /* ═════════════ COMPACT SUBSCRIBE BANNER ═════════════ */
  function createBanner(recentNotifications) {
    if (document.getElementById('smmaria-notif-banner')) return;
    injectStyles();

    var recents = Array.isArray(recentNotifications) ? recentNotifications.slice(0, 2) : [];
    var moreCount = Array.isArray(recentNotifications) && recentNotifications.length > 2
      ? (recentNotifications.length - 2) : 0;

    var recentsHtml = '';
    if (recents.length > 0) {
      recentsHtml = '<div class="sn-list" id="smmaria-notif-list">';
      for (var i = 0; i < recents.length; i++) {
        var n = recents[i] || {};
        var dest = n.destinationUrl || n.url || null;
        var tag = (dest && isSafeUrl(dest)) ? 'a' : 'div';
        var href = (tag === 'a') ? ' href="' + escapeAttr(dest) + '"' : '';
        var iconHtml = (n.iconUrl && isSafeUrl(n.iconUrl))
          ? '<img class="sn-item-icon" src="' + escapeAttr(n.iconUrl) + '" alt="" onerror="this.outerHTML=\'<div class=\\\'sn-item-icon-fallback\\\'></div>\';">'
          : '<div class="sn-item-icon-fallback">🔔</div>';
        var time = timeAgo(n.timestamp || n.createdAt || n.created_at || n.date);
        var timeHtml = time ? '<div class="sn-item-time">' + escapeHtml(time) + '</div>' : '';

        recentsHtml +=
          '<' + tag + ' class="sn-item" data-id="' + escapeAttr(n.id) + '"' + href +
            ' role="' + (tag === 'a' ? 'link' : 'button') + '" tabindex="0" aria-label="' + escapeAttr(n.title || 'Notification') + '">' +
            iconHtml +
            '<div class="sn-item-content">' +
              '<div class="sn-item-title">' + escapeHtml(n.title || '') + '</div>' +
              '<div class="sn-item-body">' + escapeHtml(n.body || n.message || '') + '</div>' +
              timeHtml +
            '</div>' +
          '</' + tag + '>';
      }
      recentsHtml += '</div>';
      if (moreCount > 0) {
        recentsHtml += '<div class="sn-more">+' + moreCount + ' more</div>';
      }
    }

    var banner = document.createElement('div');
    banner.id = 'smmaria-notif-banner';
    banner.innerHTML =
      '<div class="sn-inner">' +
        '<button class="sn-close" id="smmaria-notif-close" type="button" aria-label="Close banner">&times;</button>' +
        '<div class="sn-header">' +
          '<div class="sn-icon">🔔</div>' +
          '<div class="sn-text">' +
            '<div class="sn-title">Stay Updated with SMMARIA</div>' +
            '<div class="sn-desc">Order alerts, new services, and announcements.</div>' +
          '</div>' +
        '</div>' +
        recentsHtml +
        '<div class="sn-actions">' +
          '<button class="sn-btn" id="smmaria-notif-enable" type="button">Enable Notifications</button>' +
          '<button class="sn-install-btn" id="smmaria-notif-install" type="button" hidden>Add to Home Screen</button>' +
        '</div>' +
        '<div class="sn-status" id="smmaria-notif-status"></div>' +
      '</div>';

    if (document.body) document.body.insertBefore(banner, document.body.firstChild);
    else document.documentElement.appendChild(banner);

    // Close
    var closeBtn = document.getElementById('smmaria-notif-close');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      banner.remove();
      try { sessionStorage.setItem('smmaria_notif_dismissed', '1'); } catch (e) {}
    });

    // Enable
    var enableBtn = document.getElementById('smmaria-notif-enable');
    if (enableBtn) enableBtn.addEventListener('click', onEnableClick);

    // Install
    var installBtn = document.getElementById('smmaria-notif-install');
    if (installBtn) installBtn.addEventListener('click', onInstallClick);

    // Recent notification click handlers
    var items = banner.querySelectorAll('.sn-item');
    Array.prototype.forEach.call(items, function (el) {
      var id = el.getAttribute('data-id');
      function activate(e) {
        // Don't intercept if it's an <a> with a valid href (let it navigate naturally)
        if (el.tagName.toLowerCase() === 'a') {
          // Still track click + dismiss for analytics/state
          if (id) { trackClick(id, 'notification_click'); dismissInAppNotification(id); }
          return;
        }
        e.preventDefault();
        if (id) { trackClick(id, 'notification_click'); dismissInAppNotification(id); }
        var dest = el.getAttribute('href');
        if (dest) openNotificationDestination(dest);
      }
      el.addEventListener('click', activate);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(e); }
      });
    });

    // Reveal install button if appropriate
    updateInstallButtonVisibility();
  }

  function setStatus(msg) {
    var el = document.getElementById('smmaria-notif-status');
    if (el) el.textContent = msg || '';
  }

  /* ═════════════ ENABLE NOTIFICATIONS FLOW ═════════════ */
  async function onEnableClick() {
    var btn = document.getElementById('smmaria-notif-enable');
    if (!btn) return;
    btn.disabled = true;

    try {
      var installed  = isInstalled();
      var ios        = isIOS();
      var canPush    = canUsePushNow();

      // CASE 1: iOS Safari (not installed) — push NOT available yet
      if (ios && !installed) {
        btn.textContent = 'Subscribing...';
        var inAppOk = await subscribeInApp();

        if (inAppOk) {
          btn.textContent = '✓ In-App Active';
          btn.style.background = '#25D366'; btn.style.color = '#050B1F';
          setStatus('In-app alerts enabled while you visit SMMARIA. ' +
                    'For push notifications on iPhone, install SMMARIA to your Home Screen.');
          // Open install guide automatically since push needs it
          openInstallGuide('iOS — tap "Enable Notifications" inside the installed app after installing.');
        } else {
          btn.textContent = 'Failed — try again';
          btn.disabled = false;
          btn.style.background = '#FE2C55'; btn.style.color = '#fff';
          setStatus('Could not subscribe. Please try again.');
        }
        return;
      }

      // CASE 2: Push-capable (Android, desktop, installed iOS PWA)
      if (canPush) {
        btn.textContent = 'Requesting permission...';
        var permission;
        try { permission = await Notification.requestPermission(); }
        catch (e) { permission = 'denied'; }

        if (permission === 'denied') {
          // Still try in-app
          var inAppDenied = await subscribeInApp();
          if (inAppDenied) {
            btn.textContent = '✓ In-App Only';
            btn.style.background = '#25D366'; btn.style.color = '#050B1F';
            setStatus('Push permission was denied. To enable push, open ' +
                      (ios ? 'iOS Settings → SMMARIA → Notifications' : 'browser settings') +
                      ' and allow notifications. In-app alerts are still active.');
          } else {
            btn.textContent = 'Permission Denied';
            btn.disabled = false;
            btn.style.background = '#FE2C55'; btn.style.color = '#fff';
            setStatus('Push permission was denied. ' +
                      (ios ? 'Enable it in iOS Settings → SMMARIA → Notifications.' : 'Enable it in your browser site settings.'));
          }
          return;
        }

        if (permission !== 'granted') {
          // Default / dismissed — try in-app only
          var inAppDefault = await subscribeInApp();
          if (inAppDefault) {
            btn.textContent = '✓ In-App Active';
            btn.style.background = '#25D366'; btn.style.color = '#050B1F';
            setStatus('In-app alerts active. Tap again later to enable system push.');
            btn.disabled = false;
          } else {
            btn.textContent = 'Failed — try again';
            btn.disabled = false;
            btn.style.background = '#FE2C55'; btn.style.color = '#fff';
          }
          return;
        }

        // Permission granted — subscribe to push AND in-app
        btn.textContent = 'Subscribing...';
        var pushOk   = await subscribeToPush();
        var inAppOk2 = await subscribeInApp();

        if (pushOk && inAppOk2) {
          btn.textContent = '✓ Push + In-App Active';
          btn.style.background = '#25D366'; btn.style.color = '#050B1F';
          setStatus('Both system push and in-app alerts are enabled.');
          scheduleBannerDismiss();
        } else if (pushOk) {
          btn.textContent = '✓ Push Active';
          btn.style.background = '#25D366'; btn.style.color = '#050B1F';
          setStatus('System push notifications enabled.');
          scheduleBannerDismiss();
        } else if (inAppOk2) {
          btn.textContent = '✓ In-App Active';
          btn.style.background = '#25D366'; btn.style.color = '#050B1F';
          setStatus('Push subscription failed, but in-app alerts are active.');
          btn.disabled = false;
        } else {
          btn.textContent = 'Failed — try again';
          btn.disabled = false;
          btn.style.background = '#FE2C55'; btn.style.color = '#fff';
          setStatus('Could not subscribe. Please try again.');
        }
        return;
      }

      // CASE 3: Non-push browser (in-app only)
      btn.textContent = 'Subscribing...';
      var ok = await subscribeInApp();
      if (ok) {
        btn.textContent = '✓ In-App Active';
        btn.style.background = '#25D366'; btn.style.color = '#050B1F';
        setStatus('In-app alerts enabled while you visit SMMARIA.');
        scheduleBannerDismiss();
      } else {
        btn.textContent = 'Failed — try again';
        btn.disabled = false;
        btn.style.background = '#FE2C55'; btn.style.color = '#fff';
      }
    } catch (e) {
      btn.textContent = 'Error — try again';
      btn.disabled = false;
    }
  }

  function scheduleBannerDismiss() {
    setTimeout(function () {
      var b = document.getElementById('smmaria-notif-banner');
      if (b) b.remove();
    }, 2000);
  }

  /* ═════════════ ADD TO HOME SCREEN ═════════════ */
  var deferredPrompt = null;
  var promptInstalledChecked = false;

  function setupInstallListeners() {
    if (promptInstalledChecked) return;
    promptInstalledChecked = true;

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      updateInstallButtonVisibility();
    });

    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      updateInstallButtonVisibility();
      // After install, refresh the page so the SW and standalone mode take effect
      try { window.location.reload(); } catch (e) {}
    });
  }

  function updateInstallButtonVisibility() {
    var btn = document.getElementById('smmaria-notif-install');
    if (!btn) return;

    // Hide if already installed
    if (isInstalled()) { btn.hidden = true; return; }

    // Show on iOS Safari (manual install path) or Chromium with deferred prompt
    if (isIOS()) { btn.hidden = false; return; }
    if (deferredPrompt) { btn.hidden = false; return; }
    // Hide otherwise (browser without prompt support and not iOS)
    btn.hidden = true;
  }

  function onInstallClick() {
    if (deferredPrompt && typeof deferredPrompt.prompt === 'function') {
      deferredPrompt.prompt();
      var choiceP = deferredPrompt.userChoice;
      if (choiceP && typeof choiceP.then === 'function') {
        choiceP.then(function (choice) {
          if (choice && choice.outcome === 'accepted') {
            // Will be handled by 'appinstalled' event
          } else {
            // Dismissed — keep the button available
            updateInstallButtonVisibility();
          }
          deferredPrompt = null;
        }).catch(function () { deferredPrompt = null; });
      } else {
        deferredPrompt = null;
      }
    } else {
      openInstallGuide('');
    }
  }

  function openInstallGuide(noteOverride) {
    injectStyles();
    var existing = document.getElementById('smmaria-install-guide');
    if (existing) existing.remove();

    var isIOSDevice = isIOS();
    var guide = document.createElement('div');
    guide.id = 'smmaria-install-guide';

    var stepsHtml;
    if (isIOSDevice) {
      stepsHtml =
        '<ol class="ig-steps">' +
          '<li>Tap Safari\'s <strong>Share</strong> icon (square with an up arrow).</li>' +
          '<li>Scroll the share sheet and tap <strong>Add to Home Screen</strong>.</li>' +
          '<li>Tap <strong>Add</strong> to confirm.</li>' +
          '<li>Open SMMARIA from the new Home Screen icon.</li>' +
        '</ol>';
    } else {
      stepsHtml =
        '<ol class="ig-steps">' +
          '<li>Tap your browser menu (⋮ or ⋯).</li>' +
          '<li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>' +
          '<li>Confirm the installation.</li>' +
          '<li>Open SMMARIA from the new icon.</li>' +
        '</ol>';
    }

    var note = noteOverride ||
      'After installing, open SMMARIA from the new icon, then tap "Enable Notifications" to turn on system push alerts.';

    guide.innerHTML =
      '<div class="ig-panel" role="dialog" aria-modal="true" aria-label="Install SMMARIA">' +
        '<button class="ig-close" id="ig-close-btn" type="button" aria-label="Close">&times;</button>' +
        '<div class="ig-icon">📱</div>' +
        '<div class="ig-title">Install SMMARIA</div>' +
        '<p class="ig-desc">Add SMMARIA to your Home Screen for a faster, app-like experience and to enable push notifications.</p>' +
        stepsHtml +
        '<p class="ig-note">' + escapeHtml(note) + '</p>' +
        '<button class="ig-btn" id="ig-done-btn" type="button">Got it</button>' +
      '</div>';

    if (document.body) document.body.appendChild(guide);

    var closeBtn = document.getElementById('ig-close-btn');
    var doneBtn  = document.getElementById('ig-done-btn');
    if (closeBtn) closeBtn.addEventListener('click', function () { guide.remove(); });
    if (doneBtn)  doneBtn.addEventListener('click',  function () { guide.remove(); });

    // Trap minimal focus + ESC to close
    if (doneBtn) { try { doneBtn.focus(); } catch (e) {} }
    guide.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { guide.remove(); }
    });
  }

  /* ═════════════ MAIN INIT (single path) ═════════════ */
  async function init() {
    if (INIT_STARTED) return;
    INIT_STARTED = true;

    setupInstallListeners();

    var recentNotifications = [];
    try { recentNotifications = await fetchInAppNotifications(); }
    catch (e) { recentNotifications = []; }

    notifQueue = Array.isArray(recentNotifications) ? recentNotifications : [];
    currentNotifIndex = 0;

    // 1) If there are unread notifications, show the popup card
    if (notifQueue.length > 0) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          showNotificationPopup(notifQueue[0]);
        });
      } else {
        showNotificationPopup(notifQueue[0]);
      }
      // Don't render the banner at the same time as the popup
      INIT_DONE = true;
      return;
    }

    // 2) Respect session dismissal of banner
    try {
      if (sessionStorage.getItem('smmaria_notif_dismissed') === '1') { INIT_DONE = true; return; }
    } catch (e) {}

    // 3) Determine if already subscribed
    var alreadySubscribed = false;
    var inAppSub = await isInAppSubscribed();
    if (inAppSub) alreadySubscribed = true;

    if (!alreadySubscribed && canUsePushNow()) {
      var localSub = await hasLocalSubscription();
      if (localSub) alreadySubscribed = true;
    }

    if (alreadySubscribed) { INIT_DONE = true; return; }

    // 4) Render compact banner WITH recent notifications (if any came back)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        createBanner(recentNotifications);
      });
    } else {
      createBanner(recentNotifications);
    }

    INIT_DONE = true;
  }

  /* ---- Start ---- */
  try { init(); } catch (e) {}

  /* ---- Single DOMContentLoaded safety net (does NOT re-fetch if init ran) ---- */
  document.addEventListener('DOMContentLoaded', function () {
    // Only act if init somehow didn't run (very rare script-timing edge case)
    if (INIT_DONE) return;
    try { init(); } catch (e) {}
  });
})();
