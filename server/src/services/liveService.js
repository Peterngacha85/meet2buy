import { getIo } from '../sockets/io.js';

// Fewer page refreshes (Nov 2026): whenever data changes, every open page hears which kind of data
// changed — `data:changed { topics: ['orders', 'payouts'] }` — and quietly refetches what it shows
// through the normal (permission-checked) API. Only topic names are sent, never data.
// Changes within a short window are merged into one event, so a burst of updates is one refetch.

const WINDOW_MS = 250;
let pending = new Set();
let timer = null;

/** Topics: orders, payouts, support, products, store, requests, sellers, rooms, users, settings, mall. */
export function changed(...topics) {
  for (const t of topics.flat()) pending.add(t);
  if (timer) return;
  timer = setTimeout(() => {
    const list = [...pending];
    pending = new Set();
    timer = null;
    getIo()?.emit('data:changed', { topics: list });
  }, WINDOW_MS);
  timer.unref?.();
}

/** Router middleware: after a successful change (not a GET) through this router, announce `topics`. */
export const announces =
  (...topics) =>
  (req, res, next) => {
    if (req.method !== 'GET') {
      res.on('finish', () => {
        if (res.statusCode < 400) changed(topics);
      });
    }
    next();
  };
