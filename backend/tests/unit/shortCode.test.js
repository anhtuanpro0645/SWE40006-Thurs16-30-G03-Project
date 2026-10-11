import { describe, expect, it } from 'vitest';
import { ALPHABET, CODE_LENGTH, generateCode, isValidCode } from '../../src/lib/shortCode.js';

describe('generateCode', () => {
  it('returns 7 base62 characters', () => {
    expect(CODE_LENGTH).toBe(7);
    expect(ALPHABET).toHaveLength(62);
    for (let i = 0; i < 100; i += 1) {
      expect(generateCode()).toMatch(/^[0-9A-Za-z]{7}$/);
    }
  });

  it('returns a different code on each call', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateCode()));
    expect(codes.size).toBe(1000);
  });

  it('produces codes that isValidCode accepts', () => {
    expect(isValidCode(generateCode())).toBe(true);
  });
});

describe('isValidCode', () => {
  it.each(['aB3x9Kq', '0000000', 'zzzzzzz'])('accepts %s', (value) => {
    expect(isValidCode(value)).toBe(true);
  });

  it.each(['', 'aB3x9K', 'aB3x9Kq1', 'aB3x-Kq', 'aB3x_Kq', 'aB3x.Kq', 'favicon.ico'])(
    'rejects %j',
    (value) => {
      expect(isValidCode(value)).toBe(false);
    },
  );

  it.each([[undefined], [null], [1234567]])('rejects non-string %j', (value) => {
    expect(isValidCode(value)).toBe(false);
  });
});
