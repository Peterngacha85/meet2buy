import crypto from 'node:crypto';
import { Store, publicStore } from '../models/Store.js';
import { Product } from '../models/Product.js';
import { RoomSession } from '../models/RoomSession.js';
import { createRoomToken } from '../services/livekit.js';
import {
  endSession,
  loadLiveSession,
  recentMessages,
  sessionView,
  startSession,
} from '../services/roomService.js';
import { counterView, myQueueState, queueList } from '../services/queueService.js';
import { presenceOf } from '../sockets/presence.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/respond.js';

const shelf = (storeId) => Product.find({ store: storeId, isVisible: true }).sort({ createdAt: -1 });

async function sellerToken(store, session, user) {
  return createRoomToken({ room: session.livekitRoom, identity: user.id, name: store.name, role: 'seller' });
}

// POST /api/rooms/start — "Go live". Returns the session and the seller's LiveKit token.
export async function start(req, res) {
  const session = await startSession(req.store);
  const livekit = await sellerToken(req.store, session, req.user);
  ok(res, { session: await sessionView(session), livekit }, 201);
}

// POST /api/rooms/end
export async function end(req, res) {
  const live = await RoomSession.findOne({ store: req.store._id, status: 'live' });
  if (!live) throw new AppError(409, 'You are not live');
  await endSession(live._id, 'seller');
  ok(res, null);
}

// GET /api/rooms/mine — the seller's live control page: current session (if any) and shelf
export async function mine(req, res) {
  const live = await RoomSession.findOne({ store: req.store._id, status: 'live' });
  ok(res, {
    session: live ? await sessionView(live) : null,
    livekit: live ? await sellerToken(req.store, live, req.user) : null,
    products: await shelf(req.store._id),
    presence: live ? presenceOf(live.id) : null,
  });
}

// GET /api/rooms/:storeSlug — what a shopper needs to walk into the room
export async function getRoom(req, res) {
  const store = await Store.findOne({ slug: req.params.storeSlug });
  if (!store || store.status !== 'approved') throw new AppError(404, 'This shop is not open in the mall');

  const live = store.isLive ? await RoomSession.findOne({ store: store._id, status: 'live' }) : null;
  ok(res, {
    store: publicStore(store),
    session: live ? await sessionView(live) : null,
    products: await shelf(store._id),
    presence: live ? presenceOf(live.id) : null,
    isOwner: Boolean(req.user && store.owner.equals(req.user._id)),
  });
}

// POST /api/rooms/:sessionId/token — guests and buyers get watch-only tokens; the shop owner gets publish rights
export async function token(req, res) {
  const session = await loadLiveSession(req.params.sessionId);
  const store = await Store.findById(session.store);
  if (req.user && store.owner.equals(req.user._id)) {
    return ok(res, { livekit: await sellerToken(store, session, req.user), role: 'seller' });
  }
  const identity = req.user ? req.user.id : `guest_${crypto.randomBytes(6).toString('hex')}`;
  const name = req.user?.name ?? 'Guest';
  // The buyer at the counter may publish their mic/camera (used if they reconnect while at the counter).
  const role = req.user && session.counterBuyer?.equals(req.user._id) ? 'counter' : 'viewer';
  const livekit = await createRoomToken({ room: session.livekitRoom, identity, name, role });
  ok(res, { livekit, role });
}

// GET /api/rooms/:sessionId/queue — the seller sees the full list; a buyer sees their own place
export async function queue(req, res) {
  const session = await loadLiveSession(req.params.sessionId);
  const store = await Store.findById(session.store).select('owner');
  const counter = await counterView(session._id);
  if (store.owner.equals(req.user._id)) return ok(res, { entries: await queueList(session._id), counter });
  ok(res, { mine: await myQueueState(session._id, req.user.id), counter });
}

// GET /api/rooms/:sessionId/messages — last 50 chat messages
export async function messages(req, res) {
  const session = await loadLiveSession(req.params.sessionId);
  ok(res, { messages: await recentMessages(session._id) });
}
