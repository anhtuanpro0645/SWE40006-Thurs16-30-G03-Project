import { describe, expect, it } from 'vitest';
import { referrerName, topCounts, TOP_N } from '../../src/lib/stats.js';

describe('referrerName', () => {
  it('returns the host name of the referring page', () => {
    expect(referrerName('https://canvas.swin.edu.au/courses/123?x=1')).toBe('canvas.swin.edu.au');
  });

  it.each([null, undefined, ''])('returns "Direct" for %j', (value) => {
    expect(referrerName(value)).toBe('Direct');
  });

  it('returns "Other" for a value that is not a URL', () => {
    expect(referrerName('not a url')).toBe('Other');
  });
});

describe('topCounts', () => {
  it('merges keys that map to the same name and sorts by clicks', () => {
    const rows = [
      { key: 'https://a.com/1', clicks: 2 },
      { key: 'https://b.com/', clicks: 5 },
      { key: 'https://a.com/2', clicks: 4 },
    ];
    expect(topCounts(rows, referrerName)).toEqual([
      { name: 'a.com', clicks: 6 },
      { name: 'b.com', clicks: 5 },
    ]);
  });

  it('breaks ties alphabetically', () => {
    const rows = [
      { key: 'b', clicks: 1 },
      { key: 'a', clicks: 1 },
    ];
    expect(topCounts(rows, (key) => key)).toEqual([
      { name: 'a', clicks: 1 },
      { name: 'b', clicks: 1 },
    ]);
  });

  it(`returns at most ${TOP_N} entries by default`, () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ key: `site${i}`, clicks: i + 1 }));
    const result = topCounts(rows, (key) => key);
    expect(result).toHaveLength(TOP_N);
    expect(result[0]).toEqual({ name: 'site7', clicks: 8 });
  });

  it('returns an empty list when there are no clicks', () => {
    expect(topCounts([], (key) => key)).toEqual([]);
  });
});