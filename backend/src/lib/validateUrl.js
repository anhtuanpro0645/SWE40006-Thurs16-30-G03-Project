// Checks a long URL before it is stored. Kept free of Express and the
// database so it can be unit tested on its own.

export const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * @param {unknown} input value from the request body
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
export function validateUrl(input) {
  if (typeof input !== 'string') {
    return { ok: false, error: 'url is required and must be a string' };
  }

  const value = input.trim();
  if (value === '') {
    return { ok: false, error: 'url is required and must be a string' };
  }
  if (value.length > MAX_URL_LENGTH) {
    return { ok: false, error: `url must be at most ${MAX_URL_LENGTH} characters` };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, error: 'url is not a valid URL' };
  }

  // Blocks javascript:, data:, file:, ftp: and similar schemes
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { ok: false, error: 'url must start with http:// or https://' };
  }
  if (!parsed.hostname) {
    return { ok: false, error: 'url must include a host name' };
  }
  // user:password@host links are a common phishing trick
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'url must not contain a username or password' };
  }

  return { ok: true, url: parsed.href };
}
