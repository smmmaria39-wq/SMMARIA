// ===============================================
// Auth Module (Login, Register, Logout, Google)
// ===============================================

import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

export async function handleLogin(e) {
 e.preventDefault();
 const identifier = document.getElementById('identifier').value;
 const password = document.getElementById('password').value;
 
 if (!identifier) {
  return showToast('Please enter your email, username, or Account ID', 'error');
 }
 
 try {
  showToast('Logging in...', 'info');
  // Send identifier instead of email
  const response = await api.login(identifier, password);
  
  // Save token to localStorage
  localStorage.setItem('smmmaria_token', response.data.token);
  
  showToast('Login successful! Redirecting...', 'success');
  
  // Redirect to dashboard
  setTimeout(() => {
   window.location.href = 'services.html';
  }, 1000);
 } catch (error) {
  showToast(error.message || 'Invalid credentials', 'error');
 }
}

export async function handleRegister(e) {
 e.preventDefault();
 const fullname = document.getElementById('fullname').value;
 const email = document.getElementById('email').value;
 const username = document.getElementById('username').value;
 const country = document.getElementById('country').value;
 const phone = document.getElementById('phone').value;
 const password = document.getElementById('password').value;
 
 try {
  showToast('Creating account...', 'info');
  // Send all new fields to the API
  const response = await api.register({ fullname, username, email, password, country, phone });
  
  // Save token to localStorage
  localStorage.setItem('smmmaria_token', response.data.token);
  
  showToast('Registration successful! Redirecting...', 'success');
  
  setTimeout(() => {
   window.location.href = 'services.html';
  }, 1000);
 } catch (error) {
  showToast(error.message || 'Registration failed', 'error');
 }
}

export function handleLogout() {
 localStorage.removeItem('smmmaria_token');
 showToast('Logged out successfully', 'info');
 setTimeout(() => {
  window.location.href = 'login.html';
 }, 500);
}

// ===============================================
// Google Authentication Logic
// ===============================================
function initGoogleAuth() {
 const googleBtn = document.getElementById('google-login-btn');
 if (!googleBtn) return;
 
 googleBtn.addEventListener('click', () => {
  if (!window.google) {
   return showToast('Google services are still loading. Please try again in a moment.', 'error');
  }
  
  // Initialize Google Identity Services
  window.google.accounts.id.initialize({
   // INSTRUCTION: Replace this with your actual Google OAuth Client ID from Google Cloud Console
   client_id: '464869417910-ac27a2tuce107jfdqf0fm46m1gggi0d6.apps.googleusercontent.com',
   callback: async (response) => {
    try {
     showToast('Verifying Google account...', 'info');
     // Send the secure Google token to your backend
     const res = await api.googleAuth(response.credential);
     
     if (res.data && res.data.token) {
      localStorage.setItem('smmmaria_token', res.data.token);
      showToast('Login successful! Redirecting...', 'success');
      setTimeout(() => {
       window.location.href = 'services.html';
      }, 1000);
     }
    } catch (error) {
     showToast(error.message || 'Google login failed', 'error');
    }
   }
  });
  
  // Open the Google account chooser popup
  window.google.accounts.id.prompt();
 });
}

// Initialize Google button listener
initGoogleAuth();

// Expose functions to the global window object so inline HTML onsubmit attributes can access them
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;