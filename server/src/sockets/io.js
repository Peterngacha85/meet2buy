// Holds the Socket.io server so services (e.g. ending a session from REST or an admin action) can emit events.
let io = null;

export const setIo = (server) => {
  io = server;
};

/** Emit to a Socket.io room; a no-op before sockets start (e.g. in REST-only tests). */
export function emitTo(room, event, payload) {
  io?.to(room).emit(event, payload);
}

export function leaveAll(room) {
  io?.in(room).socketsLeave(room);
}

export const sessionRoom = (sessionId) => `session:${sessionId}`;
export const sellerRoom = (sessionId) => `seller:${sessionId}`;
export const userRoom = (userId) => `user:${userId}`;
