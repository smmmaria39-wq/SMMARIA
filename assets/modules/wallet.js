// ===============================================
// Wallet Module
// ===============================================

import { api } from '../utils/api.js';
import { $ } from '../utils/helpers.js';
import { formatCurrency } from '../modules/currency.js';
import { formatDate } from '../utils/formatter.js';
import { showToast } from '../components/toast.js';

let currentBalance = 0;
let currentTransactions = [];

// Helper to format Ugandan phone numbers to 2567XXXXXXXX
function formatUgPhone(phone) {
 if (!phone) return '';
 phone = phone.replace(/\s+/g, '').replace(/^\+/, '');
 if (phone.startsWith('256')) return phone;
 if (phone.startsWith('0')) return '256' + phone.substring(1);
 return phone;
}

export default async function initWallet() {
 const balanceEl = $('.balance-card__amount');
 const tbody = $('.transactions-card tbody');
 
 // Fetch user profile to get email (Required by WearAmaze)
 let userEmail = 'guest@smmmaria.com'; // Fallback
 try {
  const meRes = await api.getMe();
  if (meRes.data && meRes.data.email) userEmail = meRes.data.email;
 } catch (e) {
  console.warn('Could not fetch user email for payment gateway.');
 }
 
 try {
  // Fetch real wallet data
  const [response] = await Promise.all([
   api.getWallet()
  ]);
  
  const walletData = response.data;
  currentBalance = walletData.balance || 0;
  currentTransactions = walletData.transactions || [];
  
  updateWalletUI();
  
 } catch (error) {
  if (balanceEl) balanceEl.textContent = formatCurrency(0);
  if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load wallet data.</td></tr>`;
 }
 
 function updateWalletUI() {
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

   tbody.innerHTML = html;
  }
 }
 
 // Listen for currency changes to re-render wallet balance and transactions
 window.addEventListener('currencyChanged', updateWalletUI);
 
 // 3. Handle Inline Deposit Form & Dynamic Fields
 const depositForm = $('#deposit-form');
 if (depositForm) {
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
    
    // If manual is selected, ensure the WhatsApp link is up to date
    if (selectedMethod === 'manual') {
     updateManualWhatsappLink();
    }
   });
  });
  
    // Check for pending deposits and show Cancel button
  let pendingPollInterval = null; // Declare this at the top of your initWallet function or outside it
  
  const checkPendingAndShowCancel = async () => {
   try {
    const res = await api.getPayments();
    const userPayments = res.data || [];
    
    const hasPending = userPayments.some(p =>
     p.status === 'pending' &&
     (p.method === 'mtn' || p.method === 'airtel')
    );
    
    if (hasPending) {
     // Show cancel button if it doesn't exist
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
        await api.cancelPendingDeposit();
        showToast('Pending deposit cancelled. You can try again now.', 'success');
        cancelBtn.remove();
        if (pendingPollInterval) clearInterval(pendingPollInterval); // Stop polling
        initWallet(); // Refresh UI
       } catch (err) {
        showToast(err.message || 'Failed to cancel deposit.', 'error');
        cancelBtn.disabled = false;
        cancelBtn.innerText = 'Cancel Pending Deposit';
       }
      };
      depositForm.appendChild(cancelBtn);
     }
     
     // START POLLING: If there's a pending payment, check every 10 seconds if it was approved
     if (!pendingPollInterval) {
      pendingPollInterval = setInterval(async () => {
       try {
        const pollRes = await api.getPayments();
        const stillPending = (pollRes.data || []).some(p =>
         p.status === 'pending' && (p.method === 'mtn' || p.method === 'airtel')
        );
        
        // If the payment is no longer pending, it means it was successful (or rejected/cancelled)
        if (!stillPending) {
         clearInterval(pendingPollInterval);
         pendingPollInterval = null;
         
         const btn = document.getElementById('cancelPendingBtn');
         if (btn) btn.remove();
         
         showToast('Deposit successful! Your wallet has been updated.', 'success');
         initWallet(); // Reload wallet balance and UI
        }
       } catch (e) {
        console.error('Polling error:', e);
       }
      }, 10000); // 10 seconds
     }
     
    } else {
     // If no pending payment, remove the button and stop polling
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
  };
  
  checkPendingAndShowCancel();
  
  // 4. Handle Form Submission
  depositForm.addEventListener('submit', async (e) => {
   e.preventDefault();
   
   const submitBtn = depositForm.querySelector('button[type="submit"]');
   if (!submitBtn) return;
   
   // Prevent double-clicking by disabling button instantly
   if (submitBtn.disabled) return;
   const originalBtnText = submitBtn.innerHTML;
   submitBtn.disabled = true;
   submitBtn.innerHTML = 'Processing...';
   
   const amount = parseFloat(amountInput.value);
   const selectedMethodInput = depositForm.querySelector('input[name="payment-method"]:checked');
   
   // Validation checks (re-enable button if validation fails)
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
   
  // ===============================================
  // MARZPAY CARD PAYMENT INTERCEPTION (BOTTOM SHEET)
  // ===============================================
  if (method === 'card') {
   submitBtn.disabled = false;
   submitBtn.innerHTML = originalBtnText;
   
   const sheet = document.getElementById('cardPaymentSheet');
   const sheetAmount = document.getElementById('cardSheetAmount');
   const confirmBtn = document.getElementById('confirmCardPayBtn');
   const cancelBtn = document.getElementById('cancelCardPayBtn');
   
   if (sheet && confirmBtn) {
    
    // Update amount
    sheetAmount.textContent = formatCurrency(amount);
    
    // Show sheet
    sheet.style.display = 'flex';
    
    // Trigger CSS transition
    requestAnimationFrame(() => {
     sheet.classList.add('active');
    });
    
    // Close function
    const closeSheet = () => {
     sheet.classList.remove('active');
     
     setTimeout(() => {
      sheet.style.display = 'none';
     }, 200);
     
     confirmBtn.disabled = false;
     confirmBtn.innerText = 'Continue to Secure Checkout';
    };
    
    // Cancel button
    if (cancelBtn) {
     cancelBtn.onclick = closeSheet;
    }
    
    // Click outside
    sheet.onclick = (e) => {
     if (e.target === sheet) {
      closeSheet();
     }
    };
    
    // Continue to MarzPay
    confirmBtn.onclick = async () => {
     
     if (confirmBtn.disabled) return;
     
     confirmBtn.disabled = true;
     confirmBtn.innerText = 'Redirecting to secure checkout...';
     
     try {
      
      const res = await api.createDeposit({
       amount,
       method: 'card',
       email: userEmail
      });
      
      if (res?.data?.redirect_url) {
       window.location.href = res.data.redirect_url;
       return;
      }
      
      throw new Error('Redirect URL not received from server.');
      
     } catch (error) {
      
      showToast(
       error.message || 'Failed to initiate card payment.',
       'error'
      );
      
      confirmBtn.disabled = false;
      confirmBtn.innerText = 'Continue to Secure Checkout';
     }
    };
   }
   
   return;
  }
   
   // Show processing message INSTANTLY so you know the click worked
   showToast('Processing deposit request...', 'info');
   
     // Base payload with hidden fields and required email
   let payload = {
    amount,
    method,
    email: userEmail,
    country: $('#deposit-country')?.value || 'UG',
    reference: ($('#deposit-reference')?.value || 'SMMMARIA-DEPOSIT') + '-' + Date.now(),
    description: $('#deposit-description')?.value || 'Wallet Deposit',
    callback_url: $('#deposit-callback')?.value || 'https://smmmaria-backend-production.up.railway.app/api/v1/payments/webhook'
   };
   
   // Gather dynamic field data based on selection
   if (method === 'mtn') {
    payload.phoneNumber = formatUgPhone($('#mtn-phone')?.value);
    if (!payload.phoneNumber || payload.phoneNumber.length < 12) {
     showToast('Enter a valid MTN number (e.g., 07XXXXXXXX)', 'error');
     submitBtn.disabled = false;
     submitBtn.innerHTML = originalBtnText;
     return;
    }
   } else if (method === 'airtel') {
    payload.phoneNumber = formatUgPhone($('#airtel-phone')?.value);
    if (!payload.phoneNumber || payload.phoneNumber.length < 12) {
     showToast('Enter a valid Airtel number (e.g., 07XXXXXXXX)', 'error');
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
    
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
    
    initWallet(); // Reload wallet data
   } catch (error) {
    showToast(error.message || 'Failed to submit deposit. Please try again.', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
   }
  });
 }
} 
