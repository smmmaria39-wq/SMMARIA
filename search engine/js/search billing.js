import { SearchAPI } from "./search api.js";

const $ = id => document.getElementById(id);
const number = value => (Number(value) || 0).toLocaleString();
const money = value => `$${(Number(value) || 0).toFixed(2)}`;

let summary = null;
let initialized = false;

function setFeedback(message, type = "") {
  const el = $("smm-purchase-feedback");
  if (!el) return;
  el.textContent = message;
  el.dataset.type = type;
}

function renderSummary(data) {
  summary = data || {};
  const available = Number(summary.tokenBalance ?? summary.availableTokens ?? summary.remainingTokens ?? 0);
  const used = Number(summary.usedTokens ?? summary.totalUsedTokens ?? 0);
  const remaining = Number(summary.remainingTokens ?? available);
  $("smm-token-balance").textContent = number(available);
  $("smm-token-remaining").textContent = number(remaining);
  $("smm-token-used").textContent = number(used);
  $("smm-purchase-wallet-balance").textContent = money(summary.walletBalance ?? 0);

  const reward = summary.startupRewardReceived ?? summary.welcomeRewardReceived;
  $("smm-token-reward-note").textContent = reward
    ? "Your one-time 250-token welcome reward has been recorded."
    : "Eligible new users receive a one-time 250-token welcome reward.";
}

export async function refreshBilling() {
  try {
    const data = await SearchAPI.billingSummary();
    renderSummary(data);
    return data;
  } catch (error) {
    $("smm-token-balance").textContent = "Unavailable";
    $("smm-token-remaining").textContent = "—";
    $("smm-token-used").textContent = "—";
    $("smm-token-reward-note").textContent = error.message;
    return null;
  }
}

function updatePurchaseEstimate() {
  const tokens = Math.max(0, Number($("smm-purchase-amount").value) || 0);
  const cost = tokens / 1000 * 0.20;
  $("smm-purchase-cost").textContent = money(cost);
}

function openPurchase() {
  $("smm-purchase-modal").hidden = false;
  $("smm-purchase-amount").focus();
  updatePurchaseEstimate();
}

function closePurchase() {
  $("smm-purchase-modal").hidden = true;
  setFeedback("");
}

async function buyTokens() {
  const tokens = Number($("smm-purchase-amount").value);
  if (!Number.isInteger(tokens) || tokens < 1000 || tokens % 1000 !== 0) {
    setFeedback("Enter a whole number of tokens in multiples of 1,000.", "error");
    return;
  }
  const button = $("smm-confirm-purchase");
  button.disabled = true;
  button.textContent = "Processing…";
  setFeedback("Checking your SMMARIA wallet…");
  try {
    const result = await SearchAPI.purchaseTokens(tokens);
    setFeedback(result.message || `${number(tokens)} tokens purchased successfully.`, "success");
    await refreshBilling();
    await loadInvoices(false);
    setTimeout(closePurchase, 1100);
  } catch (error) {
    setFeedback(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Confirm purchase";
  }
}

function renderInvoices(data) {
  const host = $("smm-invoice-list");
  const rows = Array.isArray(data) ? data : (data?.invoices || data?.items || []);
  host.replaceChildren();
  host.hidden = false;
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "smm-invoice-empty";
    empty.textContent = "No search invoices yet.";
    host.append(empty);
    return;
  }
  rows.slice(0, 8).forEach(item => {
    const row = document.createElement("div");
    row.className = "smm-invoice-row";
    const label = document.createElement("span");
    label.textContent = item.description || item.type || "Search token activity";
    const detail = document.createElement("small");
    detail.textContent = item.createdAt ? new Date(item.createdAt).toLocaleString() : "Recent activity";
    const amount = document.createElement("strong");
    const tokens = Number(item.tokens ?? item.tokenAmount);
    amount.textContent = Number.isFinite(tokens) ? `${number(tokens)} tokens` : money(item.amount);
    row.append(label, detail, amount);
    host.append(row);
  });
}

async function loadInvoices(toggle = true) {
  const host = $("smm-invoice-list");
  if (toggle && !host.hidden) { host.hidden = true; return; }
  try {
    const data = await SearchAPI.invoices();
    renderInvoices(data);
  } catch (error) {
    host.replaceChildren();
    const message = document.createElement("p");
    message.className = "smm-invoice-empty";
    message.textContent = error.message || "Invoices are temporarily unavailable.";
    host.append(message);
    host.hidden = false;
  }
}

export function initBilling() {
  if (initialized) return;
  initialized = true;
  $("smm-open-purchase")?.addEventListener("click", openPurchase);
  $("smm-close-purchase")?.addEventListener("click", closePurchase);
  $("smm-purchase-modal")?.addEventListener("click", event => {
    if (event.target.id === "smm-purchase-modal") closePurchase();
  });
  $("smm-purchase-amount")?.addEventListener("input", updatePurchaseEstimate);
  $("smm-confirm-purchase")?.addEventListener("click", buyTokens);
  $("smm-open-invoices")?.addEventListener("click", () => loadInvoices(true));
  refreshBilling();
}

export function refreshBillingAfterSearch() {
  return refreshBilling();
}
