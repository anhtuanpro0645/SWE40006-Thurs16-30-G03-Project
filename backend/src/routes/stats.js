import { Router } from 'express';
import { pool } from '../db.js';
import { parseBrowser } from '../lib/browser.js';
import { isValidCode } from '../lib/shortCode.js';
import { referrerName, topCounts } from '../lib/stats.js';

const router = Router();

// Number of days shown in the "clicks per day" list
const DAYS = 30;

// GET /api/links/:code/stats
router.get('/:code/stats', async (req, res) => {
  const { code } = req.params;
  if (!isValidCode(code)) {
    return res.status(404).json({ error: 'Short link not found' });
  }

  const { rows } = await pool.query(
    'SELECT id, original_url, created_at FROM links WHERE code = $1',
    [code],
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Short link not found' });
  }
  const link = rows[0];

  // The four queries are independent, so run them at the same time
  const [total, perDay, referrers, browsers] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS total FROM clicks WHERE link_id = $1', [link.id]),
    pool.query(
      `SELECT to_char(clicked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, COUNT(*)::int AS clicks
         FROM clicks
        WHERE link_id = $1 AND clicked_at >= now() - make_interval(days => $2)
        GROUP BY date
        ORDER BY date`,
      [link.id, DAYS],
    ),
    pool.query(
      'SELECT referrer AS key, COUNT(*)::int AS clicks FROM clicks WHERE link_id = $1 GROUP BY referrer',
      [link.id],
    ),
    pool.query(
      'SELECT user_agent AS key, COUNT(*)::int AS clicks FROM clicks WHERE link_id = $1 GROUP BY user_agent',
      [link.id],
    ),
  ]);

  return res.json({
    code,
    originalUrl: link.original_url,
    createdAt: link.created_at,
    totalClicks: total.rows[0].total,
    clicksPerDay: perDay.rows,
    topReferrers: topCounts(referrers.rows, referrerName),
    topBrowsers: topCounts(browsers.rows, parseBrowser),
  });
});

export default router;
