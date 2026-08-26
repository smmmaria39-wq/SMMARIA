// ===============================================
// Validators Utility
// Form validation helpers
// ===============================================

export const isRequired = (value) => value.trim() !== '' || 'This field is required';
export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Invalid email address';
export const isUrl = (value) => {
 try {
  new URL(value);
  return true;
 } catch {
  return 'Invalid URL format';
 }
};

// Usage: minLength(6) returns a function that validates the length
export const minLength = (len) => (value) => value.length >= len || `Must be at least ${len} characters`;

/**
 * Validates a form based on provided rules.
 * @param {HTMLFormElement} formElement - The form to validate
 * @param {Object} rules - An object where keys are input names and values are functions or arrays of functions
 * @returns {Object} - { isValid: boolean, errors: Object }
 */
export function validateForm(formElement, rules) {
 let isValid = true;
 const errors = {};
 
 Object.keys(rules).forEach(fieldName => {
  const input = formElement.querySelector(`[name="${fieldName}"]`);
  if (!input) return;
  
  const value = input.value;
  const fieldRules = Array.isArray(rules[fieldName]) ? rules[fieldName] : [rules[fieldName]];
  
  for (const rule of fieldRules) {
   const result = rule(value);
   
   if (result !== true) {
    isValid = false;
    errors[fieldName] = result;
    input.classList.add('input-error');
    break; // Stop checking rules for this field after the first error
   } else {
    input.classList.remove('input-error');
   }
  }
 });
 
 return { isValid, errors };
}