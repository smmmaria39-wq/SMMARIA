/**
 * SMMMARIA Panel — Binance Pay Configuration
 * ES Module Version
 */

const defaultSettings = {
 enabled: true,
 qrCodeImage: 'https://ik.imagekit.io/s95tumxuk/IMG_6253.png',
 paymentLink: '',
 recipientId: '',
 recipientName: '',
 currency: 'USD',
 cryptoType: '',
 network: '',
 minDeposit: 1,
 maxDeposit: 10000,
 instructions: 'Open your Binance app, scan the QR code, and confirm the payment. After payment, send the screenshot to our WhatsApp support.',
 whatsappNumber: '256770898186',
 manualVerificationNotice: 'Your deposit will be manually verified. Sending a WhatsApp message does not automatically confirm payment.',
 supportReferences: false
};

function loadSettings() {
 try {
  const stored = localStorage.getItem('smmaria_binance_pay_settings');
  if (stored) {
   return Object.assign({}, defaultSettings, JSON.parse(stored));
  }
 } catch (e) {
  console.warn('[Binance Pay Config] Could not load from localStorage:', e);
 }
 return Object.assign({}, defaultSettings);
}

function saveSettings(settings) {
 try {
  localStorage.setItem('smmaria_binance_pay_settings', JSON.stringify(settings));
  return true;
 } catch (e) {
  console.error('[Binance Pay Config] Could not save:', e);
  return false;
 }
}

const settings = loadSettings();

export const BinancePayConfig = {
 settings: settings,
 
 get: function(key) {
  return settings[key];
 },
 
 getAll: function() {
  return Object.assign({}, settings);
 },
 
 update: function(newSettings) {
  Object.assign(settings, newSettings);
  return saveSettings(settings);
 },
 
 isEnabled: function() {
  return settings.enabled === true;
 },
 
 hasQrCode: function() {
  return !!settings.qrCodeImage && settings.qrCodeImage.length > 0;
 },
 
 hasPaymentLink: function() {
  if (!settings.paymentLink) return false;
  try {
   var url = new URL(settings.paymentLink);
   return url.protocol === 'https:';
  } catch (_) {
   return false;
  }
 },
 
 hasRecipientId: function() {
  return !!settings.recipientId && settings.recipientId.length > 0;
 }
};
