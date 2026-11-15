import { Order } from '../models/Commerce.js';
import { PresentationRequest } from '../models/PresentationRequest.js';
import { Store } from '../models/Store.js';
import { emitTo, userRoom } from '../sockets/io.js';

// Live notifications (toast + badges). Every logged-in socket joins user:<id>; admins also join "admins".
// Payload: { type, title, body, link } — the client shows a toast and refreshes its badge counts.

export const ADMINS_ROOM = 'admins';

export function notifyUser(userId, notification) {
  emitTo(userRoom(String(userId)), 'notify', { ...notification, at: new Date().toISOString() });
}

export function notifyAdmins(notification) {
  emitTo(ADMINS_ROOM, 'notify', { ...notification, at: new Date().toISOString() });
}

/** Tell a shop's owner something happened in their shop. */
export async function notifyStoreOwner(storeId, notification) {
  const store = await Store.findById(storeId).select('owner');
  if (store) notifyUser(store.owner, notification);
}

/** Badge counts for the sidebar. */
export async function badgeCounts(user) {
  if (user.role === 'admin') {
    return { pendingSellers: await Store.countDocuments({ status: 'pending' }) };
  }
  if (user.role === 'seller') {
    const store = await Store.findOne({ owner: user._id }).select('_id');
    if (!store) return {};
    const [requests, orders] = await Promise.all([
      PresentationRequest.countDocuments({ store: store._id, status: 'open' }),
      Order.countDocuments({ store: store._id, status: 'paid' }), // paid, not yet shipped
    ]);
    return { requests, orders };
  }
  return {};
}
