/**
 * SMMMARIA Panel — Binance Pay Frontend Configuration
 * Standalone Backend Integration Version
 *
 * This file ONLY contains public configuration. No secrets, keys, or credentials.
 */

const isDevEnv =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

export const BinancePayConfig = {
  // Public URL of your standalone Binance Pay backend.
  // Dev port MUST match the backend's PORT env (default 7700 in env.js).
  apiBaseUrl: isDevEnv
    ? 'http://localhost:7700'
    : 'https://bnc-py-smaria-production.up.railway.app',

  endpoints: {
    settings: '/api/binance/settings',
    createDeposit: '/api/binance/deposits',
    listDeposits: '/api/binance/deposits',
    depositStatus: '/api/binance/deposits/:depositId',
    verifyDeposit: '/api/binance/deposits/:depositId/verify'
    // No cancelDeposit — the backend intentionally does not allow user-
    // initiated cancellation; deposits expire after ORDER_EXPIRATION_MINUTES.
  },

  // Safe frontend defaults. The `currency` here is a FALLBACK only — always
  // prefer the value returned by GET /api/binance/settings, since
  // SUPPORTED_CURRENCIES is enforced server-side.
  defaults: {
    currency: 'USDT',
    loadingText: 'Loading Binance Pay options...',
    disabledText: 'Binance Pay is temporarily unavailable.',
    pollInterval: 5000,       // 5 seconds
    maxPollDuration: 300000   // 5 minutes
  },

  /**
   * Safely build a URL without duplicate slashes.
   * @param {string} path - The API endpoint path (use BinancePayConfig.endpoints.*)
   * @param {object} params - Path params to inject, e.g. { depositId: 'abc' }
   * @returns {string|null} The fully qualified URL, or null if invalid.
   */
  buildUrl(path, params = {}) {
    const base = BinancePayConfig.apiBaseUrl;
    if (!base || (!isDevEnv && !base.startsWith('https://'))) {
      console.error(
        '[Binance Pay Config] Invalid or missing API Base URL. HTTPS is required in production.'
      );
      return null;
    }

    const cleanBase = base.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    let url = `${cleanBase}/${cleanPath}`;

    Object.keys(params).forEach((key) => {
      url = url.replace(`:${key}`, encodeURIComponent(params[key]));
    });

    return url;
  }
};
