import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import config from '../config.js';
import { pool } from '../db.js';
import { generateCode } from '../lib/shortCode.js';
import { validateUrl } from '../lib/validateUrl.js';

const router = Router();

// PostgreSQL error code for a unique constraint violation
const UNIQUE_VIOLATION = '23505';
const MAX_CODE_ATTEMPTS = 5;

// Limits how many links one IP address can create per minute
const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimitPerMinute,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many links created, please try again in a minute' },
});

// POST /api/links  { "url": "https://example.com/some/long/path" }
router.post('/', createLimiter, async (req, res) => {
  const result = validateUrl(req.body?.url);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  // A clash is very unlikely with 62^7 codes, but if the code already
  // exists the UNIQUE constraint rejects it and we try a new one.
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateCode();
    try {
      await pool.query('INSERT INTO links (code, original_url) VALUES ($1, $2)', [
        code,
        result.url,
      ]);
      return res.status(201).json({
        code,
        shortUrl: `${config.baseUrl}/${code}`,
        originalUrl: result.url,
      });
    } catch (err) {
      if (err.code !== UNIQUE_VIOLATION) throw err;
    }
  }

  throw new Error(`Could not generate a unique code after ${MAX_CODE_ATTEMPTS} attempts`);
});

export default router;
