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
import { addPresence, removePresence, sellerSocketCount, sessionsOf } from './presence.js';
import { sellerRoom, sessionRoom } from './io.js';
import { logger } from '../utils/logger.js';

// Doc 07 §3: room:join / room:leave / chat:send / product:pin.
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
      };
      socket.emit('room:state', state);
      return state;
    }),
  );

  const leave = (sessionId) => {
    const entry = joined.get(sessionId);
    joined.delete(sessionId);
    socket.leave(sessionRoom(sessionId));
    socket.leave(sellerRoom(sessionId));
    const person = removePresence(sessionId, socket.id);
    // The seller's last connection to a live room went away: start the "seller gone" clock (doc 07 §8).
    if ((entry?.isSeller || person?.isSeller) && sellerSocketCount(sessionId) === 0) armSellerGrace(sessionId);
  };

  socket.on(
    'room:leave',
    handler(socket, async (payload) => {
      leave(sessionIdFrom(payload));
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
    for (const sessionId of new Set([...joined.keys(), ...sessionsOf(socket.id)])) leave(sessionId);
  });
}
