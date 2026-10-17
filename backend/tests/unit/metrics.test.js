import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import { routeLabel } from '../../src/metrics.js';

const CODE = 'aB3x9Kq';

beforeEach(() => {
  db.query.mockReset();
  db.isDatabaseUp.mockReset();
});

async function scrape() {
  const res = await request(app).get('/metrics');
  return res.text;
}

describe('GET /metrics', () => {
  it('returns Prometheus text including Node.js process metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/plain/);
    expect(res.text).toContain('process_cpu_seconds_total');
    expect(res.text).toContain('# TYPE http_request_duration_seconds histogram');
  });

  it('labels requests by route pattern, not by the real short code', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, original_url: 'https://example.com/' }] })
      .mockResolvedValueOnce({ rows: [] });
    await request(app).get(`/${CODE}`).expect(302);

    const text = await scrape();
    expect(text).toMatch(/http_requests_total\{method="GET",route="\/:code",status="302"\} \d+/);
    expect(text).not.toContain(CODE);
  });

  it('counts requests that match no route as "unmatched"', async () => {
    await request(app).get('/not/a/route').expect(404);
    expect(await scrape()).toMatch(/http_requests_total\{method="GET",route="unmatched",status="404"\}/);
  });

  it('does not count its own scrapes', async () => {
    await scrape();
    expect(await scrape()).not.toContain('route="/metrics"');
  });

  it('keeps the full route label when a handler in a mounted router fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    db.query.mockRejectedValue(new Error('database down'));
    await request(app).get(`/api/links/${CODE}/stats`).expect(500);
    await request(app).post('/api/links').send({ url: 'https://example.com/' }).expect(500);
    consoleError.mockRestore();

    const text = await scrape();
    expect(text).toMatch(/http_requests_total\{method="GET",route="\/api\/links\/:code\/stats",status="500"\}/);
    expect(text).toMatch(/http_requests_total\{method="POST",route="\/api\/links",status="500"\}/);
    expect(text).not.toContain('route="/:code/stats"');
    expect(text).not.toContain('route="/",status="500"');
  });

  it.each(['/METRICS', '/Metrics'])('does not serve metrics at %s', async (path) => {
    db.query.mockResolvedValue({ rows: [] });
    const res = await request(app).get(path);
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('process_cpu_seconds_total');
  });
});

describe('routeLabel', () => {
  it('returns "unmatched" when no route handled the request', () => {
    expect(routeLabel({ baseUrl: '', route: undefined })).toBe('unmatched');
  });

  it('joins the router mount path and drops a trailing slash', () => {
    expect(routeLabel({ baseUrl: '/api/links', route: { path: '/' } })).toBe('/api/links');
  });

  it('uses the remembered mount path when one is given', () => {
    expect(routeLabel({ baseUrl: '', route: { path: '/:code/stats' } }, '/api/links')).toBe(
      '/api/links/:code/stats',
    );
  });

  it('keeps the root path as "/"', () => {
    expect(routeLabel({ baseUrl: '', route: { path: '/' } })).toBe('/');
  });
});