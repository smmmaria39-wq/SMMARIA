/**
 * SMMMARIA Panel — Binance Pay Manual Deposit Logic
 * Standalone Backend Integration Version
 *
 * Backend response envelope: every /api/binance/* endpoint (except /settings)
 * returns { success: true, data: <payload> } on success, or
 * { success: false, error: { code, message } } on failure. Always unwrap.
 *
 * Polling hits POST /api/binance/deposits/:depositId/verify (NOT GET status)
 * because only the verify endpoint actually calls Binance to check the live
 * order status. GET /:depositId just reads the local Firebase cache and would
 * return 'pending' forever even after the user pays.
 *
 * When the Binance order IS paid but WALLET_CREDIT_ENABLED=false on the
 * backend, /verify returns 503 VERIFICATION_UNAVAILABLE. The frontend treats
 * that as "payment received, pending manual credit" rather than a hard failure.
 */
import { BinancePayConfig } from './binance-pay-config.js';

let depositCreated = false;
let currentDepositId = null;
let currentReference = null;
let pollTimer = null;
let pollStartTime = null;
let isSubmitting = false;

// Firebase auth instance holder (assumes Firebase is initialized globally
// in app.js and passed into initBinancePay(firebase)).
let firebaseAuth = null;

// Cached backend settings (currency, limits) from /api/binance/settings.
let backendSettings = null;

// Guards against double-binding DOM listeners if initBinancePay() is called
// more than once (e.g. on SPA route changes). State above is reset on each
// call, but event listeners must not be re-registered or they'd fire N times
// per click.
let listenersBound = false;

export function initBinancePay(firebase) {
    if (firebase) firebaseAuth = firebase.auth();

    // Reset runtime state.
    depositCreated = false;
    currentDepositId = null;
    currentReference = null;
    isSubmitting = false;
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }

    // Fetch backend settings (currency, limits) before binding UI so the
    // amount display renders with the right currency on first paint.
    loadBackendSettings();

    // Only bind UI listeners once per page load.
    if (listenersBound) return;
    listenersBound = true;

    setupPaymentMethodToggle();
    setupAmountListener();
    setupFormSubmission();
    setupQrEnlarge();
    setupCopyButtons();
}

/* ═══════════════════════════════════════
   BACKEND RESPONSE UNWRAPPING
   ═══════════════════════════════════════ */

/**
 * Pulls `payload` out of the backend's { success, data } envelope, or throws
 * with the backend's error message if the request failed.
 *
 * The /api/binance/settings endpoint returns its payload directly (no
 * envelope), so this helper falls back to the raw JSON when `data` is absent.
 *
 * @param {Response} res - The fetch Response object.
 * @returns {Promise<object>} The unwrapped payload.
 */
async function unwrapResponse(res) {
    let json;
    try {
        json = await res.json();
    } catch (e) {
        throw new Error('Backend returned a non-JSON response.');
    }

    if (!res.ok || json?.success === false) {
        const msg = json?.error?.message || json?.message || `Request failed (HTTP ${res.status}).`;
        throw new Error(msg);
    }

    return json?.data ?? json;
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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const settings = await res.json();
        backendSettings = settings;

        if (settings.enabled === false) {
            hideBinanceTile();
            return;
        }

        // Cache limits and currency on the tile's dataset for later validation.
        tile.dataset.minDeposit = settings.minDeposit ?? 1;
        tile.dataset.maxDeposit = settings.maxDeposit ?? 10000;
        tile.dataset.currency = settings.currency || getDefaultCurrency(settings);
    } catch (error) {
        console.error('[Binance Pay] Failed to load settings:', error);
        // Fall back to a sane currency; the backend will re-validate at
        // deposit-creation time. Never default to 'USD' — the backend's
        // SUPPORTED_CURRENCIES is currently ['USDT'].
        if (tile) tile.dataset.currency = 'USDT';
    }
}

/**
 * Returns the first supported currency from the settings response, or 'USDT'
 * as a fallback. The backend rejects anything outside SUPPORTED_CURRENCIES,
 * so 'USD' would 400 at deposit creation — never default to it.
 */
function getDefaultCurrency(settings) {
    if (Array.isArray(settings?.supportedCurrencies) && settings.supportedCurrencies.length > 0) {
        return settings.supportedCurrencies[0];
    }
    return 'USDT';
}

function hideBinanceTile() {
    const tiles = document.querySelectorAll('.payment-tile');
    for (var i = 0; i < tiles.length; i++) {
        var radio = tiles[i].querySelector('input[value="binance"]');
        if (radio) tiles[i].style.display = 'none';
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
    const currency = tile?.dataset.currency || 'USDT';
    const total = amount + bonus;

    setText('binance-deposit-amount', formatMoney(amount, currency));
    setText('binance-bonus-amount', '+' + formatMoney(bonus, currency));
    setText('binance-total-credited', formatMoney(total, currency));
    setText('binance-currency', currency);
}

function formatMoney(amount, currency) {
    const value = (amount || 0).toFixed(2);
    if (currency === 'USD') return '$' + value;
    // For non-USD codes (USDT, BUSD, EUR, etc.) append the ISO 4217-style code
    // since stablecoins don't have a $ symbol and we'd otherwise render a
    // naked number that's easy to misread.
    return value + ' ' + currency;
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
    const minD = parseFloat(tile?.dataset.minDeposit || '1');
    const maxD = parseFloat(tile?.dataset.maxDeposit || '10000');
    const currency = tile?.dataset.currency || 'USDT';

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
            // Send amount as a string so the backend's BigInt-aware
            // normalizeAmount() in src/utils/amount.js can parse it
            // exactly without floating-point rounding surprises.
            body: JSON.stringify({ amount: String(amount), currency })
        });

        // unwrapResponse throws on non-2xx with the backend's error message.
        const data = await unwrapResponse(res);

        if (!data?.depositId || !data?.merchantTradeNo) {
            throw new Error('Backend response was missing depositId or merchantTradeNo.');
        }

        currentDepositId = data.depositId;            // Firebase-side ID — used for all subsequent API calls
        currentReference = data.merchantTradeNo;      // Binance-side order ID — human-readable, shown to user
        depositCreated = true;

        renderCheckoutDetails(data);
        enableWhatsAppButton(currentReference, amount, currency);
        lockAmountField();

        notify('Deposit initiated. Please complete payment via Binance.', 'success');

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

    // Checkout URL + QR live under data.checkout (not flat at the top level).
    const checkout = data?.checkout || {};

    const linkBtn = document.getElementById('binance-payment-link');
    if (linkBtn && checkout.checkoutUrl) {
        try {
            const parsedUrl = new URL(checkout.checkoutUrl);
            if (parsedUrl.protocol === 'https:') {
                linkBtn.href = checkout.checkoutUrl;
                linkBtn.style.display = 'flex';
            } else {
                console.warn('[Binance Pay] Refusing non-https checkout URL.');
            }
        } catch (_) {
            console.warn('[Binance Pay] Invalid checkout URL returned by backend.');
        }
    }

    const wrapper = document.getElementById('binance-qr-wrapper');
    if (wrapper && checkout.qrCodeUrl) {
        wrapper.innerHTML = `
            <img src="${escapeAttr(checkout.qrCodeUrl)}" alt="Binance Pay QR Code" id="binance-qr-img">
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
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
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

    pollTimer = setInterval(pollDepositStatus, BinancePayConfig.defaults.pollInterval);
}

async function pollDepositStatus() {
    if (!currentDepositId) {
        clearInterval(pollTimer);
        pollTimer = null;
        return;
    }

    // Stop polling after the configured max duration. The backend's
    // ORDER_EXPIRATION_MINUTES is the source of truth for how long the
    // Binance order stays payable; defaults.maxPollDuration should be set
    // >= that value (30 minutes by default — set in binance-pay-config.js).
    if (Date.now() - pollStartTime > BinancePayConfig.defaults.maxPollDuration) {
        clearInterval(pollTimer);
        pollTimer = null;
        notify('Payment verification timed out. Please contact support if you have paid.', 'info');
        return;
    }

    // If the user logged out mid-poll, stop instead of spamming TypeErrors
    // every interval when firebaseAuth.currentUser is null.
    if (!firebaseAuth?.currentUser) {
        clearInterval(pollTimer);
        pollTimer = null;
        notify('Your session expired. Please log in again to resume verification.', 'error');
        return;
    }

    let idToken;
    try {
        idToken = await firebaseAuth.currentUser.getIdToken();
    } catch (e) {
        console.warn('[Binance Pay] Failed to refresh ID token:', e);
        return;
    }

    // Hit POST /verify, NOT GET /:depositId — only the verify endpoint calls
    // Binance to check the actual payment status. GET just reads the local
    // Firebase cache and would return 'pending' forever even after payment.
    const statusUrl = BinancePayConfig.buildUrl(
        BinancePayConfig.endpoints.verifyDeposit,
        { depositId: currentDepositId }
    );
    if (!statusUrl) {
        console.error('[Binance Pay] Could not build verify URL.');
        return;
    }

    try {
        const res = await fetch(statusUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            }
        });

        // The verify endpoint returns 503 VERIFICATION_UNAVAILABLE when the
        // Binance order IS paid but the wallet-credit integration is disabled
        // (WALLET_CREDIT_ENABLED=false). It can also return 503 when Binance
        // Pay itself is disabled mid-flight. Either way, we cannot auto-resolve
        // — surface the issue to the user and stop polling.
        if (res.status === 503) {
            const body = await res.json().catch(() => ({}));
            const code = body?.error?.code || '';
            if (code === 'VERIFICATION_UNAVAILABLE' || code === 'VERIFY_ERROR') {
                clearInterval(pollTimer);
                pollTimer = null;
                notify('Payment verification is unavailable. Please contact support with your deposit reference to confirm payment.', 'info');
                window.dispatchEvent(new CustomEvent('binancePay:paidPendingCredit', {
                    detail: { depositId: currentDepositId, reference: currentReference }
                }));
                return;
            }
            // Other 503s (DEPOSITS_DISABLED, BINANCE_PAY_DISABLED) — system
            // may recover; keep polling.
            return;
        }

        if (!res.ok) {
            console.warn(`[Binance Pay] Verify returned HTTP ${res.status}`);
            return;
        }

        const data = await unwrapResponse(res);
        handleStatusUpdate(data?.status);
    } catch (error) {
        console.warn('[Binance Pay] Polling error:', error);
        // Transient network errors — keep polling on the next interval.
    }
}

function handleStatusUpdate(status) {
    switch (status) {
        case 'credited':
            clearInterval(pollTimer);
            pollTimer = null;
            notify('Payment confirmed! Your wallet has been credited.', 'success');
            window.dispatchEvent(new CustomEvent('binancePay:credited'));
            break;
        case 'expired':
        case 'cancelled':
        case 'failed':
            clearInterval(pollTimer);
            pollTimer = null;
            notify(`Deposit ${status}.`, 'error');
            invalidateDeposit();
            break;
        case 'review_required':
            clearInterval(pollTimer);
            pollTimer = null;
            notify('Payment requires manual review. Please contact support.', 'error');
            break;
        case 'refund_pending':
        case 'refunded':
            clearInterval(pollTimer);
            pollTimer = null;
            notify(`Deposit status: ${status}. Please contact support.`, 'info');
            break;
        case 'pending':
        case 'creating':
        default:
            // Still in flight — keep polling silently.
            break;
    }
}

/* ═══════════════════════════════════════
   WHATSAPP & UTILITIES
   ═══════════════════════════════════════ */
function enableWhatsAppButton(reference, amount, currency) {
    // TODO: make the WhatsApp number dynamic from backend settings once the
    // /settings endpoint exposes a `supportWhatsApp` field. For now, fall
    // back to the existing hardcoded number.
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
    // Event delegation on document — the enlarge button is dynamically
    // rendered when a deposit is created, so we can't bind to it directly
    // at init time. Listeners are guarded by `listenersBound` upstream so
    // this only registers once per page load.
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
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('binance-qr-modal')?.classList.remove('active');
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('binance-qr-modal')?.classList.remove('active');
        }
    });
}

function setupCopyButtons() {
    // Same event-delegation pattern as setupQrEnlarge — see comment there.
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
        navigator.clipboard.writeText(text)
            .then(() => showCopied(btn))
            .catch(() => fallbackCopy(text, btn));
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
    el.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:${bg};color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;z-index:9999;transition:opacity 0.3s ease;`;
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
