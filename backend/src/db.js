import pg from 'pg';
import config from './config.js';

// One shared connection pool for the whole API. The pool does not open a
// connection until the first query, so importing this file is cheap.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
});

// Log errors from idle clients instead of crashing the process
// (for example when the database container restarts).
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

// Returns true if the database answers a trivial query.
export async function isDatabaseUp() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
