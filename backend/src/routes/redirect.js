import { Router } from 'express';
import config from '../config.js';
import { pool } from '../db.js';
import { hashIp } from '../lib/hashIp.js';
import { isValidCode } from '../lib/shortCode.js';

const router = Router();

const MAX_REFERRER_LENGTH = 2048;
const MAX_USER_AGENT_LENGTH = 512;

function truncate(value, max) {
  return typeof value === 'string' && value !== '' ? value.slice(0, max) : null;
}

// GET /:code  ->  302 to the original URL, or 404 if the code is unknown
router.get('/:code', async (req, res) => {
  const { code } = req.params;
  if (!isValidCode(code)) {
    return res.status(404).json({ error: 'Short link not found' });
  }

  const { rows } = await pool.query('SELECT id, original_url FROM links WHERE code = $1', [code]);
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Short link not found' });
  }
  const link = rows[0];

  // Record the click. If this fails the visitor is still redirected,
  // because losing one click is better than a broken link.
  try {
    await pool.query(
      'INSERT INTO clicks (link_id, referrer, user_agent, ip_hash) VALUES ($1, $2, $3, $4)',
      [
        link.id,
        truncate(req.get('referer'), MAX_REFERRER_LENGTH),
        truncate(req.get('user-agent'), MAX_USER_AGENT_LENGTH),
        hashIp(req.ip, config.ipHashSalt),
      ],
    );
  } catch (err) {
    console.error(`Failed to record click for ${code}:`, err.message);
  }

  // Stop browsers caching the redirect, so every visit is counted
  res.set('Cache-Control', 'private, no-store');
  return res.redirect(302, link.original_url);
});

export default router;
