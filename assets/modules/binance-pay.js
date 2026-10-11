/**
 * SMMMARIA Panel — Binance Pay Manual Deposit Logic
 * ES Module Version
 */
import { BinancePayConfig } from './binance-pay-config.js';

var depositCreated = false;
var currentReference = null;
var currentAmount = 0;
var currentBonus = 0;

export function initBinancePay() {
    if (!BinancePayConfig) {
        console.error('[Binance Pay] binance-pay-config.js not loaded.');
        return;
    }

    if (!BinancePayConfig.isEnabled()) {
        console.log('[Binance Pay] Disabled in config. Hiding tile.');
        hideBinanceTile();
        return;
    }

    setupPaymentMethodToggle();
    setupAmountListener();
    setupFormSubmission();
    setupQrEnlarge();
    setupCopyButtons();
    renderBinanceContent();
}

function setupPaymentMethodToggle() {
    var binanceRadio = document.querySelector('input[name="payment-method"][value="binance"]');
    if (!binanceRadio) return;

    binanceRadio.addEventListener('change', function () {
        if (this.checked) showBinanceFields();
    });

    var allRadios = document.querySelectorAll('input[name="payment-method"]');
    for (var i = 0; i < allRadios.length; i++) {
        (function (radio) {
            if (radio.value !== 'binance') {
                radio.addEventListener('change', function () {
                    if (this.checked) hideBinanceFields();
                });
            }
        })(allRadios[i]);
    }
}

function showBinanceFields() {
    var fields = document.getElementById('binance-fields');
    if (fields) fields.style.display = 'block';
    updateAmountDisplay();
}

function hideBinanceFields() {
    var fields = document.getElementById('binance-fields');
    if (fields) fields.style.display = 'none';
}

function hideBinanceTile() {
    var tiles = document.querySelectorAll('.payment-tile');
    for (var i = 0; i < tiles.length; i++) {
        var radio = tiles[i].querySelector('input[value="binance"]');
        if (radio) tiles[i].style.display = 'none';
    }
}

function setupAmountListener() {
    var amountInput = document.getElementById('deposit-amount');
    if (!amountInput) return;

    amountInput.addEventListener('input', function () {
        updateAmountDisplay();
        if (depositCreated) invalidateDeposit();
    });
}

function updateAmountDisplay() {
    var amountInput = document.getElementById('deposit-amount');
    if (!amountInput) return;

    var amount = parseFloat(amountInput.value) || 0;
    currentAmount = amount;

    var bonus = 0;
    var bonusInfo = document.getElementById('bonus-info');
    if (bonusInfo) {
        var match = bonusInfo.textContent.match(/\+\$?([\d.]+)/);
        if (match) bonus = parseFloat(match[1]) || 0;
    }
    currentBonus = bonus;

    var currency = BinancePayConfig.get('currency') || 'USD';
    var total = amount + bonus;

    setText('binance-deposit-amount', formatMoney(amount, currency));
    setText('binance-bonus-amount', '+' + formatMoney(bonus, currency));
    setText('binance-total-credited', formatMoney(total, currency));
    setText('binance-currency', currency);
}

function formatMoney(amount, currency) {
    var symbol = currency === 'USD' ? '$' : '';
    return symbol + (amount || 0).toFixed(2);
}

function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setupFormSubmission() {
    var form = document.getElementById('deposit-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
        var selected = document.querySelector('input[name="payment-method"]:checked');
        if (!selected || selected.value !== 'binance') return;

        e.preventDefault();
        e.stopPropagation();
        handleBinanceDeposit();
    }, true);
}

function handleBinanceDeposit() {
    var amountInput = document.getElementById('deposit-amount');
    var amount = parseFloat(amountInput.value) || 0;

    var minD = BinancePayConfig.get('minDeposit') || 1;
    var maxD = BinancePayConfig.get('maxDeposit') || 10000;
    var currency = BinancePayConfig.get('currency') || 'USD';

    if (amount < minD) {
        notify('Minimum Binance Pay deposit is ' + formatMoney(minD, currency), 'error');
        return;
    }
    if (amount > maxD) {
        notify('Maximum Binance Pay deposit is ' + formatMoney(maxD, currency), 'error');
        return;
    }

    var reference = generateReference();

    createDepositRecord(reference, amount)
        .then(function (result) {
            currentReference = (result && result.reference) ? result.reference : reference;
            depositCreated = true;

            displayReference(currentReference);
            enableWhatsAppButton(currentReference, amount, currency);
            lockAmountField();

            notify('Binance deposit initiated. Complete your payment and send the screenshot via WhatsApp.', 'success');

            var qrWrapper = document.getElementById('binance-qr-wrapper');
            if (qrWrapper) qrWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        })
        .catch(function (err) {
            console.error('[Binance Pay] createDepositRecord error:', err);
            currentReference = reference;
            depositCreated = true;
            displayReference(currentReference);
            enableWhatsAppButton(currentReference, amount, currency);
            notify('Deposit reference generated. Please complete your payment.', 'info');
        });
}

function generateReference() {
    var ts = Date.now().toString(36).toUpperCase();
    var rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return 'SMARIA-BIN-' + ts + '-' + rand;
}

function createDepositRecord(reference, amount) {
    var payload = {
        reference: reference,
        amount: amount,
        currency: BinancePayConfig.get('currency'),
        paymentMethod: 'binance',
        cryptoType: BinancePayConfig.get('cryptoType') || null,
        network: BinancePayConfig.get('network') || null,
        recipientId: BinancePayConfig.get('recipientId') || null,
        status: 'pending',
        timestamp: new Date().toISOString()
    };

    return fetch('/api/deposits/binance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    }).catch(function (err) {
        console.warn('[Binance Pay] Backend API not reachable, using client-side reference:', err.message);
        return { reference: reference, status: 'pending', id: null };
    });
}

function displayReference(ref) {
    setText('binance-deposit-reference', ref);
    var copyBtn = document.getElementById('binance-copy-ref-btn');
    if (copyBtn) copyBtn.style.display = 'inline-block';
    var pending = document.getElementById('binance-reference-pending');
    if (pending) pending.style.display = 'none';
}

function enableWhatsAppButton(reference, amount, currency) {
    var phone = BinancePayConfig.get('whatsappNumber') || '256770898186';
    var msg = buildWhatsAppMessage(reference, amount, currency);
    var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);

    var btn = document.getElementById('binance-whatsapp-btn');
    if (btn) {
        btn.href = url;
        btn.classList.remove('disabled');
    }
}

function buildWhatsAppMessage(reference, amount, currency) {
    var cryptoType = BinancePayConfig.get('cryptoType');
    var network = BinancePayConfig.get('network');
    var formatted = formatMoney(amount, currency);

    var msg = 'Hello SMMARIA Support, I have completed a Binance Pay deposit.\n\n';
    msg += 'Deposit Reference: ' + reference + '\n';
    msg += 'Amount: ' + formatted;

    if (cryptoType) {
        msg += ' (' + cryptoType;
        if (network) msg += ' — ' + network;
        msg += ')';
    }

    msg += '\n\nI will send my payment screenshot for verification. Please confirm my deposit.';
    return msg;
}

function lockAmountField() {
    var input = document.getElementById('deposit-amount');
    if (input) {
        input.setAttribute('readonly', 'readonly');
        input.style.opacity = '0.7';
    }
}

function invalidateDeposit() {
    depositCreated = false;
    currentReference = null;

    setText('binance-deposit-reference', '—');

    var copyBtn = document.getElementById('binance-copy-ref-btn');
    if (copyBtn) copyBtn.style.display = 'none';

    var pending = document.getElementById('binance-reference-pending');
    if (pending) {
        pending.style.display = 'block';
        pending.textContent = 'Amount changed. Click "Process Deposit" to generate a new reference.';
    }

    var waBtn = document.getElementById('binance-whatsapp-btn');
    if (waBtn) {
        waBtn.href = '#';
        waBtn.classList.add('disabled');
    }

    var input = document.getElementById('deposit-amount');
    if (input) {
        input.removeAttribute('readonly');
        input.style.opacity = '';
    }
}

function renderBinanceContent() {
    renderQrCode();
    renderPaymentLink();
    renderRecipientInfo();
}

function renderQrCode() {
    var wrapper = document.getElementById('binance-qr-wrapper');
    if (!wrapper) return;

    if (BinancePayConfig.hasQrCode()) {
        var qrUrl = BinancePayConfig.get('qrCodeImage');
        wrapper.innerHTML =
            '<img src="' + escapeAttr(qrUrl) + '" alt="Binance Pay QR Code" id="binance-qr-img">' +
            '<button type="button" class="binance-qr-enlarge-btn" id="binance-qr-enlarge-trigger">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">' +
                    '<circle cx="11" cy="11" r="8"></circle>' +
                    '<line x1="21" y1="21" x2="16.65" y2="16.65"></line>' +
                    '<line x1="11" y1="8" x2="11" y2="14"></line>' +
                    '<line x1="8" y1="11" x2="14" y2="11"></line>' +
                '</svg>' +
                'Enlarge QR Code' +
            '</button>';
    } else {
        wrapper.innerHTML =
            '<div class="binance-qr-placeholder">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
                    '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>' +
                    '<circle cx="8.5" cy="8.5" r="1.5"></circle>' +
                    '<polyline points="21 15 16 10 5 21"></polyline>' +
                '</svg>' +
                '<span>No QR code has been uploaded yet.<br>Please contact admin.</span>' +
            '</div>';
    }
}

function renderPaymentLink() {
    var linkBtn = document.getElementById('binance-payment-link');
    var noLink = document.getElementById('binance-no-link');

    if (BinancePayConfig.hasPaymentLink()) {
        if (linkBtn) {
            linkBtn.href = BinancePayConfig.get('paymentLink');
            linkBtn.style.display = 'flex';
        }
        if (noLink) noLink.style.display = 'none';
    } else {
        if (linkBtn) linkBtn.style.display = 'none';
        if (noLink) noLink.style.display = 'block';
    }
}

function renderRecipientInfo() {
    var info = document.getElementById('binance-recipient-info');
    if (!info) return;

    var html = '';
    var name = BinancePayConfig.get('recipientName');
    var id = BinancePayConfig.get('recipientId');
    var crypto = BinancePayConfig.get('cryptoType');
    var net = BinancePayConfig.get('network');

    if (name) html += '<div>Recipient: <strong>' + escapeHtml(name) + '</strong></div>';
    if (id)   html += '<div>Binance Pay ID: <strong>' + escapeHtml(id) + '</strong></div>';
    if (crypto) {
        html += '<div>Currency: <strong>' + escapeHtml(crypto) + '</strong>';
        if (net) html += ' (Network: <strong>' + escapeHtml(net) + '</strong>)';
        html += '</div>';
    }

    info.innerHTML = html;
}

function setupQrEnlarge() {
    document.addEventListener('click', function (e) {
        if (e.target.closest('#binance-qr-enlarge-trigger')) {
            openQrModal();
        }
    });

    var closeBtn = document.getElementById('binance-qr-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeQrModal);

    var modal = document.getElementById('binance-qr-modal');
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeQrModal();
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeQrModal();
    });
}

function openQrModal() {
    var modal = document.getElementById('binance-qr-modal');
    var img = document.getElementById('binance-qr-modal-img');
    if (!modal || !BinancePayConfig.hasQrCode()) return;

    if (img) img.src = BinancePayConfig.get('qrCodeImage');
    modal.classList.add('active');
}

function closeQrModal() {
    var modal = document.getElementById('binance-qr-modal');
    if (modal) modal.classList.remove('active');
}

function setupCopyButtons() {
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('#binance-copy-ref-btn');
        if (btn) copyToClipboard(currentReference || '', btn);
    });
}

function copyToClipboard(text, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
            showCopied(btn);
        }).catch(function () {
            fallbackCopy(text, btn);
        });
    } else {
        fallbackCopy(text, btn);
    }
}

function fallbackCopy(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showCopied(btn); }
    catch (e) { console.warn('[Binance Pay] Copy failed'); }
    document.body.removeChild(ta);
}

function showCopied(btn) {
    if (!btn) return;
    var original = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(function () {
        btn.textContent = original;
        btn.classList.remove('copied');
    }, 2000);
}

function notify(message, type) {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }

    var bg = type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6';
    var el = document.createElement('div');
    el.style.cssText =
        'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
        'background:' + bg + ';color:#fff;padding:12px 24px;border-radius:10px;' +
        'font-size:14px;font-weight:500;z-index:9999;max-width:90vw;' +
        'text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.2);' +
        'transition:opacity .3s;';
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(function () {
        el.style.opacity = '0';
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 4500);
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Export Admin API for use in app.js or admin panels
export const BinancePayAdmin = {
    getPendingDeposits: function () {
        return fetch('/api/admin/deposits/binance?status=pending', { credentials: 'include' })
            .then(function (r) { return r.json(); });
    },
    approveDeposit: function (depositId) {
        return fetch('/api/admin/deposits/' + depositId + '/approve', {
            method: 'POST',
            credentials: 'include'
        }).then(function (r) { return r.json(); });
    },
    rejectDeposit: function (depositId, reason) {
        return fetch('/api/admin/deposits/' + depositId + '/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ reason: reason })
        }).then(function (r) { return r.json(); });
    },
    updateSettings: function (newSettings) {
        return BinancePayConfig.update(newSettings);
    },
    getSettings: function () {
        return BinancePayConfig.getAll();
    }
};