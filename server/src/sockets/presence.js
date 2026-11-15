import { emitTo, sessionRoom } from './io.js';

// Who is in each live room right now (doc 07 §5). In memory: one server for the MVP; Redis later for several.
// sessionId -> { sockets: Map<socketId, { userId|null, name, avatar, isSeller }>, peak, timer }
const rooms = new Map();

const SHOPPERS_LISTED = 20;
const BROADCAST_EVERY_MS = 1000;

function room(sessionId) {
  let r = rooms.get(sessionId);
  if (!r) {
    r = { sockets: new Map(), peak: 0, timer: null };
    rooms.set(sessionId, r);
  }
  return r;
}

/** Viewers exclude the seller. A logged-in shopper with two tabs counts once; each guest tab counts once. */
function summarise(r) {
  const seen = new Map();
  for (const [socketId, p] of r.sockets) {
    if (p.isSeller) continue;
    const key = p.userId ?? `guest:${socketId}`;
    if (!seen.has(key)) seen.set(key, p);
  }
  const shoppers = [...seen.values()]
    .filter((p) => p.userId)
    .slice(0, SHOPPERS_LISTED)
    .map((p) => ({ id: p.userId, name: p.name, avatar: p.avatar ?? null }));
  return { viewerCount: seen.size, shoppers, sellerHere: [...r.sockets.values()].some((p) => p.isSeller) };
}

function scheduleBroadcast(sessionId) {
  const r = rooms.get(sessionId);
  if (!r || r.timer) return;
  r.timer = setTimeout(() => {
    r.timer = null;
    if (rooms.get(sessionId) === r) emitTo(sessionRoom(sessionId), 'presence:update', summarise(r));
  }, BROADCAST_EVERY_MS);
  r.timer.unref?.();
}

export function addPresence(sessionId, socketId, person) {
  const r = room(sessionId);
  r.sockets.set(socketId, person);
  const summary = summarise(r);
  r.peak = Math.max(r.peak, summary.viewerCount);
  scheduleBroadcast(sessionId);
  return summary;
}

/** Returns the person removed (or null). */
export function removePresence(sessionId, socketId) {
  const r = rooms.get(sessionId);
  const person = r?.sockets.get(socketId) ?? null;
  if (!person) return null;
  r.sockets.delete(socketId);
  scheduleBroadcast(sessionId);
  return person;
}

/** Session ids this socket is present in (used on disconnect). */
export function sessionsOf(socketId) {
  return [...rooms].filter(([, r]) => r.sockets.has(socketId)).map(([id]) => id);
}

export function sellerSocketCount(sessionId) {
  const r = rooms.get(sessionId);
  return r ? [...r.sockets.values()].filter((p) => p.isSeller).length : 0;
}

/** Is this logged-in user still in the room on any tab? */
export function userPresent(sessionId, userId) {
  const r = rooms.get(sessionId);
  return r ? [...r.sockets.values()].some((p) => p.userId === userId) : false;
}

export function presenceOf(sessionId) {
  const r = rooms.get(sessionId);
  return r ? summarise(r) : { viewerCount: 0, shoppers: [], sellerHere: false };
}

export const viewerCount = (sessionId) => (sessionId ? presenceOf(String(sessionId)).viewerCount : 0);
export const peakOf = (sessionId) => rooms.get(sessionId)?.peak ?? 0;

export function clearPresence(sessionId) {
  const r = rooms.get(sessionId);
  if (r?.timer) clearTimeout(r.timer);
  rooms.delete(sessionId);
}
