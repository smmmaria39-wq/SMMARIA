// ===============================================
// Formatter Utility
// Currency, Date, and Number formatting
// ===============================================

export function formatCurrency(amount) {
 return new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2
 }).format(amount);
}

export function formatDate(dateString) {
 const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
 return new Date(dateString).toLocaleDateString('en-US', options);
}

export function formatNumber(num) {
 return new Intl.NumberFormat('en-US').format(num);
}