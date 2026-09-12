import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSecureSessionId, isValidSessionId } from '../src/session/session-id.js';

describe('Session ID Tests (Requirements 6-9)', () => {
  it('6. Session IDs are generated securely with high entropy', () => {
    const id = createSecureSessionId();
    assert.equal(typeof id, 'string');
    // 32 bytes in base64url is 43 characters
    assert(id.length >= 40 && id.length <= 64, `ID length ${id.length} should be in [40, 64]`);
    assert(isValidSessionId(id), 'Session ID should match strict alphanumeric format');
  });

  it('7. Multiple IDs are unique and show no collisions', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const id = createSecureSessionId();
      assert.equal(ids.has(id), false, 'Duplicate session ID generated!');
      ids.add(id);
    }
    assert.equal(ids.size, 1000);
  });

  it('8. IDs do not contain predictable readable state, timestamps, or usernames', () => {
    const id = createSecureSessionId();
    const currentTimestampSec = Math.floor(Date.now() / 1000).toString();
    const currentYear = new Date().getFullYear().toString();

    assert(!id.includes('admin'), 'Session ID must not contain usernames');
    assert(!id.includes('root'), 'Session ID must not contain usernames');
    assert(!id.includes('user'), 'Session ID must not contain usernames');
    assert(!id.includes('session'), 'Session ID must not contain identifiable words');
    assert(!id.includes(currentTimestampSec), 'Session ID must not contain raw timestamps');
    assert(!id.includes(currentYear), 'Session ID must not contain current year');
    // Decoded buffer entropy check (32 bytes)
    const decoded = Buffer.from(id, 'base64url');
    assert.equal(decoded.length, 32);
  });

  it('9. Invalid IDs are rejected safely', () => {
    assert.equal(isValidSessionId(''), false);
    assert.equal(isValidSessionId('short_id'), false);
    assert.equal(isValidSessionId('../../../etc/passwd'), false);
    assert.equal(isValidSessionId('a'.repeat(200)), false);
    assert.equal(isValidSessionId('invalid!special$characters*'), false);
    assert.equal(isValidSessionId(null), false);
    assert.equal(isValidSessionId(undefined), false);
    assert.equal(isValidSessionId(12345), false);
  });
});
