/**
 * SMMMARIA Panel  Binance Pay Frontend Configuration
 * Standalone Backend Integration Version
 * 
 * This file ONLY contains public configuration. No secrets, keys, or credentials.
 */

const isDevEnv = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const BinancePayConfig = {
 // Public URL of your standalone Binance Pay backend
 // TODO: Replace 'https://YOUR-STANDALONE-BACKEND-URL' with your actual Railway/Render URL
 apiBaseUrl: isDevEnv ? 'http://localhost:5001' : 'https://YOUR-STANDALONE-BACKEND-URL',
 
 endpoints: {
  settings: '/api/binance/settings',
  createDeposit: '/api/binance/deposits',
  depositStatus: '/api/binance/deposits/:depositId',
  cancelDeposit: '/api/binance/deposits/:depositId/cancel' // Added for completeness
 },
 
 // Safe frontend defaults
 defaults: {
  currency: 'USD',
  loadingText: 'Loading Binance Pay options...',
  disabledText: 'Binance Pay is temporarily unavailable.',
  pollInterval: 5000, // 5 seconds
  maxPollDuration: 300000 // 5 minutes
 },
 
 /**
  * Safely build a URL without duplicate slashes
  * @param {string} path - The API endpoint path
  * @param {object} params - URL parameters to inject (e.g., { depositId: '123' })
  * @returns {string|null} The fully qualified URL, or null if invalid
  */
 buildUrl(path, params = {}) {
  if (!this.apiBaseUrl || (!isDevEnv && !this.apiBaseUrl.startsWith('https://'))) {
   console.error('[Binance Pay Config] Invalid or missing API Base URL. HTTPS is required in production.');
   return null;
  }
  
  // Strip trailing slash from base, leading slash from path, and join safely
  const base = this.apiBaseUrl.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  let url = `${base}/${cleanPath}`;
  
  // Replace :param placeholders with actual values
  Object.keys(params).forEach(key => {
   url = url.replace(`:${key}`, encodeURIComponent(params[key]));
  });
  
  return url;
 }
};
