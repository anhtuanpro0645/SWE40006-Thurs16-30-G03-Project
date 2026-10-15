import { describe, expect, it } from 'vitest';
import { parseBrowser } from '../../src/lib/browser.js';

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

describe('parseBrowser', () => {
  it.each([
    ['Chrome', CHROME],
    ['Edge', `${CHROME} Edg/141.0.0.0`],
    ['Opera', `${CHROME} OPR/120.0.0.0`],
    ['Firefox', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0'],
    [
      'Safari',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    ],
    ['Chrome', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1'],
    ['Postman', 'PostmanRuntime/7.51.0'],
    ['curl', 'curl/8.9.1'],
  ])('recognises %s', (name, userAgent) => {
    expect(parseBrowser(userAgent)).toBe(name);
  });

  it('returns "Unknown" when there is no user agent', () => {
    expect(parseBrowser(null)).toBe('Unknown');
    expect(parseBrowser('')).toBe('Unknown');
  });

  it('returns "Other" for anything it does not recognise', () => {
    expect(parseBrowser('SomeBot/1.0')).toBe('Other');
  });
});