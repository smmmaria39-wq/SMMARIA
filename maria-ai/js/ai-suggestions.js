export const SUGGESTIONS = [
  {title:'Check my wallet',description:'Understand your balance and payment activity.',prompt:'Help me understand my current wallet balance and recent payments.'},
  {title:'Find an order',description:'Look up an order and explain its status.',prompt:'Help me find my recent orders and explain their statuses.'},
  {title:'Explore services',description:'Find a service and understand its requirements.',prompt:'Help me explore the available SMMARIA services.'},
  {title:'How do I use SMMARIA?',description:'Get a step-by-step guide to the panel.',prompt:'Give me a beginner-friendly guide to using the SMMARIA panel.'}
];
export function renderSuggestions(container,onSelect){
  container.innerHTML=SUGGESTIONS.map((s,i)=>`<button class="ai-suggestion" data-prompt-index="${i}"><strong>${s.title}</strong><span>${s.description}</span></button>`).join('');
  container.querySelectorAll('[data-prompt-index]').forEach(btn=>btn.addEventListener('click',()=>onSelect(SUGGESTIONS[Number(btn.dataset.promptIndex)].prompt)));
}
