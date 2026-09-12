import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';
import { assertSafeIdentifier, assertSafeLength } from '../../src/security/sanitization.js';

describe('Categories 4, 16, W, AB: Input Validation & HTTP Parameter Pollution Defense', () => {
  let app: ApplicationInstance;
  let baseUrl: string;
  let sessionCookie: string;

  before(async () => {
    app = await bootstrapApplication({
      environment: 'test',
      port: 0,
      cookieSecure: false,
    });
    await app.server.start();
    const port = app.server.getPort();
    baseUrl = `http://127.0.0.1:${port}`;

    // Initialize an active test session
    const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    sessionCookie = initRes.headers.get('set-cookie') ?? '';
  });

  beforeEach(() => {
    app.server.rateLimiter.reset();
  });

  after(async () => {
    await app.shutdown();
  });

  describe('Utility Functions Runtime Validation', () => {
    it('assertSafeLength asserts types and length boundaries correctly', () => {
      assert.equal(assertSafeLength('valid', 10, 'testField'), 'valid');

      assert.throws(
        () => assertSafeLength(12345, 10, 'numField'),
        /Field 'numField' must be a string/
      );

      assert.throws(
        () => assertSafeLength('toolongstringhere', 5, 'longField'),
        /Field 'longField' exceeds maximum allowed length of 5 characters/
      );
    });

    it('assertSafeIdentifier enforces strict alphanumeric/dash/underscore constraint', () => {
      assert.equal(assertSafeIdentifier('valid-id_123', 20, 'idField'), 'valid-id_123');

      assert.throws(
        () => assertSafeIdentifier('invalid id with spaces', 50, 'spaceId'),
        /contains illegal characters/
      );

      assert.throws(
        () => assertSafeIdentifier('id/with/slashes', 50, 'slashId'),
        /contains illegal characters/
      );

      assert.throws(
        () => assertSafeIdentifier('id$with!special', 50, 'specialId'),
        /contains illegal characters/
      );
    });
  });

  describe('HTTP Parameter Pollution (HPP) Defense', () => {
    it('Duplicate query parameters (?debug=false&debug=true) cannot enable debug mode', async () => {
      const res = await fetch(`${baseUrl}/health/live?debug=false&debug=true`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.deepEqual(data, { status: 'ok' });
    });

    it('Duplicate query parameters (?admin=false&admin=true) cannot grant administrative authority', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session/status?admin=false&admin=true`, {
        headers: { Cookie: sessionCookie },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.admin, undefined);
      assert.equal(data.role, undefined);
    });
  });

  describe('Deep Nesting JSON Payload Defense', () => {
    it('Rejects JSON with excessive nesting depth (> 10 levels)', async () => {
      // Create deeply nested object: { a: { a: { a: ... } } }
      let deepObj: Record<string, unknown> = { route: 'sim://metadata/workload-profile' };
      for (let i = 0; i < 15; i++) {
        deepObj = { nested: deepObj };
      }

      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify(deepObj),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'BAD_REQUEST');
      assert.equal(data.message, 'JSON payload exceeds maximum allowed nesting depth.');
    });
  });
});
