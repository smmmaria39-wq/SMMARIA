import { SearchBackendConfig as C } from "../config/backend config.js";

async function request(path, { method = "GET", params = {}, body, signal } = {}) {
  const url = new URL(C.getUrl(path));
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), C.timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });

  const headers = { Accept: "application/json" };
  const token = C.getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  try {
    const response = await fetch(url, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal, credentials: "same-origin"
    });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (response.status === 401) throw Error("Your SMMARIA session has expired. Please sign in again.");
    if (response.status === 403) throw Error(payload.message || payload.error || "You are not authorized to use this feature.");
    if (response.status === 402) throw Error(payload.message || "You do not have enough search tokens or wallet funds.");
    if (response.status === 429) throw Error("Search rate limit reached. Please wait and try again.");
    if (!response.ok) throw Error(payload.message || payload.error || `Search service returned HTTP ${response.status}.`);
    return payload;
  } catch (error) {
    if (error.name === "AbortError") throw Error("The request timed out or was cancelled.");
    if (error instanceof TypeError) throw Error("Cannot connect to the search backend. Check Railway and CORS settings.");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function unwrap(payload) { return payload?.data ?? payload; }
async function optionList(path) {
  const payload = unwrap(await request(path));
  const items = payload?.items ?? payload;
  if (!Array.isArray(items)) throw Error("Invalid options response");
  return items;
}

export const SearchAPI = {
  health: () => request(C.endpoints.health),
  platforms: () => optionList(C.endpoints.platforms),
  countries: () => optionList(C.endpoints.countries),
  async search(params, signal) {
    const payload = unwrap(await request(C.endpoints.search, {
      method: "POST",
      body: {
        username: params.q,
        category: params.category || "all",
        country: params.country || undefined,
        platforms: params.platform ? [params.platform] : undefined,
        page: params.page || 1
      },
      signal
    }));
    const results = payload?.results ?? payload?.items ?? [];
    if (!Array.isArray(results)) throw Error("Invalid search response: expected a results array");
    return {
      ...payload,
      results,
      total: Number(payload.total ?? results.length),
      page: Number(payload.page) || params.page,
      limit: Number(payload.limit) || params.limit
    };
  },
  billingSummary: () => request(C.endpoints.billingSummary).then(unwrap),
  purchaseTokens: tokens => request(C.endpoints.billingPurchase, { method: "POST", body: { tokens } }).then(unwrap),
  invoices: () => request(C.endpoints.billingInvoices).then(unwrap)
};
