export const SUGGESTIONS = [
  { title: 'Understand my wallet', description: 'Find the wallet page and its available features.', prompt: 'Explain the Wallet page and what I can do there.' },
  { title: 'Find my orders', description: 'Learn where to view orders and their statuses.', prompt: 'How do I find and understand my orders?' },
  { title: 'Explore services', description: 'Learn how the service catalogue is organised.', prompt: 'Explain how the Services page works.' },
  { title: 'Get panel guidance', description: 'Search the SMMARIA documentation and pages.', prompt: 'Give me an introduction to the SMMARIA panel based on its documentation.' }
];

export function renderSuggestions(container, onSelect) {
  if (!container) return;
  container.innerHTML = SUGGESTIONS.map((item, index) =>
    `<button class="ai-suggestion" data-prompt-index="${index}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.description)}</span></button>`
  ).join('');

  container.querySelectorAll('[data-prompt-index]').forEach(button => {
    button.addEventListener('click', () => {
      const item = SUGGESTIONS[Number(button.dataset.promptIndex)];
      if (item) onSelect(item.prompt);
    });
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}
