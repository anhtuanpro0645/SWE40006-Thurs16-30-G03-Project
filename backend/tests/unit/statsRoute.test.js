import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ query: vi.fn(), isDatabaseUp: vi.fn() }));

vi.mock('../../src/db.js', () => ({
  pool: { query: db.query },
  isDatabaseUp: db.isDatabaseUp,
}));

import app from '../../src/app.js';

const CODE = 'aB3x9Kq';
const CHROME = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

beforeEach(() => {
  db.query.mockReset();
});

describe('GET /api/links/:code/stats', () => {
  it('returns the totals, clicks per day, top referrers and top browsers', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 7, original_url: 'https://example.com/', created_at: '2026-10-13T00:00:00.000Z' }],
      })
      .mockResolvedValueOnce({ rows: [{ total: 3 }] })
      .mockResolvedValueOnce({ rows: [{ date: '2026-10-13', clicks: 3 }] })
      .mockResolvedValueOnce({
        rows: [
          { key: 'https://canvas.swin.edu.au/a', clicks: 2 },
          { key: null, clicks: 1 },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { key: CHROME, clicks: 2 },
          { key: 'PostmanRuntime/7.51.0', clicks: 1 },
        ],
      });

    const res = await request(app).get(`/api/links/${CODE}/stats`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      code: CODE,
      originalUrl: 'https://example.com/',
      createdAt: '2026-10-13T00:00:00.000Z',
      totalClicks: 3,
      clicksPerDay: [{ date: '2026-10-13', clicks: 3 }],
      topReferrers: [
        { name: 'canvas.swin.edu.au', clicks: 2 },
        { name: 'Direct', clicks: 1 },
      ],
      topBrowsers: [
        { name: 'Chrome', clicks: 2 },
        { name: 'Postman', clicks: 1 },
      ],
    });
    expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('FROM links WHERE code = $1'), [CODE]);
    for (let call = 2; call <= 5; call += 1) {
      expect(db.query.mock.calls[call - 1][1][0]).toBe(7);
    }
  });

  it('returns 404 for an unknown code', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get(`/api/links/${CODE}/stats`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Short link not found' });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('returns 404 without querying the database for a malformed code', async () => {
    const res = await request(app).get('/api/links/abc/stats');
    expect(res.status).toBe(404);
    expect(db.query).not.toHaveBeenCalled();
  });
});
