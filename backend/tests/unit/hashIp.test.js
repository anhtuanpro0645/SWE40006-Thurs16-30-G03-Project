import { describe, expect, it } from 'vitest';
import { hashIp } from '../../src/lib/hashIp.js';

describe('hashIp', () => {
  it('returns the same 64-character hex hash for the same IP and salt', () => {
    const hash = hashIp('203.0.113.7', 'salt');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp('203.0.113.7', 'salt')).toBe(hash);
  });

  it('returns different hashes for different IPs', () => {
    expect(hashIp('203.0.113.7', 'salt')).not.toBe(hashIp('203.0.113.8', 'salt'));
  });

  it('returns different hashes for different salts', () => {
    expect(hashIp('203.0.113.7', 'salt-a')).not.toBe(hashIp('203.0.113.7', 'salt-b'));
  });

  it.each(['203.0.113.7', '::1', '2001:db8::1'])('never contains the raw IP %s', (ip) => {
    expect(hashIp(ip, 'salt')).not.toContain(ip);
  });

  it.each([[undefined], [null], ['']])('returns null when the IP is %j', (ip) => {
    expect(hashIp(ip, 'salt')).toBeNull();
  });
});
