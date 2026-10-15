import { afterAll, beforeAll, beforeEach } from 'vitest';
import { pool } from '../../src/db.js';
import { applySchema } from '../../src/schema.js';

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

// The tests TRUNCATE tables, so refuse to run against anything but a local
// database. Never fall back to the config.js default. The URL holds a
// password, so error messages never include it.
function assertLocalDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Integration tests need a local Postgres test database.');
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }

  // pg lets a ?host= query parameter override the host, so reject it too
  if (!LOCAL_HOSTS.includes(parsed.hostname) || parsed.searchParams.has('host')) {
    throw new Error('DATABASE_URL host must be localhost or 127.0.0.1. Refusing to TRUNCATE a non-local database.');
  }
}

// Runs on import, before any hook below can open a connection
assertLocalDatabase();

export { pool };

// Call once at the top level of each integration test file
export function useTestDatabase() {
  beforeAll(async () => {
    await applySchema();
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE links, clicks RESTART IDENTITY CASCADE');
  });

  afterAll(async () => {
    await pool.end();
  });
}
