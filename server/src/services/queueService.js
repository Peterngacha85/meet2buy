import { QueueEntry, QUEUE_NOTE_MAX } from '../models/QueueEntry.js';
import { Product } from '../models/Product.js';
import { Settings } from '../models/Settings.js';
import { AppError } from '../utils/AppError.js';
import { maskContacts } from '../utils/maskContacts.js';
import { logger } from '../utils/logger.js';
import { setCounterPublish } from './livekit.js';
import { loadLiveSession, pinProduct, postSystemMessage } from './roomService.js';
import { emitTo, sellerRoom, sessionRoom, userRoom } from '../sockets/io.js';
import { userPresent } from '../sockets/presence.js';

// The queue and the counter (doc 07 §4). Like waiting at a shop counter: oldest first, one at a time.

// A buyer whose connection drops keeps their place this long (a page refresh must not cost the spot).
export const QUEUE_GRACE_MS = 20_000;

// Queue changes for one session run one after another, so two quick "Call next" taps can't race.
const locks = new Map();
function withLock(sessionId, fn) {
  const prev = locks.get(sessionId) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(sessionId, tail);
  tail.then(() => locks.get(sessionId) === tail && locks.delete(sessionId));
  return run;
}

const PRODUCT_FIELDS = 'name price images stock';

function entryView(e) {
  const p = e.product && e.product.name ? e.product : null;
  return {
    id: e._id.toString(),
    buyer: { id: e.buyer.toString(), name: e.buyerName },
    product: p ? { id: p._id.toString(), name: p.name, price: p.price, images: p.images, stock: p.stock } : null,
    note: e.note,
    status: e.status,
    createdAt: e.createdAt,
    calledAt: e.calledAt,
  };
}

async function activeEntries(sessionId) {
  return QueueEntry.find({ session: sessionId, active: true }).sort({ createdAt: 1 }).populate('product', PRODUCT_FIELDS);
}

async function timeLimitMinutes() {
  return (await Settings.getGlobal()).counterTimeLimitMinutes;
}

/** Who is at the counter, for everyone in the room. */
export async function counterView(sessionId) {
  const e = await QueueEntry.findOne({ session: sessionId, status: 'at_counter' }).populate('product', PRODUCT_FIELDS);
  if (!e) return null;
  const v = entryView(e);
  return { entryId: v.id, buyer: v.buyer, product: v.product, calledAt: v.calledAt, timeLimitMinutes: await timeLimitMinutes() };
}

export const waitingCount = (sessionId) => QueueEntry.countDocuments({ session: sessionId, status: 'waiting' });

/** The seller's full list: who is at the counter and who is waiting. */
export async function queueList(sessionId) {
  return (await activeEntries(sessionId)).map(entryView);
}

/** One buyer's place: { status: 'waiting', position, total } | { status: 'at_counter' } | { status: null, total }. */
export async function myQueueState(sessionId, userId) {
  const entries = await activeEntries(sessionId);
  const waiting = entries.filter((e) => e.status === 'waiting');
  const mine = entries.find((e) => e.buyer.toString() === userId);
  if (!mine) return { status: null, total: waiting.length };
  if (mine.status === 'at_counter') return { status: 'at_counter', entryId: mine.id, total: waiting.length };
  return {
    status: 'waiting',
    entryId: mine.id,
    position: waiting.findIndex((e) => e.id === mine.id) + 1,
    total: waiting.length,
    product: entryView(mine).product,
  };
}

/** After every change: the seller gets the full list, each waiting buyer their position, the room the queue length. */
async function broadcast(sessionId) {
  const entries = await activeEntries(sessionId);
  const waiting = entries.filter((e) => e.status === 'waiting');
  emitTo(sellerRoom(sessionId), 'queue:updated', { sessionId, entries: entries.map(entryView) });
  waiting.forEach((e, i) =>
    emitTo(userRoom(e.buyer.toString()), 'queue:position', {
      sessionId,
      status: 'waiting',
      entryId: e.id,
      position: i + 1,
      total: waiting.length,
      product: entryView(e).product,
    }),
  );
  emitTo(sessionRoom(sessionId), 'queue:length', { sessionId, total: waiting.length });
}

function tellBuyer(sessionId, entry, status) {
  emitTo(userRoom(entry.buyer.toString()), 'queue:position', { sessionId, status, entryId: entry.id, position: null });
}

// ---- Buyer actions ----

export function joinQueue(sessionId, user, { productId = null, note = '' } = {}) {
  return withLock(sessionId, async () => {
    const session = await loadLiveSession(sessionId);
    let product = null;
    if (productId) {
      product = await Product.findOne({ _id: productId, store: session.store, isVisible: true }).catch(() => null);
      if (!product) throw new AppError(404, 'That product is not in this shop');
    }
    const cleanNote = maskContacts(String(note ?? '').replace(/\s+/g, ' ').trim()).slice(0, QUEUE_NOTE_MAX);

    const existing = await QueueEntry.findOne({ session: sessionId, buyer: user._id, active: true });
    if (existing?.status === 'at_counter') throw new AppError(409, 'You are already at the counter');
    if (existing) {
      // Already waiting: "Ask to see this" on another product just updates what they want to see.
      if (product) existing.product = product._id;
      if (cleanNote) existing.note = cleanNote;
      await existing.save();
    } else {
      try {
        await QueueEntry.create({ session: sessionId, buyer: user._id, buyerName: user.name, product: product?._id ?? null, note: cleanNote });
      } catch (err) {
        if (err.code !== 11000) throw err; // a second tab joined at the same moment: one entry is enough
      }
      await postSystemMessage(sessionId, `${user.name.split(' ')[0]} joined the queue`);
    }
    await broadcast(sessionId);
    return myQueueState(sessionId, user.id);
  });
}

/** The buyer leaves the queue or the counter (or the room). */
export function leaveQueue(sessionId, userId, status = 'left') {
  return withLock(sessionId, async () => {
    const entry = await QueueEntry.findOne({ session: sessionId, buyer: userId, active: true });
    if (!entry) return false;
    if (entry.status === 'at_counter') await finishCounter(sessionId, entry, status);
    else {
      Object.assign(entry, { status, active: false, finishedAt: new Date() });
      await entry.save();
      tellBuyer(sessionId, entry, status);
    }
    await broadcast(sessionId);
    return true;
  });
}

/** Called when a buyer's last tab leaves the room. Explicit leave = now; a dropped connection gets a grace period. */
export function buyerLeftRoom(sessionId, userId, { immediate = false } = {}) {
  const check = async () => {
    if (userPresent(sessionId, userId)) return;
    await leaveQueue(sessionId, userId, 'left');
  };
  if (immediate) return check().catch((err) => logger.error('queue leave failed', err));
  const t = setTimeout(() => check().catch((err) => logger.error('queue leave failed', err)), QUEUE_GRACE_MS);
  t.unref?.();
  return undefined;
}

// ---- Seller actions ----

async function finishCounter(sessionId, entry, status = 'done') {
  Object.assign(entry, { status, active: false, finishedAt: new Date() });
  await entry.save();
  const session = await loadLiveSession(sessionId).catch(() => null);
  if (session && session.counterBuyer?.equals(entry.buyer)) {
    session.counterBuyer = null;
    await session.save();
    await setCounterPublish(session.livekitRoom, entry.buyer.toString(), false);
  }
  emitTo(userRoom(entry.buyer.toString()), 'counter:ended', { sessionId, status });
  emitTo(sessionRoom(sessionId), 'counter:changed', { sessionId, counter: null });
}

/** End the current counter (if any) and call the next waiting buyer. Returns the new counter or null. */
export function callNext(sessionId) {
  return withLock(sessionId, async () => {
    const current = await QueueEntry.findOne({ session: sessionId, status: 'at_counter' });
    if (current) await finishCounter(sessionId, current, 'done');

    const next = await QueueEntry.findOneAndUpdate(
      { session: sessionId, status: 'waiting' },
      { status: 'at_counter', calledAt: new Date() },
      { sort: { createdAt: 1 }, returnDocument: 'after' },
    );
    if (!next) {
      await broadcast(sessionId);
      return null;
    }

    const session = await loadLiveSession(sessionId);
    session.counterBuyer = next.buyer;
    await session.save();

    // Let them speak (and show their camera if they want) without reconnecting.
    const granted = await setCounterPublish(session.livekitRoom, next.buyer.toString(), true);
    const counter = await counterView(sessionId);
    emitTo(userRoom(next.buyer.toString()), 'counter:yourTurn', {
      sessionId,
      timeLimitMinutes: counter.timeLimitMinutes,
      granted,
      product: counter.product,
    });
    emitTo(sessionRoom(sessionId), 'counter:changed', { sessionId, counter });
    await postSystemMessage(sessionId, `${next.buyerName.split(' ')[0]} is at the counter`);
    // Auto-pin what they asked to see, so the whole room knows what is being shown.
    if (next.product) await pinProduct(session, next.product.toString()).catch(() => {});
    await broadcast(sessionId);
    return counter;
  });
}

export function endCounter(sessionId) {
  return withLock(sessionId, async () => {
    const current = await QueueEntry.findOne({ session: sessionId, status: 'at_counter' });
    if (!current) throw new AppError(409, 'Nobody is at the counter');
    await finishCounter(sessionId, current, 'done');
    await broadcast(sessionId);
  });
}

export function skip(sessionId, entryId) {
  return withLock(sessionId, async () => {
    const entry = await QueueEntry.findOneAndUpdate(
      { _id: entryId, session: sessionId, status: 'waiting' },
      { status: 'skipped', active: false, finishedAt: new Date() },
      { returnDocument: 'after' },
    ).catch(() => null);
    if (!entry) throw new AppError(404, 'That buyer is no longer waiting');
    tellBuyer(sessionId, entry, 'skipped');
    await broadcast(sessionId);
  });
}
