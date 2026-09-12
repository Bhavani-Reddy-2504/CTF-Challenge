import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Generates a cryptographically secure, URL-safe random string.
 * Uses CSPRNG (node:crypto.randomBytes).
 * @param byteLength Number of random bytes of entropy (default 32 bytes = 256 bits).
 */
export function generateSecureRandomId(byteLength: number = 32): string {
  if (byteLength < 16) {
    throw new Error('Security Error: Entropy byteLength must be at least 16 bytes (128 bits).');
  }
  return randomBytes(byteLength).toString('base64url');
}

/**
 * Generates a standard UUIDv4 for correlation/request tracing.
 */
export function generateCorrelationId(): string {
  return `req_${randomUUID().replace(/-/g, '')}`;
}

/**
 * Constant-time comparison of two strings to prevent timing attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
      // Still execute timingSafeEqual on dummy to avoid timing discrepancy based on length check alone
      timingSafeEqual(bufA, bufA);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
