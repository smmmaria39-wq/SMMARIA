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
   } else {
    tbody.innerHTML = currentTransactions.map(tx => {
     return `
                    <tr>
                        <td>#${tx.id.substring(0, 8)}</td>
                        <td>${tx.type}</td>
                        <td class="${tx.type === 'deposit' || tx.type === 'refund' ? 'text-success' : 'text-danger'}">
                          ${tx.type === 'deposit' || tx.type === 'refund' ? '+' : '-'}${formatCurrency(tx.amount)}
                        </td>
                        <td>${formatDate(tx.date)}</td>
                        <td><span class="badge badge--${tx.status === 'approved' ? 'success' : 'warning'}">${tx.status}</span></td>
                    </tr>
                `;
    }).join('');
   }
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
    callback_url: $('#deposit-callback')?.value || 'https://smmaria.netlify.app/api/v1/payments/webhook'
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
   } else if (method === 'card') {
    payload.cardNumber = $('#card-number')?.value;
    payload.cardExpiry = $('#card-expiry')?.value;
    payload.cardCvv = $('#card-cvv')?.value;
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