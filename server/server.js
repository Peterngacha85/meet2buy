import http from 'node:http';
import { env } from './src/config/env.js';
import { connectDB, disconnectDB } from './src/config/db.js';
import { createApp } from './src/app.js';
import { initSockets } from './src/sockets/index.js';
import { ensureAdminFromEnv } from './src/services/adminBootstrap.js';
import { logger } from './src/utils/logger.js';

async function start() {
  await connectDB(env.MONGO_URI);
  await ensureAdminFromEnv();

  const app = createApp();
  const server = http.createServer(app);
  const io = initSockets(server);
  app.set('io', io);

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
