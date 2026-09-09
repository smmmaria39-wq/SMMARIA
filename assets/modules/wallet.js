// ===============================================
// Wallet Module
// ===============================================

import { api } from '../utils/api.js';
import { $, generateUUID } from '../utils/helpers.js'; // ADDED: generateUUID
import { formatCurrency } from '../modules/currency.js';
import { formatDate } from '../utils/formatter.js';
import { showToast } from '../components/toast.js';

// FIX: Module-scoped state to prevent duplication
let currentBalance = 0;
let currentTransactions = [];
let pendingPollInterval = null;
let walletInitialized = false;
let userEmail = 'guest@smmmaria.com'; // Fallback

// Helper to format Ugandan phone numbers to 2567XXXXXXXX
function formatUgPhone(phone) {
  if (!phone) return '';
  phone = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (phone.startsWith('256')) return phone;
  if (phone.startsWith('0')) return '256' + phone.substring(1);
  return phone;
}

export default async function initWallet() {
  // FIX: Initialization guard. Only attach listeners once.
  if (walletInitialized) {
    return refreshWallet();
  }
  walletInitialized = true;

  // Fetch user profile to get email (Required by WearAmaze)
  try {
    const meRes = await api.getMe();
    if (meRes.data && meRes.data.email) userEmail = meRes.data.email;
  } catch (e) {
    console.warn('Could not fetch user email for payment gateway.');
  }

  // Initial data fetch
  await refreshWallet();

  // Listen for currency changes (Attached once)
  window.addEventListener('currencyChanged', updateWalletUI);

  // Setup Deposit Form Listeners (Attached once)
  setupDepositForm();
  
  // Start pending check loop
  checkPendingAndShowCancel();
}

// FIX: Separate function to fetch and update data
async function refreshWallet() {
  const balanceEl = $('.balance-card__amount');
  const tbody = $('.transactions-card tbody');
  
  try {
    // Fetch real wallet data
    const response = await api.getWallet();
    const walletData = response.data;
    currentBalance = walletData.balance || 0;
    currentTransactions = walletData.transactions || [];
    updateWalletUI();
  } catch (error) {
    if (balanceEl) balanceEl.textContent = formatCurrency(0);
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load wallet data.</td></tr>`;
  }
}

function updateWalletUI() {
  const balanceEl = $('.balance-card__amount');
  const tbody = $('.transactions-card tbody');
  
  if (balanceEl) {
    balanceEl.textContent = formatCurrency(currentBalance);
  }
  
  if (tbody) {
    if (!currentTransactions || currentTransactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No transactions yet. Click Add Funds to make your first deposit!</td></tr>`;
      return;
    }

    // FIX: Sort transactions by date descending (Newest first)
    const sortedTx = [...currentTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
   
    // Helper to determine date category
    const getCategory = (dateStr) => {
      const date = new Date(dateStr);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date >= today) return "Today";
      if (date >= yesterday) return "Yesterday";
      if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) return "This Month";
      return "Older";
    };
   
    let html = '';
    let lastCategory = '';
   
    // Determine if we are showing all or just today
    const isViewingAll = window.viewAllWalletTx || false;
    const displayTx = isViewingAll ? sortedTx : sortedTx.filter(tx => getCategory(tx.date) === "Today");
   
    if (displayTx.length === 0) {
      if (!isViewingAll) {
        html += `<tr style="background: var(--bg-body);"><td colspan="5" style="font-weight: 700; padding: 10px 15px; color: var(--text-secondary); text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">Today</td></tr>`;
        html += `<tr><td colspan="5" class="text-center text-muted" style="padding: 15px;">No transactions done today.</td></tr>`;
      } else {
        html += `<tr><td colspan="5" class="text-center text-muted" style="padding: 15px;">No transactions found.</td></tr>`;
      }
    } else {
      displayTx.forEach(tx => {
        const category = getCategory(tx.date);
        // Only add category headers if viewing all, or if it's the "Today" header
        if (isViewingAll || category === "Today") {
          if (category !== lastCategory) {
            html += `<tr style="background: var(--bg-body);"><td colspan="5" style="font-weight: 700; padding: 10px 15px; color: var(--text-secondary); text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">${category}</td></tr>`;
            lastCategory = category;
          }
        }
        
        // Fix badge logic to handle new backend statuses (completed, processing, cancelled, etc.)
        let badgeClass = 'badge--warning';
        if (tx.status === 'approved' || tx.status === 'completed') badgeClass = 'badge--success';
        else if (tx.status === 'rejected' || tx.status === 'cancelled') badgeClass = 'badge--danger';
        
        // Add the transaction row
        html += `
          <tr>
            <td>#${tx.id.substring(0, 8)}</td>
            <td>${tx.type}</td>
            <td class="${tx.type === 'deposit' || tx.type === 'refund' ? 'text-success' : 'text-danger'}">
              ${tx.type === 'deposit' || tx.type === 'refund' ? '+' : '-'}${formatCurrency(tx.amount)}
            </td>
            <td>${formatDate(tx.date)}</td>
            <td><span class="badge ${badgeClass}">${tx.status}</span></td>
          </tr>
        `;
      });
    }
   
    // Inject the toggle button at the bottom of the table
    html += `<tr><td colspan="5" style="text-align: center; padding: 15px; border-top: 2px solid var(--border-color);">`;
    if (!isViewingAll) {
      html += `<button id="viewAllTxBtn" class="btn btn--outline btn--sm">View all transactions</button>`;
    } else {
      html += `<button id="hideTxBtn" class="btn btn--outline btn--sm">Hide old transactions</button>`;
    }
    html += `</td></tr>`;
   
    // Render the HTML to the DOM
    tbody.innerHTML = html;
   
    // Attach event listeners to the injected buttons
    const viewBtn = document.getElementById('viewAllTxBtn');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        window.viewAllWalletTx = true;
        updateWalletUI(); // Re-render with all transactions
      });
    }
   
    const hideBtn = document.getElementById('hideTxBtn');
    if (hideBtn) {
      hideBtn.addEventListener('click', () => {
        window.viewAllWalletTx = false;
        updateWalletUI(); // Re-render with today only
      });
    }
  }
}

function setupDepositForm() {
  const depositForm = $('#deposit-form');
  if (!depositForm) return;

  const amountInput = $('#deposit-amount');
  const bonusInfo = $('#bonus-info');
  const manualWhatsappBtn = $('#manual-whatsapp-btn');
  const flatBonus = 0.05;
  
  // Helper function to update the WhatsApp link dynamically
  const updateManualWhatsappLink = () => {
    if (!manualWhatsappBtn || !amountInput) return;
    const amount = parseFloat(amountInput.value) || 0;
    const message = `Hello Admin, I want to deposit ${formatCurrency(amount)} to my SMMMARIA wallet. Here is my payment receipt.`;
    const encodedMessage = encodeURIComponent(message);
    manualWhatsappBtn.href = `https://wa.me/256770898186?text=${encodedMessage}`;
  };
  
  // Flat Bonus Calculation & WhatsApp Link Update
  const updateBonusInfo = () => {
    if (!amountInput || !bonusInfo) return;
    const amount = parseFloat(amountInput.value) || 0;
    const total = amount + flatBonus;
    bonusInfo.innerHTML = `Bonus: ${formatCurrency(flatBonus)} <span class="bonus-amount">Total Credited: ${formatCurrency(total)}</span>`;
    updateManualWhatsappLink();
  };
  
  if (amountInput && bonusInfo) {
    amountInput.addEventListener('input', updateBonusInfo);
  }
  
  // Dynamic Input Fields Toggle & UI Highlighting
  const paymentRadios = depositForm.querySelectorAll('input[name="payment-method"]');
  const dynamicFields = depositForm.querySelectorAll('.dynamic-fields');
  const paymentTiles = depositForm.querySelectorAll('.payment-tile');
  
  paymentRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const selectedMethod = e.target.value;
      dynamicFields.forEach(field => field.style.display = 'none');
      const targetField = document.getElementById(`${selectedMethod}-fields`);
      if (targetField) targetField.style.display = 'block';
      paymentTiles.forEach(tile => {
        const input = tile.querySelector('input');
        tile.classList.toggle('active', input.checked);
      });
      if (selectedMethod === 'manual') updateManualWhatsappLink();
    });
  });
  
  // 4. Handle Form Submission
  depositForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = depositForm.querySelector('button[type="submit"]');
    if (!submitBtn || submitBtn.disabled) return;
    
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Processing...';
    
    const amount = parseFloat(amountInput.value);
    const selectedMethodInput = depositForm.querySelector('input[name="payment-method"]:checked');
    
    if (!selectedMethodInput) {
      showToast('Please select a payment method', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      return;
    }
    if (!amount || amount <= 0) {
      showToast('Please enter a valid amount', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      return;
    }
    
    const method = selectedMethodInput.value;
    // FIX: Generate idempotency key once per submission attempt
    const idempotencyKey = generateUUID();
    
    if (method === 'card') {
      handleCardPayment(amount, idempotencyKey, submitBtn, originalBtnText);
      return;
    }
    
    showToast('Processing deposit request...', 'info');
    
    // FIX: Cleaned up payload to only send what the backend requires. Prevents "Validation failed".
    let payload = {
      amount,
      method,
      email: userEmail,
      idempotencyKey
    };
    
    if (method === 'mtn' || method === 'airtel') {
      payload.phoneNumber = formatUgPhone($(`#${method}-phone`)?.value);
      if (!payload.phoneNumber || payload.phoneNumber.length < 12) {
        showToast(`Enter a valid ${method.toUpperCase()} number (e.g., 07XXXXXXXX)`, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        return;
      }
    } else if (method === 'manual') {
      const fileInput = $('#manual-receipt');
      if (fileInput && fileInput.files.length > 0) {
        payload.receipt = fileInput.files[0].name;
      }
    }
    
    try {
      await api.createDeposit(payload);
      if (method === 'mtn' || method === 'airtel') {
        showToast('Request sent! A prompt will appear on your phone. Please enter your PIN to approve the deposit.', 'info');
      } else if (method === 'manual') {
        showToast('Deposit request created! Please click the WhatsApp button to send your receipt.', 'info');
      } else {
        showToast('Deposit request submitted successfully!', 'success');
      }
      
      depositForm.reset();
      dynamicFields.forEach(field => field.style.display = 'none');
      paymentTiles.forEach(tile => tile.classList.remove('active'));
      if (bonusInfo) {
        bonusInfo.innerHTML = `Bonus: ${formatCurrency(0)} <span class="bonus-amount">Total Credited: ${formatCurrency(0)}</span>`;
      }
      
      await refreshWallet();
      checkPendingAndShowCancel(); // Restart pending check immediately
    } catch (error) {
      showToast(error.message || 'Failed to submit deposit. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });
}

async function handleCardPayment(amount, idempotencyKey, submitBtn, originalBtnText) {
  submitBtn.disabled = false;
  submitBtn.innerHTML = originalBtnText;
  
  const sheet = document.getElementById('cardPaymentSheet');
  const sheetAmount = document.getElementById('cardSheetAmount');
  const confirmBtn = document.getElementById('confirmCardPayBtn');
  const cancelBtn = document.getElementById('cancelCardPayBtn');
  
  if (!sheet || !confirmBtn) return;
  
  sheetAmount.textContent = formatCurrency(amount);
  sheet.style.display = 'flex';
  requestAnimationFrame(() => sheet.classList.add('active'));
  
  const closeSheet = () => {
    sheet.classList.remove('active');
    setTimeout(() => sheet.style.display = 'none', 200);
    confirmBtn.disabled = false;
    confirmBtn.innerText = 'Continue to Secure Checkout';
  };
  
  cancelBtn.onclick = closeSheet;
  sheet.onclick = (e) => { if (e.target === sheet) closeSheet(); };
  
  // FIX: Reuse the same idempotencyKey if user clicks confirm multiple times due to network lag
  confirmBtn.onclick = async () => {
    if (confirmBtn.disabled) return;
    confirmBtn.disabled = true;
    confirmBtn.innerText = 'Redirecting to secure checkout...';
    
    try {
      const res = await api.createDeposit({ amount, method: 'card', email: userEmail, idempotencyKey });
      if (res?.data?.redirect_url) {
        window.location.href = res.data.redirect_url;
        return; // Stop execution on redirect
      }
      throw new Error('Redirect URL not received from server.');
    } catch (error) {
      showToast(error.message || 'Failed to initiate card payment.', 'error');
      // Re-enable button so user can retry with the SAME idempotencyKey
      confirmBtn.disabled = false;
      confirmBtn.innerText = 'Continue to Secure Checkout';
    }
  };
}

async function checkPendingAndShowCancel() {
  const depositForm = $('#deposit-form');
  if (!depositForm) return;
  
  try {
    const res = await api.getPayments();
    const userPayments = res.data || [];
    const hasPending = userPayments.some(p => p.status === 'pending' && (p.method === 'mtn' || p.method === 'airtel'));
    
    if (hasPending) {
      if (!document.getElementById('cancelPendingBtn')) {
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelPendingBtn';
        cancelBtn.className = 'btn btn--danger btn--block';
        cancelBtn.style.marginTop = '10px';
        cancelBtn.innerText = 'Cancel Pending Deposit';
        cancelBtn.onclick = async () => {
          cancelBtn.disabled = true;
          cancelBtn.innerText = 'Cancelling...';
          try {
            const res = await api.cancelPendingDeposit();
            showToast(res.message || 'Pending deposit cancelled.', 'success');
            cancelBtn.remove();
            if (pendingPollInterval) clearInterval(pendingPollInterval);
            await refreshWallet();
            checkPendingAndShowCancel();
          } catch (err) {
            showToast(err.message || 'Failed to cancel deposit.', 'error');
            // FIX: Force a re-check of pending deposits.
            // If the payment was already completed by the webhook, this will remove the button.
            await checkPendingAndShowCancel();
            if (document.getElementById('cancelPendingBtn')) {
              cancelBtn.disabled = false;
              cancelBtn.innerText = 'Cancel Pending Deposit';
            }
          }
        };
        depositForm.appendChild(cancelBtn);
      }
      
      if (!pendingPollInterval) {
        pendingPollInterval = setInterval(async () => {
          try {
            const pollRes = await api.getPayments();
            const stillPending = (pollRes.data || []).some(p => p.status === 'pending' && (p.method === 'mtn' || p.method === 'airtel'));
            if (!stillPending) {
              clearInterval(pendingPollInterval);
              pendingPollInterval = null;
              const btn = document.getElementById('cancelPendingBtn');
              if (btn) btn.remove();
              showToast('Deposit successful! Your wallet has been updated.', 'success');
              await refreshWallet();
            }
          } catch (e) {
            console.error('Polling error:', e);
          }
        }, 10000); // 10 seconds
      }
    } else {
      const existingCancelBtn = document.getElementById('cancelPendingBtn');
      if (existingCancelBtn) existingCancelBtn.remove();
      if (pendingPollInterval) {
        clearInterval(pendingPollInterval);
        pendingPollInterval = null;
      }
    }
  } catch (e) {
    console.error('Failed to check pending deposits');
  }
}
