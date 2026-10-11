import { readFile } from 'node:fs/promises';
import { pool } from './db.js';

const INIT_SQL = new URL('../db/init.sql', import.meta.url);

// Any fixed number works, it only has to be the same for every API instance
const SCHEMA_LOCK_ID = 40006;

// Runs db/init.sql. Every statement uses IF NOT EXISTS, so this is safe on
// every start. The advisory lock stops two API containers starting at the
// same time from creating the same table twice.
export async function applySchema() {
  const sql = await readFile(INIT_SQL, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [SCHEMA_LOCK_ID]);
    await client.query(sql);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [SCHEMA_LOCK_ID]).catch(() => {});
    client.release();
  }
}
