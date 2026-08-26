// ===============================================
// Orders Module
// ===============================================

import { api } from '../utils/api.js';
import { $ } from '../utils/helpers.js';
import { formatCurrency } from '../modules/currency.js';
import { formatDate } from '../utils/formatter.js';

let serviceMap = {};
let currentOrders = [];

export default async function initOrders() {
 const tbody = $('.datatable tbody');
 if (!tbody) return;
 
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
  
  // Listen for currency changes to re-render charges
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
   
   let progress = 0;
   if (order.status === 'completed') {
    progress = 100;
   } else if (order.status === 'partial' || order.status === 'canceled') {
    const delivered = order.quantity - (order.remains || 0);
    progress = order.quantity > 0 ? (delivered / order.quantity) * 100 : 0;
   } else if (order.status === 'processing' || order.status === 'in_progress') {
    if (order.remains !== undefined && order.quantity > 0) {
     const delivered = order.quantity - order.remains;
     progress = (delivered / order.quantity) * 100;
     progress = Math.max(0, Math.min(99, progress));
    } else {
     progress = 40;
    }
   } else if (order.status === 'pending') {
    progress = 0;
   }
   
   const remainsCount = order.remains || 0;
   const remainsClass = remainsCount > 0 ? 'text-danger font-weight-bold' : 'text-muted';
   
   return `
                <tr>
                  <td>#${order.id?.substring(0, 8) || 'N/A'}</td>
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
                    <button class="btn btn--outline btn--sm refill-btn" data-order-id="${order.id}" data-link="${order.link || ''}">Refill</button>
                  </td>
                </tr>
            `;
  }).join('');
  
  document.querySelectorAll('.refill-btn').forEach(btn => {
   btn.addEventListener('click', () => {
    const orderId = btn.dataset.orderId;
    const link = btn.dataset.link;
    window.location.href = `refill.html?order=${orderId}&link=${encodeURIComponent(link)}`;
   });
  });
 }
}