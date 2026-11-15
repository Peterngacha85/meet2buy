import { Order } from '../models/Commerce.js';
import { PresentationRequest } from '../models/PresentationRequest.js';
import { Store } from '../models/Store.js';
import { QueueEntry } from '../models/QueueEntry.js';
import { emitTo, userRoom } from '../sockets/io.js';
import { userPresent } from '../sockets/presence.js';

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

/** The seller invites a shopper who asked for a demo into the live room. Stays on screen until acted on. */
export function demoInvite(store, request) {
  const productName = request.product?.name;
  const query = request.product ? `?ask=${request.product._id ?? request.product}` : '?ask=';
  return {
    type: 'demo_invite',
    title: `${store.name} is ready to show you ${productName ? `the ${productName}` : 'your demo'}`,
    body: 'The salesperson is live now. Join the queue and they will call you to the counter.',
    link: `/shop/${store.slug}/live${query}`,
    action: 'Join the demo',
    sticky: true,
  };
}

export const INVITE_VALID_MS = 30 * 60_000;

/** Someone just opened Meet2buy: hand them any invite from a shop that is still live (they may have been offline). */
export async function deliverPendingInvites(userId) {
  const since = new Date(Date.now() - INVITE_VALID_MS);
  const requests = await PresentationRequest.find({ buyer: userId, status: { $ne: 'closed' }, invitedAt: { $gte: since } })
    .sort({ invitedAt: -1 })
    .limit(3)
    .populate('product', 'name');
  for (const r of requests) {
    const store = await Store.findById(r.store).select('name slug isLive currentSession');
    if (!store?.isLive || !store.currentSession?.equals(r.invitedSession)) continue;
    const sessionId = store.currentSession.toString();
    // Already walked in or queueing: nothing to remind them of.
    if (userPresent(sessionId, String(userId))) continue;
    if (await QueueEntry.exists({ session: sessionId, buyer: userId, active: true })) continue;
    notifyUser(userId, demoInvite(store, r));
  }
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
