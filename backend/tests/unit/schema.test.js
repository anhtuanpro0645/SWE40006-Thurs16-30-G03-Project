import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connect: vi.fn() }));

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
vi.mock('../../src/db.js', () => ({ pool: { connect: mocks.connect } }));

import { applySchema } from '../../src/schema.js';

const SQL = 'CREATE TABLE IF NOT EXISTS links (id INT);';
const LOCK = 'SELECT pg_advisory_lock($1)';
const UNLOCK = 'SELECT pg_advisory_unlock($1)';

let events;
let client;

// Fake client that records every call in order; failOn maps SQL text to an error
function makeClient(failOn = {}) {
  return {
    query: vi.fn(async (sql, params) => {
      events.push(params ? [sql, params] : [sql]);
      if (failOn[sql]) throw failOn[sql];
      return { rows: [] };
    }),
    release: vi.fn(() => events.push(['release'])),
  };
}

beforeEach(() => {
  events = [];
  vi.mocked(readFile).mockReset();
  vi.mocked(readFile).mockImplementation(async () => {
    events.push(['read']);
    return SQL;
  });
  mocks.connect.mockReset();
});

describe('applySchema', () => {
  it('reads init.sql, locks, runs the SQL, unlocks and releases in order', async () => {
    client = makeClient();
    mocks.connect.mockResolvedValue(client);

    await applySchema();

    const [path, encoding] = vi.mocked(readFile).mock.calls[0];
    expect(path).toBeInstanceOf(URL);
    expect(path.pathname).toMatch(/\/db\/init\.sql$/);
    expect(encoding).toBe('utf8');
    expect(events).toEqual([
      ['read'],
      [LOCK, [40006]],
      [SQL],
      [UNLOCK, [40006]],
      ['release'],
    ]);
  });

  it('unlocks and releases even when the SQL fails, then rethrows', async () => {
    const failure = new Error('syntax error');
    client = makeClient({ [SQL]: failure });
    mocks.connect.mockResolvedValue(client);

    await expect(applySchema()).rejects.toBe(failure);
    expect(events).toEqual([
      ['read'],
      [LOCK, [40006]],
      [SQL],
      [UNLOCK, [40006]],
      ['release'],
    ]);
  });

  it('swallows an unlock failure and still releases the client', async () => {
    client = makeClient({ [UNLOCK]: new Error('connection lost') });
    mocks.connect.mockResolvedValue(client);

    await expect(applySchema()).resolves.toBeUndefined();
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toEqual(['release']);
  });

  it('propagates a connect failure without running any query', async () => {
    const failure = new Error('connection refused');
    mocks.connect.mockRejectedValue(failure);

    await expect(applySchema()).rejects.toBe(failure);
    expect(events).toEqual([['read']]);
  });
});
