/**
 * SMMMARIA Panel  Binance Pay Manual Deposit Logic
 * Standalone Backend Integration Version
 */
import { BinancePayConfig } from './binance-pay-config.js';

let depositCreated = false;
let currentDepositId = null;
let currentReference = null;
let pollTimer = null;
let pollStartTime = null;
let isSubmitting = false;

// Firebase instance holder (assumes Firebase is initialized globally in app.js)
let firebaseAuth = null;

export function initBinancePay(firebase) {
    if (firebase) firebaseAuth = firebase.auth();
    
    // Reset state
    depositCreated = false;
    currentDepositId = null;
    isSubmitting = false;
    if (pollTimer) clearInterval(pollTimer);

    // Fetch backend settings
    loadBackendSettings();
    
    // Setup UI listeners
    setupPaymentMethodToggle();
    setupAmountListener();
    setupFormSubmission();
    setupQrEnlarge();
    setupCopyButtons();
}

/* ═══════════════════════════════════════
   LOAD BACKEND SETTINGS
   ═══════════════════════════════════════ */
async function loadBackendSettings() {
    const tile = document.querySelector('.payment-tile.binance-tile');
    if (!tile) return;

    const settingsUrl = BinancePayConfig.buildUrl(BinancePayConfig.endpoints.settings);
    
    if (!settingsUrl) {
        tile.style.display = 'none';
        return;
    }

    try {
        const res = await fetch(settingsUrl);
        if (!res.ok) throw new Error('Failed to fetch settings');
        
        const settings = await res.json();
        
        if (!settings.enabled) {
            hideBinanceTile();
            return;
        }

        // Store limits and display data in dataset for later validation
        tile.dataset.minDeposit = settings.minDeposit || 1;
        tile.dataset.maxDeposit = settings.maxDeposit || 10000;
        tile.dataset.currency = settings.currency || 'USD';
        
        // Render any static QR or recipient info provided by backend
        renderStaticSettings(settings);
        
    } catch (error) {
        console.error('[Binance Pay] Failed to load settings:', error);
        hideBinanceTile();
    }
}

function hideBinanceTile() {
    const tiles = document.querySelectorAll('.payment-tile');
    for (var i = 0; i < tiles.length; i++) {
        var radio = tiles[i].querySelector('input[value="binance"]');
        if (radio) tiles[i].style.display = 'none';
    }
}

function renderStaticSettings(settings) {
    // If backend provides a static QR code (e.g. for manual transfers)
    const wrapper = document.getElementById('binance-qr-wrapper');
    if (wrapper && settings.qrCodeImage) {
        wrapper.innerHTML = `
            <img src="${escapeAttr(settings.qrCodeImage)}" alt="Binance Pay QR Code" id="binance-qr-img">
            <button type="button" class="binance-qr-enlarge-btn" id="binance-qr-enlarge-trigger">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                Enlarge QR Code
            </button>`;
    }

    const info = document.getElementById('binance-recipient-info');
    if (info && settings.recipientName) {
        info.innerHTML = `<div>Recipient: <strong>${escapeHtml(settings.recipientName)}</strong></div>`;
    }
}

/* ═══════════════════════════════════════
   UI TOGGLE & AMOUNT LISTENERS
   ═══════════════════════════════════════ */
function setupPaymentMethodToggle() {
    const binanceRadio = document.querySelector('input[name="payment-method"][value="binance"]');
    if (!binanceRadio) return;

    binanceRadio.addEventListener('change', function () {
        if (this.checked) showBinanceFields();
    });

    const allRadios = document.querySelectorAll('input[name="payment-method"]');
    for (let i = 0; i < allRadios.length; i++) {
        if (allRadios[i].value !== 'binance') {
            allRadios[i].addEventListener('change', function () {
                if (this.checked) hideBinanceFields();
            });
        }
    }
}

function showBinanceFields() {
    const fields = document.getElementById('binance-fields');
    if (fields) fields.style.display = 'block';
    updateAmountDisplay();
}

function hideBinanceFields() {
    const fields = document.getElementById('binance-fields');
    if (fields) fields.style.display = 'none';
}

function setupAmountListener() {
    const amountInput = document.getElementById('deposit-amount');
    if (!amountInput) return;

    amountInput.addEventListener('input', function () {
        updateAmountDisplay();
        if (depositCreated) invalidateDeposit();
    });
}

function updateAmountDisplay() {
    const amountInput = document.getElementById('deposit-amount');
    if (!amountInput) return;

    const amount = parseFloat(amountInput.value) || 0;
    let bonus = 0;
    const bonusInfo = document.getElementById('bonus-info');
    if (bonusInfo) {
        const match = bonusInfo.textContent.match(/\+\$?([\d.]+)/);
        if (match) bonus = parseFloat(match[1]) || 0;
    }

    const tile = document.querySelector('.payment-tile.binance-tile');
    const currency = tile?.dataset.currency || 'USD';
    const total = amount + bonus;

    setText('binance-deposit-amount', formatMoney(amount, currency));
    setText('binance-bonus-amount', '+' + formatMoney(bonus, currency));
    setText('binance-total-credited', formatMoney(total, currency));
    setText('binance-currency', currency);
}

function formatMoney(amount, currency) {
    const symbol = currency === 'USD' ? '$' : '';
    return symbol + (amount || 0).toFixed(2);
}

/* ═══════════════════════════════════════
   FORM SUBMISSION & DEPOSIT CREATION
   ═══════════════════════════════════════ */
function setupFormSubmission() {
    const form = document.getElementById('deposit-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        const selected = document.querySelector('input[name="payment-method"]:checked');
        if (!selected || selected.value !== 'binance') return;

        e.preventDefault();
        e.stopPropagation();
        
        if (isSubmitting) return;
        await handleBinanceDeposit();
    }, true);
}

async function handleBinanceDeposit() {
    if (!firebaseAuth) {
        notify('Authentication service not loaded. Please refresh the page.', 'error');
        return;
    }

    const user = firebaseAuth.currentUser;
    if (!user) {
        notify('Please log in to make a deposit.', 'error');
        return;
    }

    isSubmitting = true;
    toggleSubmitButton(true);

    const amountInput = document.getElementById('deposit-amount');
    const amount = parseFloat(amountInput.value) || 0;
    const tile = document.querySelector('.payment-tile.binance-tile');
    const minD = parseFloat(tile?.dataset.minDeposit || 1);
    const maxD = parseFloat(tile?.dataset.maxDeposit || 10000);
    const currency = tile?.dataset.currency || 'USD';

    if (amount < minD) {
        notify(`Minimum Binance Pay deposit is ${formatMoney(minD, currency)}`, 'error');
        isSubmitting = false;
        toggleSubmitButton(false);
        return;
    }
    if (amount > maxD) {
        notify(`Maximum Binance Pay deposit is ${formatMoney(maxD, currency)}`, 'error');
        isSubmitting = false;
        toggleSubmitButton(false);
        return;
    }

    try {
        const idToken = await user.getIdToken();
        const createUrl = BinancePayConfig.buildUrl(BinancePayConfig.endpoints.createDeposit);
        
        const res = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ amount, currency })
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || 'Backend rejected deposit request.');
        }

        const data = await res.json();
        
        if (!data.depositId || !data.reference) {
            throw new Error('Invalid response from backend. Missing deposit ID.');
        }

        currentDepositId = data.depositId;
        currentReference = data.reference;
        depositCreated = true;

        // Render dynamic checkout details
        renderCheckoutDetails(data);
        enableWhatsAppButton(currentReference, amount, currency);
        lockAmountField();

        notify('Deposit initiated. Please complete payment via Binance.', 'success');

        // Start polling
        startStatusPolling();

    } catch (error) {
        console.error('[Binance Pay] Deposit creation failed:', error);
        notify(error.message || 'Failed to initiate deposit. No funds have been deducted.', 'error');
        invalidateDeposit();
    } finally {
        isSubmitting = false;
        toggleSubmitButton(false);
    }
}

function renderCheckoutDetails(data) {
    setText('binance-deposit-reference', currentReference);
    const copyBtn = document.getElementById('binance-copy-ref-btn');
    if (copyBtn) copyBtn.style.display = 'inline-block';
    
    const pending = document.getElementById('binance-reference-pending');
    if (pending) pending.style.display = 'none';

    // If backend returns a specific checkout URL for this order
    const linkBtn = document.getElementById('binance-payment-link');
    if (linkBtn && data.checkoutUrl) {
        try {
            const parsedUrl = new URL(data.checkoutUrl);
            if (parsedUrl.protocol === 'https:') {
                linkBtn.href = data.checkoutUrl;
                linkBtn.style.display = 'flex';
            }
        } catch (_) {
            console.warn('[Binance Pay] Invalid checkout URL returned by backend');
        }
    }

    // If backend returns a dynamic QR code for this specific order
    const wrapper = document.getElementById('binance-qr-wrapper');
    if (wrapper && data.qrCodeImage) {
        wrapper.innerHTML = `
            <img src="${escapeAttr(data.qrCodeImage)}" alt="Binance Pay QR Code" id="binance-qr-img">
            <button type="button" class="binance-qr-enlarge-btn" id="binance-qr-enlarge-trigger">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                Enlarge QR Code
            </button>`;
    }
}

function lockAmountField() {
    const input = document.getElementById('deposit-amount');
    if (input) {
        input.setAttribute('readonly', 'readonly');
        input.style.opacity = '0.7';
    }
}

function invalidateDeposit() {
    if (pollTimer) clearInterval(pollTimer);
    depositCreated = false;
    currentDepositId = null;
    currentReference = null;

    setText('binance-deposit-reference', '—');

    const copyBtn = document.getElementById('binance-copy-ref-btn');
    if (copyBtn) copyBtn.style.display = 'none';

    const pending = document.getElementById('binance-reference-pending');
    if (pending) {
        pending.style.display = 'block';
        pending.textContent = 'Click "Process Deposit" to generate a new reference.';
    }

    const waBtn = document.getElementById('binance-whatsapp-btn');
    if (waBtn) {
        waBtn.href = '#';
        waBtn.classList.add('disabled');
    }

    const input = document.getElementById('deposit-amount');
    if (input) {
        input.removeAttribute('readonly');
        input.style.opacity = '';
    }

    // Reset QR code and Payment link UI
    const linkBtn = document.getElementById('binance-payment-link');
    if (linkBtn) {
        linkBtn.style.display = 'none';
        linkBtn.removeAttribute('href');
    }

    const wrapper = document.getElementById('binance-qr-wrapper');
    if (wrapper) {
        wrapper.innerHTML = `
            <div class="binance-qr-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <span>Enter amount and click Process Deposit to generate a QR code.</span>
            </div>`;
    }
}

function toggleSubmitButton(isLoading) {
    const btn = document.querySelector('#deposit-form button[type="submit"]');
    if (!btn) return;
    
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.innerHTML = 'Processing...';
        btn.disabled = true;
    } else {
        if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
        btn.disabled = false;
    }
}

/* ═══════════════════════════════════════
   PAYMENT STATUS POLLING
   ═══════════════════════════════════════ */
function startStatusPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollStartTime = Date.now();

    pollTimer = setInterval(async () => {
        if (!currentDepositId) {
            clearInterval(pollTimer);
            return;
        }

        // Prevent infinite polling
        if (Date.now() - pollStartTime > BinancePayConfig.defaults.maxPollDuration) {
            clearInterval(pollTimer);
            notify('Payment verification timed out. Please contact support if you have paid.', 'info');
            return;
        }

        try {
            const idToken = await firebaseAuth.currentUser.getIdToken();
            const statusUrl = BinancePayConfig.buildUrl(BinancePayConfig.endpoints.depositStatus, { depositId: currentDepositId });
            
            const res = await fetch(statusUrl, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });

            if (!res.ok) throw new Error('Failed to fetch status');
            const data = await res.json();

            handleStatusUpdate(data.status);

        } catch (error) {
            console.warn('[Binance Pay] Polling error:', error);
            // Don't stop polling on transient network errors, just try again next interval
        }
    }, BinancePayConfig.defaults.pollInterval);
}

function handleStatusUpdate(status) {
    switch (status) {
        case 'credited':
            clearInterval(pollTimer);
            notify('Payment confirmed! Your wallet has been credited.', 'success');
            
            // Dispatch global event so app.js can update the navbar balance natively
            window.dispatchEvent(new CustomEvent('binancePay:credited'));
            break;
        case 'expired':
        case 'cancelled':
        case 'failed':
            clearInterval(pollTimer);
            notify(`Deposit ${status}.`, 'error');
            invalidateDeposit();
            break;
        case 'paid_uncredited':
            notify('Payment received. Crediting wallet...', 'info');
            break;
        case 'review_required':
            clearInterval(pollTimer);
            notify('Payment requires manual review. Please contact support.', 'error');
            break;
        // 'pending' -> do nothing, keep polling
    }
}

/* ═══════════════════════════════════════
   WHATSAPP & UTILITIES
   ═══════════════════════════════════════ */
function enableWhatsAppButton(reference, amount, currency) {
    // Note: WhatsApp number could be dynamic from backend settings, but fallback to existing for now
    const phone = '256770898186'; 
    const msg = buildWhatsAppMessage(reference, amount, currency);
    const url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);

    const btn = document.getElementById('binance-whatsapp-btn');
    if (btn) {
        btn.href = url;
        btn.classList.remove('disabled');
    }
}

function buildWhatsAppMessage(reference, amount, currency) {
    return `Hello SMMARIA Support, I have completed a Binance Pay deposit.\n\nDeposit Reference: ${reference}\nAmount: ${formatMoney(amount, currency)}\n\nI will send my payment screenshot for verification.`;
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setupQrEnlarge() {
    document.addEventListener('click', function (e) {
        if (e.target.closest('#binance-qr-enlarge-trigger')) {
            const img = document.getElementById('binance-qr-img');
            const modalImg = document.getElementById('binance-qr-modal-img');
            const modal = document.getElementById('binance-qr-modal');
            if (img && modalImg && modal) {
                modalImg.src = img.src;
                modal.classList.add('active');
            }
        }
    });

    const closeBtn = document.getElementById('binance-qr-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', () => {
        document.getElementById('binance-qr-modal')?.classList.remove('active');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('binance-qr-modal')?.classList.remove('active');
        }
    });
}

function setupCopyButtons() {
    document.addEventListener('click', function (e) {
        const btn = e.target.closest('#binance-copy-ref-btn');
        if (btn) {
            const refText = document.getElementById('binance-deposit-reference')?.innerText || '';
            copyToClipboard(refText, btn);
        }
    });
}

function copyToClipboard(text, btn) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => showCopied(btn)).catch(() => fallbackCopy(text, btn));
    } else {
        fallbackCopy(text, btn);
    }
}

function fallbackCopy(text, btn) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showCopied(btn); } catch (e) {}
    document.body.removeChild(ta);
}

function showCopied(btn) {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
    }, 2000);
}

function notify(message, type) {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }

    const bg = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:${bg};color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;z-index:9999;`;
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.parentNode?.removeChild(el), 300);
    }, 4500);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
