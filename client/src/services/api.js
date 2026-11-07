import axios from 'axios';

// Dev: '' (Vite proxies /api). Prod: VITE_API_URL, e.g. https://api.meet2buy.co.ke
const API_URL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  timeout: 20_000,
});

/** Unwrap the { success, data } envelope. */
export const unwrap = (promise) => promise.then((res) => res.data.data);

/** Turn an axios error into { message, fieldErrors: { field: message } }. */
export function apiError(err) {
  const body = err?.response?.data;
  const fieldErrors = {};
  for (const e of body?.errors ?? []) {
    if (e.field && !fieldErrors[e.field]) fieldErrors[e.field] = e.message;
  }
  let message = body?.message;
  if (!message) {
    message = err?.response
      ? 'Something went wrong. Please try again.'
      : 'Cannot reach Meet2buy. Check your internet connection.';
  }
  return { message, fieldErrors, status: err?.response?.status };
}
