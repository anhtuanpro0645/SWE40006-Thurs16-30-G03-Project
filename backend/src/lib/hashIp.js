import { createHash } from 'node:crypto';

// Stores a salted SHA-256 hash instead of the visitor's real IP address, so
// unique visitors can still be counted while keeping less personal data.
export function hashIp(ip, salt) {
  if (!ip) return null;
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}
