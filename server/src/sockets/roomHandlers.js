import mongoose from 'mongoose';
import { Store } from '../models/Store.js';
import {
  armSellerGrace,
  disarmSellerGrace,
  loadLiveSession,
  pinProduct,
  postChatMessage,
  recentMessages,
  sessionView,
} from '../services/roomService.js';
import {
  buyerLeftRoom,
  callNext,
  counterView,
  endCounter,
  joinQueue,
  leaveQueue,
  myQueueState,
  queueList,
  skip,
  waitingCount,
} from '../services/queueService.js';
import { createOffer, declineOffer, openOffersFor } from '../services/offerService.js';
import { addPresence, presenceOf, removePresence, sellerSocketCount, sessionsOf, userPresent } from './presence.js';
import { sellerRoom, sessionRoom } from './io.js';
import { logger } from '../utils/logger.js';

// Doc 07 §3: room:join / room:leave / chat:send / product:pin, and the queue:* events.
// Every handler answers through the ack callback: { ok: true, ... } or { ok: false, error }.

const CHAT_INTERVAL_MS = 1000;

function handler(socket, fn) {
  return async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      reply({ ok: true, ...((await fn(payload ?? {})) ?? {}) });
    } catch (err) {
      if (!err.isOperational) logger.error('socket handler failed', err);
      reply({ ok: false, error: err.isOperational ? err.message : 'Something went wrong. Please try again.' });
    }
  };
}

class SocketError extends Error {
  constructor(message) {
    super(message);
    this.isOperational = true;
  }
}

function sessionIdFrom(payload) {
  const id = payload.sessionId;
  if (typeof id !== 'string' || !mongoose.isValidObjectId(id)) throw new SocketError('Invalid room');
  return id;
}

export function registerRoomHandlers(socket) {
  const { user } = socket.data;
  // sessionId -> { isSeller } for rooms this socket has joined
  const joined = new Map();
  let lastChatAt = 0;

  const requireJoined = (sessionId) => {
    const entry = joined.get(sessionId);
    if (!entry) throw new SocketError('Join the room first');
    if (entry.observer) throw new SocketError('You are watching as an observer');
    return entry;
  };

  socket.on(
    'room:join',
    handler(socket, async (payload) => {
      const sessionId = sessionIdFrom(payload);
      const session = await loadLiveSession(sessionId).catch(() => {
        throw new SocketError('This room is closed');
      });
      const store = await Store.findById(session.store).select('owner name');
      const isSeller = Boolean(user && store.owner.equals(user._id));

      // Admin review: hears every event (chat, queue, counter), invisible and not counted as a shopper.
      if (payload.observe && user?.role === 'admin' && !isSeller) {
        socket.join(sessionRoom(sessionId));
        socket.join(sellerRoom(sessionId));
        joined.set(sessionId, { isSeller: false, observer: true });
        const state = {
          session: await sessionView(session),
          presence: presenceOf(sessionId),
          recentMessages: await recentMessages(session._id),
          isSeller: false,
          isObserver: true,
          canChat: false,
          counter: await counterView(session._id),
          queueLength: await waitingCount(session._id),
          queue: await queueList(session._id),
        };
        socket.emit('room:state', state);
        return state;
      }

      socket.join(sessionRoom(sessionId));
      if (isSeller) {
        socket.join(sellerRoom(sessionId));
        disarmSellerGrace(sessionId);
      }
      joined.set(sessionId, { isSeller });
      const presence = addPresence(sessionId, socket.id, {
        userId: user?.id ?? null,
        name: isSeller ? store.name : (user?.name ?? 'Guest'),
        avatar: user?.avatar ?? null,
        isSeller,
      });

      const state = {
        session: await sessionView(session),
        presence,
        recentMessages: await recentMessages(session._id),
        isSeller,
        canChat: Boolean(user),
        counter: await counterView(session._id),
        queueLength: await waitingCount(session._id),
        // The seller gets the whole queue; a logged-in buyer gets their own place.
        ...(isSeller ? { queue: await queueList(session._id) } : {}),
        ...(!isSeller && user
          ? { myQueue: await myQueueState(session._id, user.id), myOffers: await openOffersFor(session._id, user._id) }
          : {}),
      };
      socket.emit('room:state', state);
      return state;
    }),
  );

  const leave = (sessionId, { explicit }) => {
    const entry = joined.get(sessionId);
    joined.delete(sessionId);
    socket.leave(sessionRoom(sessionId));
    socket.leave(sellerRoom(sessionId));
    if (entry?.observer) return; // never in presence or the queue
    const person = removePresence(sessionId, socket.id);
    const wasSeller = entry?.isSeller || person?.isSeller;
    // The seller's last connection to a live room went away: start the "seller gone" clock (doc 07 §8).
    if (wasSeller && sellerSocketCount(sessionId) === 0) armSellerGrace(sessionId);
    // A buyer who walks out loses their place in the queue (a dropped connection gets a short grace period).
    if (!wasSeller && user && !userPresent(sessionId, user.id)) buyerLeftRoom(sessionId, user.id, { immediate: explicit });
  };

  socket.on(
    'room:leave',
    handler(socket, async (payload) => {
      leave(sessionIdFrom(payload), { explicit: true });
    }),
  );

  // ---- Queue & counter (doc 07 §4) ----

  const requireBuyer = (sessionId) => {
    if (!user) throw new SocketError('Log in to join the queue');
    if (requireJoined(sessionId).isSeller) throw new SocketError('You are the seller in this room');
  };
  const requireSeller = (sessionId) => {
    if (!requireJoined(sessionId).isSeller) throw new SocketError('Only the seller can do this');
  };

  socket.on(
    'queue:join',
    handler(socket, async (payload) => {
      const sessionId = sessionIdFrom(payload);
      requireBuyer(sessionId);
      const productId = payload.productId ?? null;
      if (productId !== null && !mongoose.isValidObjectId(productId)) throw new SocketError('Invalid product');
      return { mine: await joinQueue(sessionId, user, { productId, note: payload.note }) };
    }),
  );

  socket.on(
    'queue:leave',
    handler(socket, async (payload) => {
      const sessionId = sessionIdFrom(payload);
      requireBuyer(sessionId);
      await leaveQueue(sessionId, user._id, 'left');
    }),
  );

  socket.on(
    'queue:callNext',
    handler(socket, async (payload) => {
      const sessionId = sessionIdFrom(payload);
      requireSeller(sessionId);
      return { counter: await callNext(sessionId) };
    }),
  );

  socket.on(
    'queue:endCounter',
    handler(socket, async (payload) => {
      const sessionId = sessionIdFrom(payload);
      requireSeller(sessionId);
      await endCounter(sessionId);
    }),
  );

  // ---- Offers (doc 07): the seller sends a custom price; the buyer pays it at checkout or declines ----

  socket.on(
    'offer:create',
    handler(socket, async (payload) => {
      const sessionId = sessionIdFrom(payload);
      requireSeller(sessionId);
      if (!mongoose.isValidObjectId(payload.buyerId) || !mongoose.isValidObjectId(payload.productId)) {
        throw new SocketError('Choose a shopper and a product');
      }
      const offer = await createOffer(sessionId, {
        buyerId: payload.buyerId,
        productId: payload.productId,
        variant: payload.variant,
        quantity: Number(payload.quantity),
        price: Number(payload.price),
      });
      return { offer };
    }),
  );

  socket.on(
    'offer:decline',
    handler(socket, async (payload) => {
      if (!user) throw new SocketError('Log in first');
      if (!mongoose.isValidObjectId(payload.offerId)) throw new SocketError('Invalid offer');
      await declineOffer(user, payload.offerId);
    }),
  );

  socket.on(
    'queue:skip',
    handler(socket, async (payload) => {
      const sessionId = sessionIdFrom(payload);
      requireSeller(sessionId);
      if (!mongoose.isValidObjectId(payload.entryId)) throw new SocketError('Invalid queue entry');
      await skip(sessionId, payload.entryId);
    }),
  );

  socket.on(
    'chat:send',
    handler(socket, async (payload) => {
      if (!user) throw new SocketError('Log in to chat with the seller');
      const sessionId = sessionIdFrom(payload);
      const { isSeller } = requireJoined(sessionId);
      const now = Date.now();
      if (now - lastChatAt < CHAT_INTERVAL_MS) throw new SocketError('Slow down a little');
      lastChatAt = now;
      await loadLiveSession(sessionId);
      return { message: await postChatMessage(sessionId, user, isSeller, payload.body) };
    }),
  );

  socket.on(
    'product:pin',
    handler(socket, async (payload) => {
      const sessionId = sessionIdFrom(payload);
      if (!requireJoined(sessionId).isSeller) throw new SocketError('Only the seller can show products');
      const productId = payload.productId ?? null;
      if (productId !== null && !mongoose.isValidObjectId(productId)) throw new SocketError('Invalid product');
      const session = await loadLiveSession(sessionId);
      const product = await pinProduct(session, productId);
      return { product: product?.toJSON() ?? null };
    }),
  );

  socket.on('disconnect', () => {
    for (const sessionId of new Set([...joined.keys(), ...sessionsOf(socket.id)])) leave(sessionId, { explicit: false });
  });
}
