import http from 'node:http';
import { env } from './src/config/env.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { createApp } from './src/app.js';
import { initSockets } from './src/sockets/index.js';
import { ensureAdminFromEnv } from './src/services/adminBootstrap.js';
import { logger } from './src/utils/logger.js';
import { User } from './src/models/User.js';
import { RoomSession } from './src/models/RoomSession.js';
import { QueueEntry } from './src/models/QueueEntry.js';
import { Offer, Order, Payment, Payout } from './src/models/Commerce.js';
import { isSimulated, isStkConfigured } from './src/services/mpesa.js';
import { startSweeper } from './src/services/orderService.js';
import { isLiveKitConfigured } from './src/services/livekit.js';
import { resumeLiveSessions } from './src/services/roomService.js';

async function start() {
  await connectDB(env.MONGO_URI);
  // Bring indexes in line with the models (e.g. users.email became sparse for guest accounts).
  await User.syncIndexes();
  await RoomSession.syncIndexes();
  await QueueEntry.syncIndexes();
  await Promise.all([Order, Payment, Payout, Offer].map((m) => m.syncIndexes()));
  await ensureAdminFromEnv();
  if (!isLiveKitConfigured()) logger.warn('LiveKit keys not set: sellers cannot go live');
  if (isSimulated()) logger.warn('MPESA_SIMULATE=true: payments are SIMULATED, no real money moves');
  else if (!isStkConfigured()) logger.warn('M-Pesa keys not set: checkout is switched off');
  startSweeper();

  const app = createApp();
  const server = http.createServer(app);
  const io = initSockets(server);
  app.set('io', io);
  await resumeLiveSessions();

  server.listen(env.PORT, () => logger.info(`Meet2buy API on http://localhost:${env.PORT}`));

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    io.close();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  logger.error('Failed to start:', err);
  process.exit(1);
});
