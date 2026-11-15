import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AUTH_COOKIE, verifyToken } from '../utils/token.js';
import { logger } from '../utils/logger.js';
import { setIo } from './io.js';
import { registerRoomHandlers } from './roomHandlers.js';
import { ADMINS_ROOM } from '../services/notifyService.js';

/**
 * Socket.io bootstrap. Authenticates with the same JWT cookie as the REST API.
 * Guests connect too (read-only) so they can watch rooms.
 * Room/queue/offer handlers are registered here from Sprint 4 onwards (doc 07).
 */
export function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  setIo(io);
  io.engine.use(cookieParser());

  io.use(async (socket, next) => {
    try {
      const payload = verifyToken(socket.request.cookies?.[AUTH_COOKIE]);
      const user = payload ? await User.findById(payload.sub) : null;
      socket.data.user = user && user.status === 'active' ? user : null;
      next();
    } catch (err) {
      next(err);
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    if (user) socket.join(`user:${user.id}`);
    if (user?.role === 'admin') socket.join(ADMINS_ROOM);
    logger.info(`socket connected ${socket.id} (${user ? `${user.role} ${user.id}` : 'guest'})`);

    registerRoomHandlers(socket);
    // Sprint 5: registerQueueHandlers(socket)

    socket.on('disconnect', () => logger.info(`socket disconnected ${socket.id}`));
  });

  return io;
}
