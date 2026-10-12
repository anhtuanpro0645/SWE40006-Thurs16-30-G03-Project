import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Fake pg.Pool that keeps the last instance so tests can inspect it
const pg = vi.hoisted(() => {
  const state = { last: null };
  class Pool {
    constructor(options) {
      this.options = options;
      this.query = vi.fn();
      this.on = vi.fn();
      state.last = this;
    }
  }
  return { state, Pool };
});

vi.mock('pg', () => ({ default: { Pool: pg.Pool } }));

let pool;
let isDatabaseUp;
let config;

beforeEach(async () => {
  // db.js creates the pool at import time, so import a fresh copy per test
  vi.resetModules();
  ({ pool, isDatabaseUp } = await import('../../src/db.js'));
  ({ default: config } = await import('../../src/config.js'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('db pool', () => {
  it('is created with the configured connection settings', () => {
    expect(pool).toBe(pg.state.last);
    expect(pool.options).toEqual({
      connectionString: config.databaseUrl,
      max: 10,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 30000,
    });
  });

  it('logs idle client errors instead of throwing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const call = pool.on.mock.calls.find(([event]) => event === 'error');
    expect(call).toBeDefined();

    const onError = call[1];
    expect(() => onError(new Error('terminated'))).not.toThrow();
    expect(console.error).toHaveBeenCalledWith('Unexpected database pool error:', 'terminated');
  });
});

describe('isDatabaseUp', () => {
  it('returns true when SELECT 1 succeeds', async () => {
    pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    await expect(isDatabaseUp()).resolves.toBe(true);
    expect(pool.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns false when the query fails', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));
    await expect(isDatabaseUp()).resolves.toBe(false);
  });
});
