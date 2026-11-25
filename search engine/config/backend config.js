
// ===============================================
// SMMARIA GLOBAL SEARCH
// BACKEND CONFIGURATION
// ===============================================

// This frontend uses the existing SMMARIA authentication.
// It does NOT create a separate login system.
//
// Main SMMARIA authentication storage key:
// smmmaria_token
//
// Never put Firebase service-account credentials,
// admin passwords or private API keys in this file.

const defaults = {

    // ===========================================
    // BACKEND URL
    // ===========================================

    baseUrl: "https://global-search-backend-production.up.railway.app",

    // ===========================================
    // REQUEST SETTINGS
    // ===========================================

    timeoutMs: 20000,

    // IMPORTANT:
    // The first key is the exact key used by
    // your main SMMARIA App.js authentication.

    tokenStorageKeys: [
        "smmmaria_token",

        // Legacy compatibility keys
        "token",
        "authToken",
        "smmaria_token",
        "smmariaToken"
    ],

    // ===========================================
    // API ENDPOINTS
    // ===========================================

    endpoints: {

        // Backend health
        health: "/health",

        // Global search
        search: "/api/v1/search",

        // Platform information
        platforms: "/api/v1/platforms",

        // Country filters
        countries: "/api/v1/countries",

        // Search billing
        billingSummary: "/api/v1/billing/summary",

        // Purchase search tokens
        billingPurchase: "/api/v1/billing/purchase",

        // Search invoices
        billingInvoices: "/api/v1/billing/invoices"

    }

};


// ===============================================
// URL NORMALIZATION
// ===============================================

function normalize(value) {

    const v = String(value || "").trim();

    if (!v) {
        throw new Error("Global Search backend URL is missing.");
    }

    if (
        v.includes("YOUR-SEARCH-BACKEND") ||
        v.includes("YOUR_RAILWAY_URL")
    ) {
        throw new Error("Configure your Global Search backend URL.");
    }

    let url;

    try {
        url = new URL(v);
    } catch {
        throw new Error("Invalid Global Search backend URL.");
    }

    if (!["https:", "http:"].includes(url.protocol)) {
        throw new Error("Backend URL must use HTTP or HTTPS.");
    }

    if (url.username || url.password) {
        throw new Error("Backend URL must not contain credentials.");
    }

    return (
        url.origin +
        url.pathname.replace(/\/+$/, "")
    );

}


// ===============================================
// AUTHENTICATION TOKEN RETRIEVAL
// ===============================================

function getAuthToken() {

    for (const key of defaults.tokenStorageKeys) {

        try {

            const value = localStorage.getItem(key);

            if (
                value &&
                value !== "null" &&
                value !== "undefined"
            ) {

                // Support either a raw JWT or a stored
                // Bearer-prefixed JWT.

                return value.replace(/^Bearer\s+/i, "").trim();

            }

        } catch (error) {

            console.warn(
                "Unable to read SMMARIA authentication storage:",
                error
            );

        }

    }

    return "";

}


// ===============================================
// AUTHENTICATION STATUS
// ===============================================

function isAuthenticated() {

    return Boolean(getAuthToken());

}


// ===============================================
// FINAL CONFIGURATION EXPORT
// ===============================================

export const SearchBackendConfig = Object.freeze({

    ...defaults,

    baseUrl: normalize(defaults.baseUrl),

    getUrl(path) {

        if (!this.baseUrl) {

            throw new Error(
                "SMMARIA Global Search backend is not configured."
            );

        }

        const cleanPath = String(path || "");

        return (
            this.baseUrl +
            (
                cleanPath.startsWith("/")
                    ? cleanPath
                    : "/" + cleanPath
            )
        );

    },

    getAuthToken,

    isAuthenticated

});
