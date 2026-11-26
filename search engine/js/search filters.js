const ids = {
  platform: "smm-platform",
  country: "smm-country",
  verification: "smm-verification",
  sort: "smm-sort",
  limit: "smm-limit"
};

export const getFilters = () => Object.fromEntries(
  Object.entries(ids).map(([key, id]) => [key, document.getElementById(id)?.value || ""])
);

function optionDetails(item) {
  if (typeof item === "string") return { label: item, value: item, disabled: false };
  if (!item || typeof item !== "object") return null;
  const value = item.id || item.code || item.value || item.name;
  const label = item.name || item.label || item.displayName || item.display_name || value;
  if (!label || !value) return null;
  const configured = item.enabled ?? item.available ?? true;
  const status = item.credentialsConfigured === false
    ? " — credentials needed"
    : item.enabled === false
      ? " — public lookup unavailable"
      : "";
  return { label: `${label}${status}`, value, disabled: !configured };
}

export function populate(id, items) {
  const select = document.getElementById(id);
  if (!select) return;
  const first = select.options[0]?.cloneNode(true);
  select.replaceChildren();
  if (first) select.append(first);

  (Array.isArray(items) ? items : []).forEach(item => {
    const details = optionDetails(item);
    if (!details) return;
    const option = document.createElement("option");
    option.value = details.value;
    option.textContent = details.label;
    option.disabled = details.disabled;
    select.append(option);
  });
}

export function setOptionsError(id, message) {
  const select = document.getElementById(id);
  if (!select) return;
  const first = select.options[0]?.cloneNode(true);
  select.replaceChildren();
  if (first) {
    first.textContent = `${first.textContent} (unavailable)`;
    select.append(first);
  }
  select.title = message;
}

export function bindFilters(fn) {
  Object.values(ids).forEach(id => document.getElementById(id)?.addEventListener("change", fn));
  document.getElementById("smm-clear-filters")?.addEventListener("click", () => {
    Object.entries(ids).forEach(([key, id]) => {
      const element = document.getElementById(id);
      if (element) element.value = key === "sort" ? "relevance" : key === "limit" ? "10" : "";
    });
    fn();
  });
}
