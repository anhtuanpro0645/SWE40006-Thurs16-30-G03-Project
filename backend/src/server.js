import app from './app.js';
import config from './config.js';
import { pool } from './db.js';
import { applySchema } from './schema.js';

const SCHEMA_RETRIES = 10;
const RETRY_DELAY_MS = 2000;

// The database may still be starting (for example right after a deploy),
// so retry a few times before giving up. Docker restarts the container if
// this process exits.
async function applySchemaWithRetry() {
  for (let attempt = 1; attempt <= SCHEMA_RETRIES; attempt += 1) {
    try {
      await applySchema();
      console.log('Database schema is up to date');
      return;
    } catch (err) {
      console.error(`Schema attempt ${attempt}/${SCHEMA_RETRIES} failed: ${err.message}`);
      if (attempt === SCHEMA_RETRIES) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

try {
  await applySchemaWithRetry();
} catch {
  console.error('Could not prepare the database, exiting');
  process.exit(1);
}

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
