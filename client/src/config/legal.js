// Shown on /terms, /privacy and receipts. Set in client/.env (see .env.example).
export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || '';
export const SUPPORT_PHONE = import.meta.env.VITE_SUPPORT_PHONE || '';
// Keep in step with server/src/config/legal.js TERMS_VERSION.
export const TERMS_UPDATED = '16 November 2026';
export const DEVELOPER = { name: 'Fastweb Technologies', url: 'https://fastweb.co.ke' };
