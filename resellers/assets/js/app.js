// ===============================================
// App.js - Reseller Frontend Main Entry Point
// ===============================================

import { api } from '../utils/api.js';
import { loadPageModule } from './router.js';
import { initTheme } from '../utils/storage.js';
import { initSidebar } from '../components/sidebar.js';
import { initNavbar } from '../components/navbar.js';
import { initModals } from '../components/modal.js';
import { initToasts } from '../components/toast.js';
import { initFooter } from '../components/footer.js';
import { initDropdowns } from '../components/dropdown.js';
import { handleLogout } from '../modules/auth.js';

window.handleLogout = handleLogout;

const currentPath = window.location.pathname.toLowerCase();
const isPublicPage = currentPath.includes('login') || currentPath.includes('register') || currentPath.endsWith('/');

if (!isPublicPage) {
 const token = localStorage.getItem('smmmaria_reseller_token');
 if (!token) {
  window.location.href = './login.html';
 }
}

document.addEventListener('DOMContentLoaded', async () => {
 // Initialize UI Components Safely
 try { initTheme(); } catch (e) {}
 try { initSidebar(); } catch (e) {}
 try { initNavbar(); } catch (e) {}
 try { initModals(); } catch (e) {}
 try { initToasts(); } catch (e) {}
 try { initFooter(); } catch (e) {}
 try { initDropdowns(); } catch (e) {}
 
 // Fetch real user data for Navbar
 const token = localStorage.getItem('smmmaria_reseller_token');
 if (token && !isPublicPage) {
  try {
   const response = await api.getMe();
   const user = response.data;
   if (user) {
    const balanceEl = document.querySelector('.navbar__balance strong, .navbar__balance .text-gold');
    if (balanceEl) balanceEl.textContent = `$${parseFloat(user.balance || 0).toFixed(2)}`;
    
    const nameEl = document.querySelector('.navbar__title');
    if (nameEl && user.username) nameEl.textContent = user.username;
   }
  } catch (error) {
   console.error("Session expired or invalid. Please log in again.");
   window.handleLogout();
  }
 }
 
 // Load the specific module for the current page
 try {
  loadPageModule();
 } catch (e) {
  console.error("Failed to load page module:", e);
 }
});