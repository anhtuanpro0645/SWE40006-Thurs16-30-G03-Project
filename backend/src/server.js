import app from './app.js';
import config from './config.js';
import { pool } from './db.js';

const server = app.listen(config.port, () => {
  console.log(
    `API listening on port ${config.port} (env: ${config.nodeEnv}, version: ${config.gitSha})`,
  );
});

// Docker sends SIGTERM when a container is stopped or replaced during a
// deployment. Finish open requests and close the pool before exiting.
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  // Force exit if something hangs
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
