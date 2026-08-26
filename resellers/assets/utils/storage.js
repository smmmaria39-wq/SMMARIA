// ===============================================
// Storage Utility
// LocalStorage, SessionStorage, and Theme Management
// ===============================================

const THEME_KEY = 'smmmaria_theme';

export const storage = {
 get: (key) => {
  const item = localStorage.getItem(key);
  try {
   return item ? JSON.parse(item) : null;
  } catch (e) {
   console.error("Error parsing localStorage item:", e);
   return null;
  }
 },
 set: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
 remove: (key) => localStorage.removeItem(key),
 
 getSession: (key) => {
  const item = sessionStorage.getItem(key);
  try {
   return item ? JSON.parse(item) : null;
  } catch (e) {
   console.error("Error parsing sessionStorage item:", e);
   return null;
  }
 },
 setSession: (key, value) => sessionStorage.setItem(key, JSON.stringify(value)),
};

export function initTheme() {
 const savedTheme = storage.get(THEME_KEY) || 'light';
 document.documentElement.setAttribute('data-theme', savedTheme);
 
 // Automatically attach the theme toggle listener if the button exists on the page
 const toggleBtn = document.getElementById('theme-toggle');
 if (toggleBtn) {
  toggleBtn.addEventListener('click', toggleTheme);
 }
}

export function toggleTheme() {
 const currentTheme = document.documentElement.getAttribute('data-theme');
 const newTheme = currentTheme === 'light' ? 'dark' : 'light';
 document.documentElement.setAttribute('data-theme', newTheme);
 storage.set(THEME_KEY, newTheme);
}