// ===============================================
// Buy Child Panel Module
// ===============================================

import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';
import { formatCurrency } from '../modules/currency.js';
import { generateUUID } from '../utils/helpers.js';

let userBalance = 0;
let selectedPlan = null;
let selectedPrice = 0;
let buyPanelInitialized = false;
let currentIdempotencyKey = generateUUID(); // FIX: Idempotency for purchase

export default async function initBuyChildPanel() {
  // FIX: Guard against duplicate event listeners
  if (buyPanelInitialized) return;
  buyPanelInitialized = true;

  const formCard = document.getElementById('setup-form-card');
  const planNameSpan = document.getElementById('selected-plan-name');
  const displayPrice = document.getElementById('display-price');
  const displayBalance = document.getElementById('display-balance');
  const subdomainInput = document.getElementById('subdomain');
  const subdomainPreview = document.getElementById('subdomain-preview');
  const form = document.getElementById('create-panel-form');
  const selectButtons = document.querySelectorAll('.select-plan-btn');
  
  if (!formCard) return;
  
  // 1. Fetch User Wallet Balance
  try {
    const response = await api.getMe();
    userBalance = response.data?.balance || 0;
  } catch (error) {
    console.error('Failed to fetch user balance:', error);
    showToast('Could not fetch wallet balance', 'error');
  }
  
  const updateBuyPanelUI = () => {
    if (displayBalance) displayBalance.textContent = formatCurrency(userBalance);
    if (selectedPlan && displayPrice) displayPrice.textContent = formatCurrency(selectedPrice);
  };
  
  updateBuyPanelUI();
  window.addEventListener('currencyChanged', updateBuyPanelUI);
  
  // 2. Handle Plan Selection
  selectButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedPlan = btn.dataset.plan;
      selectedPrice = parseFloat(btn.dataset.price);
      
      formCard.style.display = 'block';
      if (planNameSpan) planNameSpan.textContent = selectedPlan;
      updateBuyPanelUI();
      
      formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      form.dataset.selectedPlan = selectedPlan;
      form.dataset.selectedPrice = selectedPrice;
      
      // FIX: Regenerate idempotency key when a new plan is selected
      currentIdempotencyKey = generateUUID();
    });
  });
  
  // 3. Live Subdomain Preview
  if (subdomainInput && subdomainPreview) {
    subdomainInput.addEventListener('input', (e) => {
      // Sanitize input to lowercase and remove spaces/special chars
      let value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      e.target.value = value;
      subdomainPreview.textContent = `${value || 'yourname'}.smmaria.site`;
      
      // FIX: Regenerate key if subdomain changes, as this is a new logical panel request
      currentIdempotencyKey = generateUUID();
    });
  }
  
  // 4. Handle Form Submission (Purchase)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const plan = form.dataset.selectedPlan;
      const price = parseFloat(form.dataset.selectedPrice);
      const panelName = document.getElementById('panelName').value.trim();
      const adminUsername = document.getElementById('adminUsername').value.trim();
      const adminPassword = document.getElementById('adminPassword').value;
      const subdomain = subdomainInput.value.trim();
      
      if (!plan || !price || !panelName || !adminUsername || !adminPassword || !subdomain) {
        return showToast('Please fill in all fields', 'error');
      }
      
      if (userBalance < price) {
        return showToast(`Insufficient balance. You need ${formatCurrency(price)} but only have ${formatCurrency(userBalance)}.`, 'error');
      }
      
      const submitBtn = form.querySelector('button[type="submit"]');
      if (!submitBtn || submitBtn.disabled) return; // Prevent double-click
      
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Processing Payment...';
      
      try {
        const response = await api.purchaseChildPanel({
          plan,
          price,
          panelName,
          subdomain,
          adminUsername,
          adminPassword,
          idempotencyKey: currentIdempotencyKey // FIX: Send idempotency key
        });
        
        showToast('Payment successful! Your Child Panel is being provisioned...', 'success');
        
        setTimeout(() => {
          window.location.href = `resellers/login.html?success=true&panel=${subdomain}`;
        }, 2000);
        
      } catch (error) {
        console.error('Panel purchase failed:', error);
        showToast(error.message || 'Failed to purchase panel. Please try again.', 'error');
        // FIX: Do NOT regenerate key on failure. User can retry with the same key safely.
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
}
