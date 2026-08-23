/**
 * Formats any input string into Uzbek phone format: +998 90 123 45 67
 * Restricts typing to only digits and maximum 9 national digits.
 */
export function formatUzPhone(value) {
  if (!value) return '+998 ';
  
  // Extract all digits
  let digits = value.replace(/\D/g, '');
  
  // If user starts with 998, strip it to get national 9 digits
  if (digits.startsWith('998')) {
    digits = digits.slice(3);
  }
  
  // Cap national digits to 9
  digits = digits.slice(0, 9);

  let formatted = '+998';
  if (digits.length > 0) {
    formatted += ' ' + digits.slice(0, 2);
  }
  if (digits.length >= 3) {
    formatted += ' ' + digits.slice(2, 5);
  }
  if (digits.length >= 6) {
    formatted += ' ' + digits.slice(5, 7);
  }
  if (digits.length >= 8) {
    formatted += ' ' + digits.slice(7, 9);
  }
  return formatted;
}

/**
 * Validates if the formatted phone has full 12 digits (starts with 998 + 9 digits).
 */
export function isValidUzPhone(value) {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('998');
}
