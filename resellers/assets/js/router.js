// ===============================================
// Router.js - Dynamic Module Loader
// ===============================================

export async function loadPageModule() {
 // Get the page identifier from the body tag
 const pageName = document.body.getAttribute('data-page');
 
 if (!pageName) return;
 
 try {
  // Dynamically import the module corresponding to the page
  const module = await import(`../modules/${pageName}.js`);
  
  // If the module has a default export function, execute it
  if (module && typeof module.default === 'function') {
   await module.default();
  }
  // Or if it has a named 'init' export function, execute it
  else if (module && typeof module.init === 'function') {
   await module.init();
  }
 } catch (error) {
  // Log as an error so it's easy to spot in the console during debugging
  console.error(`[Router] Failed to load module for page: ${pageName}`, error);
 }
}