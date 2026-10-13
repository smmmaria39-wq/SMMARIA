/**
 * SM MARIA - Mobile App Experience Enhancer (ES Module)
 */
export const MobileApp = {
 init() {
  this.checkStandaloneMode();
  this.setupDOMFeatures();
 },
 
 checkStandaloneMode() {
  const isStandalone =
   window.matchMedia('(display-mode: standalone)').matches ||
   window.navigator.standalone === true;
  
  const htmlEl = document.documentElement;
  
  if (isStandalone) {
   htmlEl.classList.add('standalone-app');
  } else {
   htmlEl.classList.remove('standalone-app');
  }
  
  try {
   window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
    if (e.matches) htmlEl.classList.add('standalone-app');
    else htmlEl.classList.remove('standalone-app');
   });
  } catch (err) {
   console.warn('MatchMedia listener failed:', err);
  }
 },
 
 setupDOMFeatures() {
  // Ensure DOM is ready before querying elements
  if (document.readyState === 'loading') {
   document.addEventListener('DOMContentLoaded', () => {
    this.setupSidebar();
    this.setupBottomNav();
   });
  } else {
   this.setupSidebar();
   this.setupBottomNav();
  }
 },
 
 setupSidebar() {
  const appContainer = document.querySelector('.app-container');
  const toggleBtn = document.querySelector('.navbar__toggle');
  
  if (!appContainer || !toggleBtn) return;
  
  let backdrop = document.querySelector('.sidebar-backdrop');
  if (!backdrop) {
   backdrop = document.createElement('div');
   backdrop.className = 'sidebar-backdrop';
   appContainer.appendChild(backdrop);
  }
  
  let savedScrollPos = 0;
  
  const openSidebar = () => {
   savedScrollPos = window.scrollY;
   document.body.classList.add('mobile-scroll-locked');
   document.body.style.top = `-${savedScrollPos}px`;
   appContainer.classList.add('sidebar-open');
  };
  
  const closeSidebar = () => {
   if (appContainer.classList.contains('sidebar-open')) {
    appContainer.classList.remove('sidebar-open');
    document.body.classList.remove('mobile-scroll-locked');
    document.body.style.top = '';
    window.scrollTo(0, savedScrollPos);
   }
  };
  
  toggleBtn.addEventListener('click', (e) => {
   e.stopPropagation();
   if (appContainer.classList.contains('sidebar-open')) {
    closeSidebar();
   } else {
    openSidebar();
   }
  });
  
  backdrop.addEventListener('click', closeSidebar);
  
  document.addEventListener('keydown', (e) => {
   if (e.key === 'Escape') closeSidebar();
  });
  
  const sidebarLinks = document.querySelectorAll('.sidebar__nav a, .sidebar__footer a');
  sidebarLinks.forEach(link => {
   link.addEventListener('click', () => {
    if (window.innerWidth <= 768) closeSidebar();
   });
  });
 },
 
 setupBottomNav() {
  const navLinks = document.querySelectorAll('.mobile-nav__link');
  if (!navLinks.length) return;
  
  let currentPath = window.location.pathname;
  if (currentPath !== '/' && currentPath.endsWith('/')) {
   currentPath = currentPath.slice(0, -1);
  }
  
  navLinks.forEach(link => {
   const linkPath = link.getAttribute('href');
   if (!linkPath || linkPath === '#') return;
   
   let normalizedLinkPath = linkPath;
   if (normalizedLinkPath !== '/' && normalizedLinkPath.endsWith('/')) {
    normalizedLinkPath = normalizedLinkPath.slice(0, -1);
   }
   
   if (currentPath === normalizedLinkPath || currentPath.startsWith(normalizedLinkPath + '/')) {
    link.classList.add('active');
    link.setAttribute('aria-current', 'page');
   } else {
    link.classList.remove('active');
    link.removeAttribute('aria-current');
   }
  });
 }
};
