import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// Runs before the imports below, so the rate limiter is built with a high limit
vi.hoisted(() => {
  process.env.RATE_LIMIT_PER_MINUTE = '1000';
});

import { pool, useTestDatabase } from './helpers.js';
import app from '../../src/app.js';

const CODE = 'aB3x9Kq';
const TARGET = 'https://example.com/some/long/path';

useTestDatabase();

// The click insert is awaited before the 302 is sent, so no polling is needed
async function clickLinkIds() {
  const { rows } = await pool.query('SELECT link_id FROM clicks ORDER BY id');
  return rows.map((row) => row.link_id);
}

describe('GET /:code', () => {
  it('redirects a created link and records one click per visit', async () => {
    const created = await request(app).post('/api/links').send({ url: TARGET });
    expect(created.status).toBe(201);
    const { code } = created.body;
    const { rows } = await pool.query('SELECT id FROM links WHERE code = $1', [code]);
    const linkId = rows[0].id;

    const first = await request(app).get(`/${code}`);
    expect(first.status).toBe(302);
    expect(first.headers.location).toBe(TARGET);
    expect(first.headers['cache-control']).toBe('private, no-store');
    expect(await clickLinkIds()).toEqual([linkId]);

    const second = await request(app).get(`/${code}`);
    expect(second.status).toBe(302);
    expect(await clickLinkIds()).toEqual([linkId, linkId]);
  });

  it('returns 404 for an unknown code and records no click', async () => {
    const res = await request(app).get(`/${CODE}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Short link not found' });
    expect(await clickLinkIds()).toEqual([]);
  });
});
