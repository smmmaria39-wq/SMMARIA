// ===============================================
// Toast Component
// Global notification system
// ===============================================

// resellers/assets/js/components/toast.js
let toastContainer;

export function initToasts() {
 if (toastContainer) return;
 toastContainer = document.createElement('div');
 toastContainer.className = 'toast-container';
 document.body.appendChild(toastContainer);
}

export function showToast(message, type = 'info', duration = 3000) {
 if (!toastContainer) initToasts();
 
 const toast = document.createElement('div');
 toast.className = `toast toast--${type}`;
 toast.innerHTML = `<span>${message}</span>`;
 
 toastContainer.appendChild(toast);
 
 setTimeout(() => {
  toast.style.animation = 'slideInRight 0.3s reverse';
  setTimeout(() => toast.remove(), 300);
 }, duration);
}