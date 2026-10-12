import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Runs before the imports below, so the rate limiter is built with a high limit
const db = vi.hoisted(() => {
  process.env.RATE_LIMIT_PER_MINUTE = '1000';
  return { query: vi.fn(), isDatabaseUp: vi.fn() };
});

vi.mock('../../src/db.js', () => ({
  pool: { query: db.query },
  isDatabaseUp: db.isDatabaseUp,
}));

import app from '../../src/app.js';
import config from '../../src/config.js';

const CODE = 'aB3x9Kq';
const TARGET = 'https://example.com/some/long/path';

function uniqueViolation() {
  return Object.assign(new Error('duplicate key value'), { code: '23505' });
}

beforeEach(() => {
  db.query.mockReset();
  db.isDatabaseUp.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /health', () => {
  it('returns 200 when the database is up', async () => {
    db.isDatabaseUp.mockResolvedValue(true);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok', version: config.gitSha });
  });

  it('returns 503 when the database is down', async () => {
    db.isDatabaseUp.mockResolvedValue(false);
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'error', db: 'down', version: config.gitSha });
  });
});

describe('POST /api/links', () => {
  it('creates a short link for a valid URL', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const res = await request(app).post('/api/links').send({ url: TARGET });

    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[0-9A-Za-z]{7}$/);
    expect(res.body).toEqual({
      code: res.body.code,
      shortUrl: `${config.baseUrl}/${res.body.code}`,
      originalUrl: TARGET,
    });
    expect(db.query).toHaveBeenCalledWith(
      'INSERT INTO links (code, original_url) VALUES ($1, $2)',
      [res.body.code, TARGET],
    );
  });

  it.each(['not a url', 'javascript:alert(1)', 'ftp://example.com/file'])(
    'returns 400 for %j without touching the database',
    async (url) => {
      const res = await request(app).post('/api/links').send({ url });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: expect.any(String) });
      expect(db.query).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['missing', {}],
    ['a number', { url: 42 }],
    ['an array', { url: [TARGET] }],
  ])('returns 400 when url is %s', async (_label, body) => {
    const res = await request(app).post('/api/links').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'url is required and must be a string' });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('retries with a new code after a unique violation', async () => {
    db.query.mockRejectedValueOnce(uniqueViolation()).mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/links').send({ url: TARGET });

    expect(res.status).toBe(201);
    expect(db.query).toHaveBeenCalledTimes(2);
    const firstCode = db.query.mock.calls[0][1][0];
    const secondCode = db.query.mock.calls[1][1][0];
    expect(secondCode).not.toBe(firstCode);
    expect(res.body.code).toBe(secondCode);
  });

  it('gives up after 5 unique violations', async () => {
    db.query.mockRejectedValue(uniqueViolation());
    const res = await request(app).post('/api/links').send({ url: TARGET });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(db.query).toHaveBeenCalledTimes(5);
  });

  it('returns 500 for any other database error without retrying', async () => {
    db.query.mockRejectedValue(Object.assign(new Error('connection lost'), { code: '08006' }));
    const res = await request(app).post('/api/links').send({ url: TARGET });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  describe('rate limit', () => {
    const original = process.env.RATE_LIMIT_PER_MINUTE;
    let limitedApp;

    beforeEach(async () => {
      // Fresh modules so links.js builds a new limiter with the low limit
      process.env.RATE_LIMIT_PER_MINUTE = '2';
      vi.resetModules();
      ({ default: limitedApp } = await import('../../src/app.js'));
      db.query.mockResolvedValue({ rows: [] });
    });

    afterEach(() => {
      process.env.RATE_LIMIT_PER_MINUTE = original;
    });

    const post = (ip, body = { url: TARGET }) =>
      request(limitedApp).post('/api/links').set('X-Forwarded-For', ip).send(body);

    it('returns 429 once a client goes over the limit, other clients are unaffected', async () => {
      expect((await post('203.0.113.1')).status).toBe(201);
      expect((await post('203.0.113.1')).status).toBe(201);

      const limited = await post('203.0.113.1');
      expect(limited.status).toBe(429);
      expect(limited.body).toEqual({
        error: 'Too many links created, please try again in a minute',
      });

      expect((await post('203.0.113.2')).status).toBe(201);
    });

    it('counts invalid requests toward the limit', async () => {
      expect((await post('203.0.113.3', { url: 'nope' })).status).toBe(400);
      expect((await post('203.0.113.3', {})).status).toBe(400);
      expect((await post('203.0.113.3')).status).toBe(429);
    });
  });
});

describe('GET /:code', () => {
  const clickInsert = () => db.query.mock.calls[1];

  it('redirects a known code and records the click', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 7, original_url: TARGET }] });
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .get(`/${CODE}`)
      .set('Referer', 'https://ref.example/')
      .set('User-Agent', 'test-agent');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(TARGET);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      'SELECT id, original_url FROM links WHERE code = $1',
      [CODE],
    );
    const [sql, params] = clickInsert();
    expect(sql).toMatch(/^INSERT INTO clicks/);
    expect(params).toEqual([7, 'https://ref.example/', 'test-agent', expect.any(String)]);
    expect(params[3]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns 404 for an unknown code', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get(`/${CODE}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Short link not found' });
    expect(res.headers['cache-control']).toBeUndefined();
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it.each(['abc', 'aB3x9Kq1', 'aB3x-Kq', 'favicon.ico'])(
    'returns 404 for malformed code %j without querying the database',
    async (code) => {
      const res = await request(app).get(`/${code}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Short link not found' });
      expect(res.headers['cache-control']).toBeUndefined();
      expect(db.query).not.toHaveBeenCalled();
    },
  );

  it('still redirects when recording the click fails', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 7, original_url: TARGET }] });
    db.query.mockRejectedValueOnce(new Error('insert failed'));
    const res = await request(app).get(`/${CODE}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(TARGET);
    expect(console.error).toHaveBeenCalled();
  });

  it('returns 500 when the lookup query fails', async () => {
    db.query.mockRejectedValueOnce(new Error('select failed'));
    const res = await request(app).get(`/${CODE}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('truncates long referer and user-agent headers', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 7, original_url: TARGET }] });
    db.query.mockResolvedValueOnce({ rows: [] });
    const referer = `https://ref.example/${'r'.repeat(3000)}`;
    const userAgent = 'u'.repeat(1000);
    await request(app).get(`/${CODE}`).set('Referer', referer).set('User-Agent', userAgent);

    const params = clickInsert()[1];
    expect(params[1]).toBe(referer.slice(0, 2048));
    expect(params[2]).toBe(userAgent.slice(0, 512));
  });

  it('stores missing referer and user-agent as null', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 7, original_url: TARGET }] });
    db.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get(`/${CODE}`).unset('User-Agent');

    const params = clickInsert()[1];
    expect(params[1]).toBeNull();
    expect(params[2]).toBeNull();
  });
});

describe('fallback handlers', () => {
  it.each([
    ['GET', '/a/b'],
    ['GET', '/api/links'],
    ['DELETE', `/api/links/${CODE}`],
  ])('%s %s returns 404 Not found', async (method, path) => {
    const res = await request(app)[method.toLowerCase()](path);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
    expect(res.headers['cache-control']).toBeUndefined();
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/links')
      .set('Content-Type', 'application/json')
      .send('{"url": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Request body must be valid JSON' });
  });

  it('returns 413 for a body over 10kb', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ url: `https://example.com/${'a'.repeat(11 * 1024)}` });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'Request body is too large' });
    expect(db.query).not.toHaveBeenCalled();
  });
});
