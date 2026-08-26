// ===============================================
// Services Module (Optimized Infinite Scroll + Caching)
// ===============================================

import { api } from '../utils/api.js';
import { $, debounce } from '../utils/helpers.js';
import { showToast } from '../components/toast.js';
import { formatCurrency } from '../modules/currency.js';

// ==========================================
// 1. CACHE CONFIGURATION & STATE
// ==========================================
const CACHE_KEYS = {
    SERVICES: 'smm_services_cache',
    CATEGORIES: 'smm_categories_cache',
    NOTIFICATIONS: 'smm_notifications_cache'
};

const TTL = {
    SERVICES: 5 * 60 * 1000,       // 5 minutes
    CATEGORIES: 10 * 60 * 1000,   // 10 minutes
    NOTIFICATIONS: 2 * 60 * 1000  // 2 minutes
};

let allServices = [];
let filteredServices = [];
let displayCount = 0;
const BATCH_SIZE = 15; 
let isLoading = false;
let sentinelObserver = null;
let currentCategoryFilter = 'all'; 

// In-Memory Caches (Priority 1)
let servicesMemoryCache = null;
let categoriesMemoryCache = null;
let notificationsMemoryCache = null;

// Request Locks (Prevent duplicate concurrent API calls)
let servicesRequestPromise = null;
let categoriesRequestPromise = null;
let notificationsRequestPromise = null;


// ==========================================
// 2. CACHE HELPER FUNCTIONS
// ==========================================

/**
 * Safely retrieves and parses cached data from localStorage.
 * Handles corrupted JSON gracefully.
 */
function getCache(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch (error) {
        console.warn(`Cache corruption detected for key: ${key}. Removing invalid cache.`);
        localStorage.removeItem(key);
        return null;
    }
}

/**
 * Saves data to localStorage with a timestamp.
 */
function setCache(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (error) {
        console.warn('Failed to write to localStorage. Storage might be full.');
    }
}

/**
 * Checks if a cached object is still within its Time-To-Live window.
 */
function isCacheValid(cacheObj, ttl) {
    return cacheObj && cacheObj.timestamp && (Date.now() - cacheObj.timestamp < ttl);
}

/**
 * Clears only the services cache (Memory & LocalStorage).
 * Useful if an admin updates services and you want to force a refresh.
 */
export function clearServicesCache() {
    localStorage.removeItem(CACHE_KEYS.SERVICES);
    servicesMemoryCache = null;
}

/**
 * Clears all caches related to the services page.
 */
export function clearAllServicesCaches() {
    Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
    servicesMemoryCache = null;
    categoriesMemoryCache = null;
    notificationsMemoryCache = null;
}


// ==========================================
// 3. SMART DATA FETCHERS (Stale-While-Revalidate)
// ==========================================

async function fetchServicesData() {
    // Priority 1: Memory Cache
    if (servicesMemoryCache) return { data: servicesMemoryCache, isStale: false };

    // Priority 2: LocalStorage Cache
    const diskCache = getCache(CACHE_KEYS.SERVICES);
    if (diskCache) {
        if (isCacheValid(diskCache, TTL.SERVICES)) {
            servicesMemoryCache = diskCache.data;
            return { data: diskCache.data, isStale: false };
        }
        // Stale-While-Revalidate: Return stale data immediately
        return { data: diskCache.data, isStale: true };
    }

    // Priority 3: Network Request (Deduplicated)
    if (!servicesRequestPromise) {
        servicesRequestPromise = api.getServices().finally(() => { servicesRequestPromise = null; });
    }
    
    try {
        const res = await servicesRequestPromise;
        const data = res.data || [];
        servicesMemoryCache = data;
        setCache(CACHE_KEYS.SERVICES, data);
        return { data, isStale: false };
    } catch (error) {
        // Network failure fallback: Use stale disk cache if available
        if (diskCache) {
            console.warn('Services API failed, falling back to stale cache.');
            return { data: diskCache.data, isStale: true };
        }
        throw error; // Re-throw if absolutely no data available
    }
}

async function fetchCategoriesData() {
    if (categoriesMemoryCache) return { data: categoriesMemoryCache, isStale: false };
    const diskCache = getCache(CACHE_KEYS.CATEGORIES);
    if (diskCache) {
        if (isCacheValid(diskCache, TTL.CATEGORIES)) {
            categoriesMemoryCache = diskCache.data;
            return { data: diskCache.data, isStale: false };
        }
        return { data: diskCache.data, isStale: true };
    }
    if (!categoriesRequestPromise) {
        categoriesRequestPromise = api.getCategories().finally(() => { categoriesRequestPromise = null; });
    }
    try {
        const res = await categoriesRequestPromise;
        const data = res.data || [];
        categoriesMemoryCache = data;
        setCache(CACHE_KEYS.CATEGORIES, data);
        return { data, isStale: false };
    } catch (error) {
        if (diskCache) return { data: diskCache.data, isStale: true };
        throw error;
    }
}

async function fetchNotificationsData() {
    if (notificationsMemoryCache) return { data: notificationsMemoryCache, isStale: false };
    const diskCache = getCache(CACHE_KEYS.NOTIFICATIONS);
    if (diskCache) {
        if (isCacheValid(diskCache, TTL.NOTIFICATIONS)) {
            notificationsMemoryCache = diskCache.data;
            return { data: diskCache.data, isStale: false };
        }
        return { data: diskCache.data, isStale: true };
    }
    if (!notificationsRequestPromise) {
        notificationsRequestPromise = api.getNotifications().finally(() => { notificationsRequestPromise = null; });
    }
    try {
        const res = await notificationsRequestPromise;
        const data = res.data || [];
        notificationsMemoryCache = data;
        setCache(CACHE_KEYS.NOTIFICATIONS, data);
        return { data, isStale: false };
    } catch (error) {
        if (diskCache) return { data: diskCache.data, isStale: true };
        throw error;
    }
}


// ==========================================
// 4. BACKGROUND REFRESH LOGIC
// ==========================================

/**
 * Processes raw services array (applies Instagram/TikTok sorting)
 */
function processServicesData(rawData) {
    return rawData.sort((a, b) => {
        const aCat = (a.category || '').toLowerCase();
        const bCat = (b.category || '').toLowerCase();
        const aPop = (aCat.includes('instagram') || aCat.includes('tiktok')) ? 0 : 1;
        const bPop = (bCat.includes('instagram') || bCat.includes('tiktok')) ? 0 : 1;
        return aPop - bPop;
    });
}

async function refreshServicesInBackground() {
    try {
        const res = await api.getServices();
        const data = res.data || [];
        servicesMemoryCache = data;
        setCache(CACHE_KEYS.SERVICES, data);
        
        const newProcessed = processServicesData(data);
        // Only update UI if data actually changed to prevent layout flickering
        if (JSON.stringify(allServices) !== JSON.stringify(newProcessed)) {
            allServices = newProcessed;
            runFiltersGlobal && runFiltersGlobal(); // Re-render grid seamlessly
        }
    } catch (error) {
        console.warn('Background services refresh failed:', error.message);
    }
}

async function refreshCategoriesInBackground() {
    try {
        const res = await api.getCategories();
        const data = res.data || [];
        categoriesMemoryCache = data;
        setCache(CACHE_KEYS.CATEGORIES, data);
        // Note: Category dropdown usually doesn't change dynamically, so we skip heavy UI updates here.
    } catch (error) {
        console.warn('Background categories refresh failed:', error.message);
    }
}

async function refreshNotificationsInBackground() {
    try {
        const res = await api.getNotifications();
        const data = res.data || [];
        notificationsMemoryCache = data;
        setCache(CACHE_KEYS.NOTIFICATIONS, data);
        // Re-render scroller if new notifications arrive
        setupAnnouncementScroller(data);
    } catch (error) {
        console.warn('Background notifications refresh failed:', error.message);
    }
}


// ==========================================
// 5. EXISTING UI LOGIC (Unmodified functionality)
// ==========================================

// Setup Horizontal Scrolling Announcements
function setupAnnouncementScroller(notifications) {
    const platformCard = document.querySelector('.platform-icons-card');
    if (!platformCard || !notifications || notifications.length === 0) return;
    
    const existingScroller = document.querySelector('.announcements-scroller-card');
    if (existingScroller) existingScroller.remove();
    
    const scrollerHTML = `
        <div class="card announcements-scroller-card">
            <div class="announcements-scroller-header">
                <h3>📢 Latest Updates</h3>
                <span>Swipe to view more →</span>
            </div>
            <div class="announcements-scroller-container">
                ${notifications.map(n => `
                    <div class="announcement-pill">
                        <h4>${n.title || 'Announcement'}</h4>
                        <p>${n.message}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    platformCard.insertAdjacentHTML('afterend', scrollerHTML);
    
    const container = document.querySelector('.announcements-scroller-container');
    if (container) {
        const randomScroll = Math.floor(Math.random() * notifications.length) * 280; 
        container.scrollLeft = randomScroll;
    }
}


// ==========================================
// 6. MAIN INITIALIZATION
// ==========================================

let runFiltersGlobal = null; // Needed to allow background refreshes to trigger filters

export default async function initServices() {
    const grid = $('.services-grid');
    const searchInput = $('#serviceSearch');
    const categorySelect = $('#categoryFilter');
    const platformBtns = document.querySelectorAll('.platform-icon-btn');
    
    if (!grid) return;

    // ==========================================
    // LOADER SPINNER INJECTION
    // ==========================================
    grid.innerHTML = `
        <div class="loader-container" style="grid-column: 1 / -1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 60px 20px; gap: 15px;">
            <div class="loader-spinner" style="width: 40px; height: 40px; border: 4px solid var(--border-color, #e5e7eb); border-top-color: var(--color-gold, #f4b342); border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <p style="color: var(--text-secondary, #6b7280); font-size: 14px; font-weight: 500;">Loading Services...</p>
        </div>
    `;
    
    let listenersAttached = false;

    try {
        // Fetch data using smart caching layer (Resolves instantly if cached)
        const [servicesRes, categoriesRes, notifRes] = await Promise.all([
            fetchServicesData(),
            fetchCategoriesData(),
            fetchNotificationsData()
        ]);
        
        // Apply data to state
        allServices = processServicesData(servicesRes.data);
        const categories = categoriesRes.data || [];
        const notifications = notifRes.data || [];
        
        // Setup the Horizontal Notification Scroller
        setupAnnouncementScroller(notifications);
        
        // Populate Category Dropdown
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="all">All Categories</option>';
            categories.forEach(cat => {
                const catName = typeof cat === 'object' ? cat.name : cat;
                if (catName) {
                    categorySelect.innerHTML += `<option value="${catName}">${catName}</option>`;
                }
            });
        }

        // --- FILTER FUNCTION ---
        const runFilters = () => {
            const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
            
            filteredServices = allServices.filter(s => {
                const matchesName = s.name?.toLowerCase().includes(searchTerm);
                const matchesCategoryName = s.category?.toLowerCase().includes(searchTerm);
                const matchesID = s.supplierServiceId?.toString().includes(searchTerm);
                
                const matchesSearch = matchesName || matchesCategoryName || matchesID;
                
                let matchesCategory = currentCategoryFilter === 'all';
                if (!matchesCategory && s.category) {
                    matchesCategory = s.category.toLowerCase().includes(currentCategoryFilter.toLowerCase());
                }
                return matchesSearch && matchesCategory;
            });
            
            displayCount = BATCH_SIZE; 
            renderServices(true); 
            
            // Sync platform icons active state
            if (platformBtns) {
                platformBtns.forEach(btn => {
                    const btnCat = btn.getAttribute('data-category');
                    if (currentCategoryFilter === 'all' && btnCat === 'all') {
                        btn.classList.add('active');
                    } else if (btnCat !== 'all' && currentCategoryFilter !== 'all' && currentCategoryFilter.toLowerCase().includes(btnCat.toLowerCase())) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
        };
        
        runFiltersGlobal = runFilters; // Expose locally for background tasks

        // --- RENDER FUNCTION ---
        const renderServices = (isFresh = false) => {
            if (filteredServices.length === 0) {
                grid.innerHTML = '<p class="text-muted text-center">No services found.</p>';
                return;
            }
            
            if (isFresh) {
                grid.innerHTML = '';
            }
            
            const startIndex = isFresh ? 0 : displayCount - BATCH_SIZE;
            const batch = filteredServices.slice(startIndex, displayCount);
            
            const cardsHTML = batch.map(s => {
                const hasRefill = s.refill === true || s.refill === 'true' || s.refill === 1 || s.refill === '1';
                
                return `
                <div class="service-card">
                    <div class="service-card__header">
                        <span class="service-card__category">${s.category || 'General'}</span>
                        <div class="service-card__id-box">
                            <label>ID:</label>
                            <input type="text" class="service-id-input" value="${s.supplierServiceId || 'N/A'}" readonly>
                        </div>
                    </div>
                    <h3 class="service-card__title">${s.name}</h3>
                    <p class="service-card__desc">Avg Time: ${s.averageTime || 'Unknown'}</p>
                    <div class="service-card__details">
                        <div class="service-card__rate">
                            <span class="rate-label">Rate per 1000</span>
                            <span class="rate-value text-gold">${formatCurrency(s.sellingPrice)}</span>
                            <span class="rate-value-ugx"></span>
                        </div>
                        <div class="service-card__limits">
                            <div class="limit-item">
                                <span class="limit-label">Min</span>
                                <span class="limit-value">${s.min}</span>
                            </div>
                            <div class="limit-item">
                                <span class="limit-label">Max</span>
                                <span class="limit-value">${s.max?.toLocaleString() || 0}</span>
                            </div>
                        </div>
                    </div>
                    <div class="service-card__footer">
                        <span class="badge badge--${hasRefill ? 'success' : 'danger'}">Refill: ${hasRefill ? 'Yes' : 'No'}</span>
                        <a href="new-order.html?id=${s.id}" class="btn btn--primary btn--block">Order Now</a>
                    </div>
                </div>
                `;
            }).join('');
            
            grid.insertAdjacentHTML('beforeend', cardsHTML);
            
            let sentinel = document.getElementById('sentinel');
            if (displayCount < filteredServices.length) {
                if (!sentinel) {
                    sentinel = document.createElement('div');
                    sentinel.id = 'sentinel';
                    sentinel.style.gridColumn = '1 / -1';
                    sentinel.style.height = '1px';
                    grid.appendChild(sentinel);
                }
                sentinelObserver.unobserve(sentinel);
                sentinelObserver.observe(sentinel);
            } else if (sentinel) {
                sentinelObserver.unobserve(sentinel);
            }
        };

        // --- LOAD MORE FUNCTION ---
        const loadMore = () => {
            if (displayCount >= filteredServices.length) return;
            isLoading = true;
            displayCount += BATCH_SIZE;
            renderServices(false);
            isLoading = false;
        };
        
        // Setup the Invisible Scroll Observer (Once)
        if (sentinelObserver) sentinelObserver.disconnect();
        sentinelObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !isLoading) {
                loadMore();
            }
        }, { rootMargin: '300px' });

        // --- ATTACH EVENT LISTENERS (Only once to prevent duplicates) ---
        if (!listenersAttached) {
            if (searchInput) {
                searchInput.addEventListener('input', debounce(runFilters, 300));
            }
            
            if (categorySelect) {
                categorySelect.addEventListener('change', (e) => {
                    currentCategoryFilter = e.target.value;
                    runFilters();
                });
            }
            
            if (platformBtns) {
                platformBtns.forEach(btn => {
                    btn.addEventListener('click', () => {
                        currentCategoryFilter = btn.getAttribute('data-category');
                        runFilters();
                    });
                });
            }

            // Listen for currency changes to re-render prices immediately
            window.addEventListener('currencyChanged', () => {
                runFilters();
            });

            listenersAttached = true;
        }

        // --- INITIAL RENDER ---
        runFilters();

        // --- STALE-WHILE-REVALIDATE: Background Refreshes ---
        // If any data was stale, fire background requests without blocking the UI
        const backgroundPromises = [];
        if (servicesRes.isStale) backgroundPromises.push(refreshServicesInBackground());
        if (categoriesRes.isStale) backgroundPromises.push(refreshCategoriesInBackground());
        if (notifRes.isStale) backgroundPromises.push(refreshNotificationsInBackground());
        
        // Execute background tasks (Fire-and-forget)
        if (backgroundPromises.length > 0) {
            Promise.all(backgroundPromises);
        }

    } catch (error) {
        // This catch block ONLY triggers if there is NO cache and the API fails
        grid.innerHTML = '<p class="text-muted text-center">Failed to load services. Please try again later.</p>';
        showToast('Failed to load services', 'error');
        console.error('Services initialization failed:', error);
    }
} 