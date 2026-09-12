import { generateSecureRandomId } from '../security/crypto.js';

const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{40,64}$/;

/**
 * Generates an opaque, unpredictable, cryptographically secure session ID.
 * Produces 32 bytes of entropy encoded as base64url (43 chars).
 */
export function createSecureSessionId(): string {
  return generateSecureRandomId(32);
}

/**
 * Validates that an incoming session ID conforms to the strict format.
 * Rejects path traversals, special characters, and non-conforming lengths.
 */
export function isValidSessionId(sessionId: unknown): sessionId is string {
  if (typeof sessionId !== 'string') {
    return false;
  }
  return SESSION_ID_REGEX.test(sessionId);
}
