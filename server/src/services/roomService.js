import { env } from '../config/env.js';
import { RoomSession, publicSession } from '../models/RoomSession.js';
import { ChatMessage, CHAT_MAX_LENGTH, publicMessage } from '../models/ChatMessage.js';
import { Store } from '../models/Store.js';
import { Product } from '../models/Product.js';
import { QueueEntry } from '../models/QueueEntry.js';
import { PresentationRequest } from '../models/PresentationRequest.js';
import { notifyUser } from './notifyService.js';
import { AppError } from '../utils/AppError.js';
import { maskContacts } from '../utils/maskContacts.js';
import { logger } from '../utils/logger.js';
import { closeLiveKitRoom, isLiveKitConfigured } from './livekit.js';
import { emitTo, leaveAll, sessionRoom } from '../sockets/io.js';
import { clearPresence, peakOf } from '../sockets/presence.js';

// The life of a live room session (doc 07). REST controllers and socket handlers both call these.

export const RECENT_MESSAGES = 50;

export const END_REASONS = {
  seller: 'The seller has closed the room',
  seller_gone: 'The seller lost their connection and the room has closed',
  suspended: 'This shop has been closed by Meet2buy',
  admin: 'This room was closed by Meet2buy',
  account_deleted: 'This shop has closed',
};

/** Start a live session for an approved shop, or return the one already running (e.g. after a page reload). */
export async function startSession(store) {
  if (!isLiveKitConfigured()) {
    throw new AppError(503, 'Live video is not set up yet. Add the LiveKit keys to the server settings.');
  }
  if (store.status !== 'approved') throw new AppError(403, 'Your shop must be approved before you can go live');

  const existing = await RoomSession.findOne({ store: store._id, status: 'live' });
  if (existing) return existing;

  const session = new RoomSession({ store: store._id });
  session.livekitRoom = `store_${store._id}_${session._id}`;
  try {
    await session.save();
  } catch (err) {
    // Two "Go live" clicks at once: the unique live-session index lets only one through.
    if (err.code === 11000) return RoomSession.findOne({ store: store._id, status: 'live' });
    throw err;
  }
  await Store.updateOne({ _id: store._id }, { isLive: true, currentSession: session._id });
  await notifyDemoRequesters(store).catch((err) => logger.warn(`demo requester notify failed: ${err.message}`));
  // The seller may already be connected to the socket from before; they reconnect via room:join.
  armSellerGrace(session._id.toString());
  return session;
}

/** Shoppers who asked for a demo while the shop was closed hear the moment it opens. */
async function notifyDemoRequesters(store) {
  const requests = await PresentationRequest.find({ store: store._id, status: 'open' }).populate('product', 'name');
  const byBuyer = new Map();
  for (const r of requests) if (!byBuyer.has(r.buyer.toString())) byBuyer.set(r.buyer.toString(), r);
  for (const [buyerId, r] of byBuyer) {
    notifyUser(buyerId, {
      type: 'shop_live',
      title: `${store.name} is live now`,
      body: r.product?.name ? `Walk in and see the ${r.product.name} you asked about.` : 'Walk in for the demonstration you asked for.',
      link: `/shop/${store.slug}/live`,
      action: 'Walk in',
    });
  }
}

/** End a session once (later calls are no-ops). Tells everyone in the room and closes the LiveKit room. */
export async function endSession(sessionId, reason = 'seller') {
  const id = String(sessionId);
  disarmSellerGrace(id);
  const session = await RoomSession.findOneAndUpdate(
    { _id: id, status: 'live' },
    { status: 'ended', endedAt: new Date(), endReason: reason, counterBuyer: null },
    { returnDocument: 'after' },
  );
  if (!session) return null;

  session.peakViewers = Math.max(session.peakViewers, peakOf(id));
  const finishedAt = new Date();
  await Promise.all([
    session.save(),
    // Doc 07 §4.9: whoever was at the counter was served; everyone still waiting is cancelled.
    QueueEntry.updateMany({ session: id, status: 'at_counter' }, { status: 'done', active: false, finishedAt }),
    QueueEntry.updateMany({ session: id, status: 'waiting' }, { status: 'cancelled', active: false, finishedAt }),
    Store.updateOne({ _id: session.store, currentSession: session._id }, { isLive: false, currentSession: null }),
  ]);

  emitTo(sessionRoom(id), 'room:closed', { reason, message: END_REASONS[reason] ?? END_REASONS.seller });
  leaveAll(sessionRoom(id));
  clearPresence(id);
  await closeLiveKitRoom(session.livekitRoom);
  logger.info(`room session ${id} ended (${reason})`);
  return session;
}

/** End whatever session a shop has live (suspension, account deletion). */
export async function endStoreSession(storeId, reason) {
  const live = await RoomSession.findOne({ store: storeId, status: 'live' }).select('_id');
  if (live) await endSession(live._id, reason);
}

// ---- Seller gone too long → end the session (doc 07 §8) ----

const graceTimers = new Map();

export function armSellerGrace(sessionId) {
  disarmSellerGrace(sessionId);
  const timer = setTimeout(() => {
    graceTimers.delete(sessionId);
    endSession(sessionId, 'seller_gone').catch((err) => logger.error('auto-end failed', err));
  }, env.SELLER_GRACE_SECONDS * 1000);
  timer.unref?.();
  graceTimers.set(sessionId, timer);
}

export function disarmSellerGrace(sessionId) {
  const timer = graceTimers.get(sessionId);
  if (timer) clearTimeout(timer);
  graceTimers.delete(sessionId);
}

/** After a server restart nobody is connected yet: give each live seller the grace period to come back. */
export async function resumeLiveSessions() {
  const live = await RoomSession.find({ status: 'live' }).select('_id');
  for (const s of live) armSellerGrace(s._id.toString());
  if (live.length) logger.info(`waiting for ${live.length} live seller(s) to reconnect`);
}

// ---- Room contents ----

export async function loadLiveSession(sessionId) {
  const session = await RoomSession.findById(sessionId).catch(() => null);
  if (!session || session.status !== 'live') throw new AppError(404, 'This room is closed');
  return session;
}

export async function pinnedProductOf(session) {
  if (!session.pinnedProduct) return null;
  return Product.findOne({ _id: session.pinnedProduct, isVisible: true });
}

export async function sessionView(session) {
  return publicSession(session, await pinnedProductOf(session));
}

export async function recentMessages(sessionId) {
  const messages = await ChatMessage.find({ session: sessionId }).sort({ createdAt: -1 }).limit(RECENT_MESSAGES);
  return messages.reverse().map(publicMessage);
}

/** The seller pins a product from their shelf (or clears it with null). Returns the product or null. */
export async function pinProduct(session, productId) {
  let product = null;
  if (productId) {
    product = await Product.findOne({ _id: productId, store: session.store, isVisible: true }).catch(() => null);
    if (!product) throw new AppError(404, 'That product is not on your shelf');
  }
  session.pinnedProduct = product?._id ?? null;
  await session.save();
  emitTo(sessionRoom(session.id), 'product:pinned', { product: product?.toJSON() ?? null });
  if (product) await postSystemMessage(session.id, `The seller is showing ${product.name}`);
  return product;
}

export async function postSystemMessage(sessionId, body) {
  const message = await ChatMessage.create({ session: sessionId, type: 'system', body });
  emitTo(sessionRoom(String(sessionId)), 'chat:message', publicMessage(message));
  return message;
}

/** Save and broadcast a chat message. Contacts are masked first. */
export async function postChatMessage(sessionId, user, isSeller, rawBody) {
  const body = typeof rawBody === 'string' ? rawBody.replace(/\s+/g, ' ').trim() : '';
  if (!body) throw new AppError(400, 'Type a message first');
  if (body.length > CHAT_MAX_LENGTH) throw new AppError(400, `Messages can be up to ${CHAT_MAX_LENGTH} characters`);

  const message = await ChatMessage.create({
    session: sessionId,
    sender: user._id,
    senderName: user.name,
    isSeller,
    type: 'text',
    body: maskContacts(body),
  });
  const view = publicMessage(message);
  emitTo(sessionRoom(String(sessionId)), 'chat:message', view);
  return view;
}
