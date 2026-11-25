// Global Search API configuration.
// This service uses the authenticated SMMARIA session token (JWT).
// Never place Firebase service-account credentials or admin passwords here.
const defaults = {
  baseUrl: "https://YOUR-SEARCH-BACKEND.up.railway.app",
  timeoutMs: 20000,
  tokenStorageKeys: ["token", "authToken", "smmaria_token", "smmariaToken"],
  endpoints: {
    health: "/health",
    search: "/api/v1/search",
    platforms: "/api/v1/platforms",
    countries: "/api/v1/countries",
    billingSummary: "/api/v1/billing/summary",
    billingPurchase: "/api/v1/billing/purchase",
    billingInvoices: "/api/v1/billing/invoices"
  }
};

function normalize(value) {
  const v = String(value || "").trim();
  if (!v || v.includes("YOUR-SEARCH-BACKEND")) return "";
  let u;
  try { u = new URL(v); } catch { throw Error("Invalid backend URL"); }
  if (!["https:", "http:"].includes(u.protocol)) throw Error("Backend URL must use HTTP or HTTPS");
  return u.origin + u.pathname.replace(/\/+$/, "");
}

export const SearchBackendConfig = Object.freeze({
  ...defaults,
  baseUrl: normalize(defaults.baseUrl),
  getUrl(path) {
    if (!this.baseUrl) throw Error("Search backend is not configured. Add the Railway URL in backend config.js.");
    return this.baseUrl + (path.startsWith("/") ? path : "/" + path);
  },
  getAuthToken() {
    for (const key of this.tokenStorageKeys) {
      try {
        const value = localStorage.getItem(key);
        if (value && value !== "null" && value !== "undefined") return value;
      } catch {}
    }
    return "";
  }
});
