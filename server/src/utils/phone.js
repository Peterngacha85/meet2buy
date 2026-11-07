// Kenyan mobile numbers in the format Daraja expects: 2547XXXXXXXX or 2541XXXXXXXX.
const NORMALISED = /^254[17]\d{8}$/;

/**
 * Normalise a Kenyan mobile number to 2547XXXXXXXX / 2541XXXXXXXX.
 * Accepts 07…, 01…, 7…, 1…, 254…, +254…, with spaces or dashes.
 * Returns null if the number is not a valid Kenyan mobile number.
 */
export function normalizePhone(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  let digits = String(input).replace(/[\s\-()]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;

  if (digits.startsWith('254')) {
    // already international
  } else if (digits.startsWith('0') && digits.length === 10) {
    digits = `254${digits.slice(1)}`;
  } else if (digits.length === 9) {
    digits = `254${digits}`;
  }

  return NORMALISED.test(digits) ? digits : null;
}

export const isValidPhone = (value) => NORMALISED.test(value);
