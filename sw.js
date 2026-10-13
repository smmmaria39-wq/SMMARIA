/* =========================================================================
 *  SMMARIA SERVICE WORKER  (upgraded)
 *  Preserves: push handler, notificationclick handler, payload format,
 *  tags, actions, analytics, tab focusing, skipWaiting/clients.claim.
 *  Adds: URL validation, defensive payload handling, waitUntil on analytics.
 * ========================================================================= */

const NOTIF_API_URL = 'https://notifications-production-4281.up.railway.app';
const SITE_ORIGIN   = 'https://smmaria.site';

/* ---- helpers --------------------------------------------------------- */
function isSafeUrl(u) {
  if (!u || typeof u !== 'string') return false;
  try {
    const parsed = new URL(u, SITE_ORIGIN);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) { return false; }
}

function normalizeUrl(u) {
  if (!isSafeUrl(u)) return SITE_ORIGIN;
  try { return new URL(u, SITE_ORIGIN).href; }
  catch (e) { return SITE_ORIGIN; }
}

/* ---- push event ----------------------------------------------------- */
self.addEventListener('push', function (event) {
  let payload = {};
  let dataRaw = null;

  try {
    if (event.data) {
      dataRaw = event.data.text();
      payload  = event.data.json();
    }
  } catch (e) {
    // Plain-text payload — keep going with a sensible fallback
    try { payload = { title: 'SMMARIA', body: dataRaw || '' }; }
    catch (e2) { payload = { title: 'SMMARIA', body: 'You have a new notification' }; }
  }

  if (!payload || typeof payload !== 'object') payload = {};

  const title = String(payload.title || 'SMMARIA').slice(0, 200);
  const body  = String(payload.body  || '').slice(0, 500);

  const options = {
    body: body,
    requireInteraction: false,
    data: {
      url: normalizeUrl(payload.url),
      notificationId: payload.notificationId || null,
      actionText: payload.actionText || null
    }
  };

  if (payload.icon)  options.icon  = String(payload.icon);
  if (payload.badge) options.badge = String(payload.badge);
  if (payload.image) options.image = String(payload.image);

  if (payload.actionText) {
    options.actions = [
      { action: 'activate', title: String(payload.actionText).slice(0, 24) },
      { action: 'close',    title: 'Dismiss' }
    ];
  }

  if (payload.notificationId) {
    options.tag     = String(payload.notificationId);
    options.renotify = true;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ---- notification click -------------------------------------------- */
self.addEventListener('notificationclick', function (event) {
  const notif = event.notification;
  const data  = notif.data || {};
  const url   = normalizeUrl(data.url);
  const notificationId = data.notificationId || null;
  const isActionClick = !!event.action && event.action !== 'close';

  if (event.action === 'close') { notif.close(); return; }

  const eventType  = isActionClick ? 'action_click' : 'notification_click';
  const actionName = event.action || null;

  notif.close();

  // Analytics — fire-and-forget, never blocks navigation
  const analyticsPromise = (function () {
    if (!notificationId) return Promise.resolve();
    return fetch(NOTIF_API_URL + '/api/analytics/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId: notificationId,
        event: eventType,
        action: actionName
      }),
      keepalive: true
    }).catch(function () { /* silent */ });
  })();

  const openPromise = (async function () {
    try {
      const allClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      for (let i = 0; i < allClients.length; i++) {
        const client = allClients[i];
        if (client.url && client.url.indexOf('smmaria.site') !== -1) {
          try { await client.focus(); } catch (e) {}
          if (typeof client.navigate === 'function') {
            try { await client.navigate(url); } catch (e) { /* cross-origin */ }
          }
          return;
        }
      }
      try { await clients.openWindow(url); }
      catch (e) { try { await clients.openWindow(SITE_ORIGIN); } catch (e2) {} }
    } catch (e) {
      try { await clients.openWindow(SITE_ORIGIN); } catch (e2) {}
    }
  })();

  event.waitUntil(Promise.all([analyticsPromise, openPromise]));
});

/* ---- install / activate (unchanged behavior) ----------------------- */
self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});
