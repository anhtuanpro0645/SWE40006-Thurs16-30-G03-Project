import { describe, expect, it } from 'vitest';
import { MAX_URL_LENGTH, validateUrl } from '../../src/lib/validateUrl.js';

describe('validateUrl', () => {
  it.each(['http://example.com', 'https://example.com/some/long/path?q=1#top'])(
    'accepts %s',
    (input) => {
      expect(validateUrl(input)).toEqual({ ok: true, url: new URL(input).href });
    },
  );

  it('trims whitespace and returns the normalised URL', () => {
    expect(validateUrl('  https://Example.com  ')).toEqual({
      ok: true,
      url: 'https://example.com/',
    });
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['ftp:', 'ftp://example.com/file.txt'],
  ])('rejects the %s scheme', (_scheme, input) => {
    expect(validateUrl(input)).toEqual({
      ok: false,
      error: 'url must start with http:// or https://',
    });
  });

  it.each([[''], ['   ']])('rejects empty input %j', (input) => {
    expect(validateUrl(input)).toEqual({
      ok: false,
      error: 'url is required and must be a string',
    });
  });

  it.each([[undefined], [null], [42], [{}], [['https://example.com']]])(
    'rejects non-string input %j',
    (input) => {
      expect(validateUrl(input)).toEqual({
        ok: false,
        error: 'url is required and must be a string',
      });
    },
  );

  it('accepts a URL of exactly the maximum length', () => {
    const prefix = 'https://example.com/';
    const input = prefix + 'a'.repeat(MAX_URL_LENGTH - prefix.length);
    expect(validateUrl(input).ok).toBe(true);
  });

  it('rejects a URL over the maximum length', () => {
    const prefix = 'https://example.com/';
    const input = prefix + 'a'.repeat(MAX_URL_LENGTH - prefix.length + 1);
    expect(validateUrl(input)).toEqual({
      ok: false,
      error: `url must be at most ${MAX_URL_LENGTH} characters`,
    });
  });

  it.each(['https://user:pass@example.com', 'https://user@example.com'])(
    'rejects credentials in %s',
    (input) => {
      expect(validateUrl(input)).toEqual({
        ok: false,
        error: 'url must not contain a username or password',
      });
    },
  );

  it.each(['not a url', 'example.com', 'http://', 'https://exa mple.com'])(
    'rejects unparseable input %j',
    (input) => {
      expect(validateUrl(input)).toEqual({ ok: false, error: 'url is not a valid URL' });
    },
  );
});
