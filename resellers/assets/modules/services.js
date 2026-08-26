// ===============================================
// Reseller Services & Pricing Module (Infinite Scroll)
// ===============================================

import { api } from '../utils/api.js';
import { formatCurrency } from '../utils/formatter.js';
import { showToast } from '../components/toast.js';

let allServices = [];
let filteredServices = [];
let currentRenderIndex = 0;
const CHUNK_SIZE = 50; // Loads 50 services at a time as user scrolls
let observer = null;

const $ = (id) => document.getElementById(id);

export default async function initServices() {
 const tbody = document.querySelector('.table tbody');
 if (!tbody) return;
 
 try {
  const response = await api.getPanelServices();
  allServices = response.data || [];
  
  // 1. Populate Category Dropdown dynamically
  populateCategories();
  
  // 2. Initial Render
  applyFilters();
  
  // 3. Attach Event Listeners
  if ($('serviceSearch')) $('serviceSearch').addEventListener('input', applyFilters);
  if ($('categoryFilter')) $('categoryFilter').addEventListener('change', applyFilters);
  if ($('applyMarkupBtn')) $('applyMarkupBtn').addEventListener('click', applyBulkMarkup);
  if ($('savePricesBtn')) $('savePricesBtn').addEventListener('click', savePrices);
  
 } catch (error) {
  tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load services.</td></tr>`;
 }
}

// --- Populate Categories ---
function populateCategories() {
 const categorySelect = $('categoryFilter');
 if (!categorySelect) return;
 
 const categories = [...new Set(allServices.map(s => s.category).filter(Boolean))].sort();
 
 categorySelect.innerHTML = '<option value="all">All Categories</option>';
 categories.forEach(cat => {
  const opt = document.createElement('option');
  opt.value = cat;
  opt.textContent = cat;
  categorySelect.appendChild(opt);
 });
}

// --- Filtering Logic ---
function applyFilters() {
 const searchQuery = ($('serviceSearch')?.value || '').toLowerCase();
 const selectedCategory = $('categoryFilter')?.value || 'all';
 
 filteredServices = allServices.filter(s => {
  const matchesSearch = s.name?.toLowerCase().includes(searchQuery) || s.id?.toLowerCase().includes(searchQuery);
  const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
  return matchesSearch && matchesCategory;
 });
 
 // Reset scroll position and re-render
 currentRenderIndex = 0;
 renderTable();
}

// --- Generate HTML for a chunk of services ---
function getRowsChunk() {
 const end = Math.min(currentRenderIndex + CHUNK_SIZE, filteredServices.length);
 const chunk = filteredServices.slice(currentRenderIndex, end);
 
 // Update index for the next chunk
 currentRenderIndex = end;
 
 return chunk.map(s => `
     <tr>
       <td>${s.id?.substring(0, 8)}</td>
       <td>${s.name}</td>
       <td>${s.category}</td>
       <td>${formatCurrency(s.costPrice)}</td>
       <td>
         <input type="number" step="0.01" value="${s.sellingPrice}" id="price-${s.id}" class="form-input form-input--sm" style="width: 100px; padding: 5px;">
       </td>
       <td><span class="badge badge--${s.status === 'active' ? 'success' : 'danger'}">${s.status}</span></td>
     </tr>
   `).join('');
}

// --- Render Table & Setup Infinite Scroll ---
function renderTable() {
 const tbody = document.querySelector('.table tbody');
 if (!tbody) return;
 
 // Disconnect old observer if it exists
 if (observer) observer.disconnect();
 
 if (filteredServices.length === 0) {
  tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No services found matching your criteria.</td></tr>`;
  return;
 }
 
 // Clear table and render first chunk (50 items)
 tbody.innerHTML = getRowsChunk();
 
 // Attach the invisible "trigger" row at the bottom for scrolling
 appendSentinel(tbody);
}

// --- Append the invisible trigger row ---
function appendSentinel(tbody) {
 if (currentRenderIndex >= filteredServices.length) return; // All items are already loaded
 
 const sentinel = document.createElement('tr');
 sentinel.className = 'infinite-scroll-sentinel';
 sentinel.innerHTML = `<td colspan="6" class="text-center text-muted" style="padding: 10px; font-size: 12px;">Loading more services...</td>`;
 tbody.appendChild(sentinel);
 
 // Create observer to watch for when this row enters the screen
 observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
   if (entry.isIntersecting) {
    loadMoreRows(tbody);
   }
  });
 }, { rootMargin: '200px' }); // Starts loading 200px before user actually hits the bottom
 
 observer.observe(sentinel);
}

// --- Load next chunk of rows ---
function loadMoreRows(tbody) {
 // Remove the old "Loading..." row
 const oldSentinel = tbody.querySelector('.infinite-scroll-sentinel');
 if (oldSentinel) oldSentinel.remove();
 
 // Stop if no more items to load
 if (currentRenderIndex >= filteredServices.length) {
  if (observer) observer.disconnect();
  return;
 }
 
 // Append the next 50 rows
 tbody.insertAdjacentHTML('beforeend', getRowsChunk());
 
 // Append a new sentinel to watch for the NEXT scroll
 appendSentinel(tbody);
}

// --- Bulk Percentage Markup ---
function applyBulkMarkup() {
 const percent = parseFloat($('bulkMarkupInput')?.value);
 
 if (isNaN(percent)) {
  return showToast('Please enter a valid percentage number', 'error');
 }
 
 let updatedCount = 0;
 
 // Safely apply ONLY to inputs that are currently rendered in the DOM
 const renderedInputs = document.querySelectorAll('.table tbody input[id^="price-"]');
 
 renderedInputs.forEach(input => {
  const serviceId = input.id.replace('price-', '');
  const service = allServices.find(s => s.id === serviceId);
  
  if (service && service.costPrice != null) {
   const newPrice = (service.costPrice * (1 + (percent / 100))).toFixed(2);
   input.value = newPrice;
   updatedCount++;
  }
 });
 
 if (updatedCount > 0) {
  showToast(`${percent}% markup applied to ${updatedCount} visible services. Click 'Save Changes' to confirm.`, 'info');
 } else {
  showToast('No visible services to update.', 'info');
 }
}

// --- Save Logic ---
async function savePrices() {
 const updates = [];
 
 // Safely save ONLY the inputs that are currently rendered in the DOM
 const renderedInputs = document.querySelectorAll('.table tbody input[id^="price-"]');
 
 renderedInputs.forEach(input => {
  const serviceId = input.id.replace('price-', '');
  const service = allServices.find(s => s.id === serviceId);
  
  if (service) {
   const newPrice = parseFloat(input.value);
   if (!isNaN(newPrice) && newPrice !== service.sellingPrice) {
    updates.push({ id: serviceId, sellingPrice: newPrice });
   }
  }
 });
 
 if (updates.length === 0) return showToast('No changes to save.', 'info');
 
 try {
  showToast('Saving prices...', 'info');
  await api.bulkUpdatePanelPrices(updates);
  showToast('Prices updated successfully!', 'success');
  
  // Update local array with new prices
  updates.forEach(upd => {
   const idx = allServices.findIndex(s => s.id === upd.id);
   if (idx !== -1) allServices[idx].sellingPrice = upd.sellingPrice;
  });
 } catch (error) {
  showToast('Failed to save prices', 'error');
 }
}