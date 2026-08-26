// ===============================================
// Reseller Auth Module
// ===============================================

import { api } from '../utils/api.js';
import { showToast } from '../components/toast.js';

export default async function initAuth() {
 const loginForm = document.getElementById('login-form');
 const registerForm = document.getElementById('register-form');
 
 // Handle Reseller/Child User Login
 if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
   e.preventDefault(); // Prevent page refresh
   
   const identifier = document.getElementById('identifier').value;
   const password = document.getElementById('password').value;
   const submitBtn = loginForm.querySelector('button[type="submit"]');
   
   const originalBtnText = submitBtn.innerHTML;
   submitBtn.disabled = true;
   submitBtn.innerHTML = 'Logging in...';
   
   try {
    const response = await api.login(identifier, password);
    
    if (response.data && response.data.token) {
     localStorage.setItem('smmmaria_reseller_token', response.data.token);
     showToast('Login successful! Redirecting...', 'success');
     setTimeout(() => window.location.href = 'dashboard.html', 1000);
    } else {
     throw new Error('Invalid response from server.');
    }
   } catch (error) {
    // Display the error visually on the page, do not use console
    showToast(error.message || 'Invalid credentials', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
   }
  });
 }
 
 // Handle Child User Registration
 if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
   e.preventDefault();
   
   const username = document.getElementById('username').value;
   const email = document.getElementById('email').value;
   const password = document.getElementById('password').value;
   const submitBtn = registerForm.querySelector('button[type="submit"]');
   
   const originalBtnText = submitBtn.innerHTML;
   submitBtn.disabled = true;
   submitBtn.innerHTML = 'Creating account...';
   
   try {
    const response = await api.register({ username, email, password });
    
    if (response.data && response.data.token) {
     localStorage.setItem('smmmaria_reseller_token', response.data.token);
     showToast('Registration successful!', 'success');
     setTimeout(() => window.location.href = 'dashboard.html', 1000);
    } else {
     throw new Error('Invalid response from server.');
    }
   } catch (error) {
    // Display the error visually on the page, do not use console
    showToast(error.message || 'Registration failed', 'error');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
   }
  });
 }
}

// Export handleLogout so app.js can attach it to the window object
export function handleLogout() {
 localStorage.removeItem('smmmaria_reseller_token');
 window.location.href = 'login.html';
}