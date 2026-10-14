import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// Runs before the imports below, so the rate limiter is built with a high limit
vi.hoisted(() => {
  process.env.RATE_LIMIT_PER_MINUTE = '1000';
});

import { pool, useTestDatabase } from './helpers.js';
import app from '../../src/app.js';
import config from '../../src/config.js';

const TARGET = 'https://example.com/some/long/path';

useTestDatabase();

describe('POST /api/links', () => {
  it('creates a short link and stores exactly one row', async () => {
    const res = await request(app).post('/api/links').send({ url: TARGET });

    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[0-9A-Za-z]{7}$/);
    expect(res.body).toEqual({
      code: res.body.code,
      shortUrl: `${config.baseUrl}/${res.body.code}`,
      originalUrl: TARGET,
    });

    const { rows } = await pool.query('SELECT code, original_url FROM links');
    expect(rows).toEqual([{ code: res.body.code, original_url: TARGET }]);
  });

  it.each(['not a url', 'javascript:alert(1)'])(
    'returns 400 for %j and stores nothing',
    async (url) => {
      const res = await request(app).post('/api/links').send({ url });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: expect.any(String) });

      const { rows } = await pool.query('SELECT id FROM links');
      expect(rows).toEqual([]);
    },
  );
});
