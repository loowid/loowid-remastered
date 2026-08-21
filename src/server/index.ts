import { createApp, createHttpServers } from './app.js';
import { connectDB } from './db.js';
import { setupSocketIO } from './signaling.js';
import { config } from './config.js';

async function main() {
  // Connect to MongoDB
  await connectDB();

  // Create Express app
  const app = createApp();
  const { httpServer, httpsServer } = createHttpServers(app);

  // Setup Socket.IO signaling
  const server = httpsServer || httpServer;
  setupSocketIO(server);

  // Start listening
  server.listen(config.port, config.host, () => {
    const proto = httpsServer ? 'https' : 'http';
    console.log(`[server] LooWID v3.0.0 running at ${proto}://${config.host}:${config.port}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[server] Shutting down...');
    server.close();
    const { disconnectDB } = await import('./db.js');
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[server] Fatal error:', err);
  process.exit(1);
});
