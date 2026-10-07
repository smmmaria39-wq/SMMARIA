// ===============================================
// Orders Module (Enhanced with Modal & 72h Refill)
// ===============================================

import { api } from '../utils/api.js';
import { $ } from '../utils/helpers.js';
import { formatCurrency } from '../modules/currency.js';
import { formatDate } from '../utils/formatter.js';

let serviceMap = {};
let currentOrders = [];
let isOrdersInitialized = false;
let countdownInterval = null;

// Helper: Calculate Delivered Count
function calculateDelivered(order) {
  const quantity = order.quantity || 0;
  const remains = order.remains || 0;
  return Math.max(0, quantity - remains);
}

// Helper: Calculate Accurate Progress
function calculateOrderProgress(order) {
  if (order.status === 'completed') return 100;
  if (order.status === 'pending') return 0;
  
  const quantity = order.quantity || 0;
  if (quantity === 0) return 0;
  
  const delivered = calculateDelivered(order);
  let progress = (delivered / quantity) * 100;
  
  if (order.status === 'processing' || order.status === 'in_progress') {
    progress = Math.max(0, Math.min(99, progress));
  }
  
  return Math.max(0, Math.min(100, progress));
}

// Helper: 72-Hour Refill Eligibility
function getRefillAvailability(order) {
  if (!order.createdAt) return { eligible: false, msRemaining: Infinity, text: 'N/A' };
  
  const createdTime = new Date(order.createdAt).getTime();
  const refillAvailableAt = createdTime + (72 * 60 * 60 * 1000); // 72 hours
  const now = Date.now();
  
  if (now >= refillAvailableAt) {
    return { eligible: true, msRemaining: 0, text: 'Refill' };
  }
  
  const msRemaining = refillAvailableAt - now;
  const hours = Math.floor(msRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
  
  return { eligible: false, msRemaining, text: `Available in ${hours}h ${minutes}m` };
}

// Helper: Inject Order Details Modal (Only once)
function createOrderDetailsModal() {
  if (document.getElementById('orderDetailsModal')) return;
  
  const modal = document.createElement('div');
  modal.id = 'orderDetailsModal';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'orderModalTitle');
  
  modal.innerHTML = `
    <div class="modal" style="max-width: 500px; width: 90%;">
      <div class="modal__header">
        <h3 class="modal__title" id="orderModalTitle">Order Details</h3>
        <button class="modal__close" id="orderModalCloseBtn">&times;</button>
      </div>
      <div class="modal__body" id="orderModalBody" style="max-height: 70vh; overflow-y: auto;"></div>
      <div class="modal__footer" id="orderModalFooter" style="flex-direction: column; gap: 10px;"></div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Close listeners
  document.getElementById('orderModalCloseBtn').addEventListener('click', closeOrderDetails);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeOrderDetails();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('orderDetailsModal').style.display === 'flex') {
      closeOrderDetails();
    }
  });
}

function openOrderDetails(orderId) {
  const order = currentOrders.find(o => o.id === orderId);
  if (!order) return;
  
  const serviceData = serviceMap[order.serviceId] || { name: `ID: ${order.serviceId?.substring(0, 8)}`, supplierServiceId: 'N/A' };
  const progress = calculateOrderProgress(order);
  const delivered = calculateDelivered(order);
  const availability = getRefillAvailability(order);
  
  const body = document.getElementById('orderModalBody');
  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 12px;">
      <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
        <strong style="font-size: 14px; color: var(--text-secondary);">Order ID</strong><br>
        <span style="font-size: 16px; font-weight: 700;">#${order.id?.substring(0, 8) || 'N/A'}</span>
      </div>
      
      <div>
        <strong style="font-size: 14px; color: var(--text-secondary);">Service</strong><br>
        <span>${serviceData.name}</span>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>
          <strong style="font-size: 14px; color: var(--text-secondary);">Supplier ID</strong><br>
          <span>${serviceData.supplierServiceId || 'N/A'}</span>
        </div>
        <div>
          <strong style="font-size: 14px; color: var(--text-secondary);">Status</strong><br>
          <span class="badge badge--${order.status}">${order.status}</span>
        </div>
      </div>

      <div>
        <strong style="font-size: 14px; color: var(--text-secondary);">Target Link</strong><br>
        <a href="${order.link}" target="_blank" class="text-link" style="word-break: break-all;">${order.link || 'N/A'}</a>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>
          <strong style="font-size: 14px; color: var(--text-secondary);">Quantity</strong><br>
          <span>${order.quantity?.toLocaleString() || 0}</span>
        </div>
        <div>
          <strong style="font-size: 14px; color: var(--text-secondary);">Start Count</strong><br>
          <span>${order.start_count?.toLocaleString() || 'N/A'}</span>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>
          <strong style="font-size: 14px; color: var(--text-secondary);">Delivered</strong><br>
          <span class="text-success">${delivered.toLocaleString()}</span>
        </div>
        <div>
          <strong style="font-size: 14px; color: var(--text-secondary);">Remaining</strong><br>
          <span class="${(order.remains || 0) > 0 ? 'text-danger' : 'text-muted'}">${(order.remains || 0).toLocaleString()}</span>
        </div>
      </div>

      <div>
        <strong style="font-size: 14px; color: var(--text-secondary);">Progress</strong>
        <div class="progress-bar" style="margin-top: 5px;">
          <div class="progress-bar__fill" style="width: ${progress.toFixed(0)}%;"></div>
        </div>
        <small style="display: block; margin-top: 4px; text-align: right;">${progress.toFixed(0)}% Complete</small>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; border-top: 1px solid var(--border-color); padding-top: 12px;">
        <div>
          <strong style="font-size: 14px; color: var(--text-secondary);">Charge</strong><br>
          <span class="text-gold">${formatCurrency(order.charge)}</span>
        </div>
        <div>
          <strong style="font-size: 14px; color: var(--text-secondary);">Created</strong><br>
          <span>${formatDate(order.createdAt)}</span>
        </div>
      </div>
      
      <div>
        <strong style="font-size: 14px; color: var(--text-secondary);">Refill Status</strong><br>
        <span class="${availability.eligible ? 'text-success' : 'text-muted'}">${availability.text}</span>
      </div>
    </div>
  `;
  
  const footer = document.getElementById('orderModalFooter');
  footer.innerHTML = `
    <button class="btn btn--outline btn--block" onclick="window.location.href='new-order.html?id=${order.serviceId}'">Reorder Service</button>
    <button class="btn btn--primary btn--block refill-modal-btn" data-order-id="${order.id}" data-link="${order.link || ''}" ${availability.eligible ? '' : 'disabled'}>${availability.eligible ? 'Request Refill' : 'Refill Locked'}</button>
  `;
  
  // Attach refill listener for modal button
  const modalRefillBtn = footer.querySelector('.refill-modal-btn');
  if (modalRefillBtn && availability.eligible) {
    modalRefillBtn.addEventListener('click', () => {
      window.location.href = `refill.html?order=${order.id}&link=${encodeURIComponent(order.link || '')}`;
    });
  }
  
  document.getElementById('orderDetailsModal').style.display = 'flex';
}

function closeOrderDetails() {
  const modal = document.getElementById('orderDetailsModal');
  if (modal) modal.style.display = 'none';
}

// Helper: Update all visible countdowns every minute
function updateRefillCountdowns() {
  document.querySelectorAll('.refill-btn').forEach(btn => {
    const orderId = btn.dataset.orderId;
    const order = currentOrders.find(o => o.id === orderId);
    if (!order) return;
    
    const availability = getRefillAvailability(order);
    if (availability.eligible) {
      btn.disabled = false;
      btn.innerText = 'Refill';
    } else {
      btn.disabled = true;
      btn.innerText = availability.text;
    }
  });
}

export default async function initOrders() {
  const tbody = $('.datatable tbody');
  if (!tbody) return;
  
  // Prevent duplicate initialization
  if (isOrdersInitialized) {
    return; 
  }
  isOrdersInitialized = true;
  
  // Inject Modal
  createOrderDetailsModal();
  
  try {
    const [ordersRes, servicesRes] = await Promise.all([
      api.getOrders(),
      api.getServices()
    ]);
    
    currentOrders = ordersRes.data || [];
    const services = servicesRes.data || [];
    
    services.forEach(s => {
      serviceMap[s.id] = {
        name: s.name,
        supplierServiceId: s.supplierServiceId
      };
    });
    
    renderOrders();
    
    // Start shared countdown timer
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateRefillCountdowns, 60000); // Update every minute
    
    // Listen for currency changes (Guarded)
    window.addEventListener('currencyChanged', renderOrders);
    
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center text-danger">Failed to load orders. Please try again later.</td></tr>`;
    console.error('Failed to load orders:', error);
  }
  
  function renderOrders() {
    if (currentOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" class="text-center text-muted">No orders found. Place your first order from the New Order page!</td></tr>`;
      return;
    }
    
    tbody.innerHTML = currentOrders.map(order => {
      const serviceData = serviceMap[order.serviceId] || {
        name: `ID: ${order.serviceId?.substring(0, 8)}`,
        supplierServiceId: 'N/A'
      };
      const serviceName = serviceData.name;
      const supplierServiceId = serviceData.supplierServiceId || 'N/A';
      
      const shortName = serviceName.length > 25 ? serviceName.substring(0, 25) + '...' : serviceName;
      const progress = calculateOrderProgress(order);
      const remainsCount = order.remains || 0;
      const remainsClass = remainsCount > 0 ? 'text-danger font-weight-bold' : 'text-muted';
      const availability = getRefillAvailability(order);
      
      return `
        <tr>
          <td>
            <a href="#" class="text-link order-details-link" data-order-id="${order.id}" style="font-weight: 600;">
              #${order.id?.substring(0, 8) || 'N/A'}
            </a>
          </td>
          <td title="${serviceName}">${shortName}</td>
          <td>
            <a href="new-order.html?id=${order.serviceId}" class="service-id-link" title="Re-order this service">
              ${supplierServiceId}
            </a>
          </td>
          <td><a href="${order.link}" target="_blank" class="text-link">View Link</a></td>
          <td>${order.quantity?.toLocaleString() || 0}</td>
          <td>${order.start_count?.toLocaleString() || 0}</td>
          <td class="${remainsClass}">${remainsCount.toLocaleString()}</td>
          <td>${formatCurrency(order.charge)}</td>
          <td><span class="badge badge--${order.status}">${order.status}</span></td>
          <td>
            <div class="progress-bar">
              <div class="progress-bar__fill" style="width: ${progress.toFixed(0)}%;"></div>
            </div>
          </td>
          <td>${formatDate(order.createdAt)}</td>
          <td>
            <button class="btn btn--outline btn--sm refill-btn" data-order-id="${order.id}" data-link="${order.link || ''}" ${availability.eligible ? '' : 'disabled'}>
              ${availability.eligible ? 'Refill' : availability.text}
            </button>
          </td>
        </tr>
      `;
    }).join('');
    
    // Attach Listeners for Refill
    document.querySelectorAll('.refill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        const orderId = btn.dataset.orderId;
        const link = btn.dataset.link;
        window.location.href = `refill.html?order=${orderId}&link=${encodeURIComponent(link)}`;
      });
    });

    // Attach Listeners for Order Details Modal
    document.querySelectorAll('.order-details-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const orderId = link.dataset.orderId;
        openOrderDetails(orderId);
      });
    });
  }
}
