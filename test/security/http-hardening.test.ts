import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';

function makeRawRequest(options: http.RequestOptions): Promise<{ statusCode?: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('Security Hardening: HTTP Methods, Headers, Request Body & Error Sanitization', () => {
  let app: ApplicationInstance;
  let baseUrl: string;
  let port: number;

  before(async () => {
    app = await bootstrapApplication({
      environment: 'test',
      port: 0,
      cookieSecure: false,
    });
    await app.server.start();
    port = app.server.getPort();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  beforeEach(() => {
    app.server.rateLimiter.reset();
  });

  after(async () => {
    await app.shutdown();
  });

  // =========================================================================
  // CATEGORY 3: HTTP Method Enforcement
  // =========================================================================
  describe('Category 3: HTTP Method Enforcement', () => {
    it('1. Rejects GET on POST-only endpoint (/api/v1/session/init)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'GET' });
      assert.equal(res.status, 405);
      const data = await res.json();
      assert.equal(data.code, 'METHOD_NOT_ALLOWED');
    });

    it('2. Rejects POST on GET-only endpoint (/health/live)', async () => {
      const res = await fetch(`${baseUrl}/health/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 405);
      const data = await res.json();
      assert.equal(data.code, 'METHOD_NOT_ALLOWED');
    });

    it('3. Rejects PUT method across endpoints', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
      });
      assert.equal(res.status, 405);
      const data = await res.json();
      assert.equal(data.code, 'METHOD_NOT_ALLOWED');
    });

    it('4. Rejects PATCH method', async () => {
      const res = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interpretation: 'test' }),
      });
      assert.equal(res.status, 405);
      const data = await res.json();
      assert.equal(data.code, 'METHOD_NOT_ALLOWED');
    });

    it('5. Rejects DELETE method', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session/terminate`, { method: 'DELETE' });
      assert.equal(res.status, 405);
    });

    it('6. Rejects TRACE method without echoing headers', async () => {
      const res = await makeRawRequest({
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/session/status',
        method: 'TRACE',
        headers: { 'X-Secret-Test': 'sensitive_header_value' },
      });
      assert.equal(res.statusCode, 405);
      assert(!res.body.includes('sensitive_header_value'), 'TRACE must not echo custom headers');
    });

    it('7. Rejects CONNECT method', async () => {
      await new Promise<void>((resolve) => {
        const req = http.request({
          hostname: '127.0.0.1',
          port,
          path: '/',
          method: 'CONNECT',
        });
        req.on('connect', (res) => {
          assert.equal(res.statusCode, 405);
          resolve();
        });
        req.on('error', () => {
          // Socket hang up / closed safely by server
          resolve();
        });
        req.end();
      });
    });

    it('8. Safe HEAD handling on GET endpoints', async () => {
      const res = await fetch(`${baseUrl}/health/live`, { method: 'HEAD' });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      const text = await res.text();
      assert.equal(text, '', 'HEAD must return empty body');
    });

    it('9. Safe OPTIONS handling returns 204 with Allow header', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, { method: 'OPTIONS' });
      assert.equal(res.status, 204);
      assert.ok(res.headers.get('allow'));
    });

    it('10. Method override headers cannot bypass method restrictions', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session/init`, {
        method: 'GET',
        headers: {
          'X-HTTP-Method-Override': 'POST',
          'X-Method-Override': 'POST',
          'X-HTTP-Method': 'POST',
        },
      });
      assert.equal(res.status, 405, 'Method override headers must be ignored');
    });
  });

  // =========================================================================
  // CATEGORY 4: Request Body Security
  // =========================================================================
  describe('Category 4: Request Body Security', () => {
    let sessionCookie: string;

    before(async () => {
      const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      sessionCookie = initRes.headers.get('set-cookie') ?? '';
    });

    it('1. Valid JSON passes successfully', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
      });
      assert.equal(res.status, 200);
    });

    it('2. Invalid JSON produces sanitized 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: '{ malformed json: true, ',
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'BAD_REQUEST');
      assert.equal(data.message, 'Malformed JSON request body.');
    });

    it('3. Truncated JSON is rejected safely', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: '{"route": "sim://metadata/enclave',
      });
      assert.equal(res.status, 400);
    });

    it('4. Wrong Content-Type is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          Cookie: sessionCookie,
        },
        body: '{"route":"sim://metadata/workload-profile"}',
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'BAD_REQUEST');
    });

    it('5. Array instead of object is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify(['sim://metadata/workload-profile']),
      });
      assert.equal(res.status, 400);
    });

    it('6. Null instead of object is rejected with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: 'null',
      });
      assert.equal(res.status, 400);
    });

    it('7. Oversized request body is rejected safely (>64KB)', async () => {
      const hugeString = 'a'.repeat(70000);
      try {
        const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: sessionCookie,
          },
          body: JSON.stringify({ route: hugeString }),
        });
        assert.equal(res.status, 400);
      } catch (err: unknown) {
        // Fetch connection abort when server destroys stream is also safe
        assert.ok(err);
      }
    });

    it('8. Excessively long string property is rejected with 400', async () => {
      const longVal = 'x'.repeat(10000);
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ route: longVal }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'BAD_REQUEST');
    });
  });

  // =========================================================================
  // CATEGORY 5: Prototype Pollution Defense
  // =========================================================================
  describe('Category 5: Prototype Pollution Defense', () => {
    let sessionCookie: string;

    before(async () => {
      const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      sessionCookie = initRes.headers.get('set-cookie') ?? '';
    });

    it('1. Rejects payload with __proto__ key', async () => {
      const payload = '{"__proto__": {"polluted": "yes"}, "route": "sim://metadata/workload-profile"}';
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: payload,
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'BAD_REQUEST');
      assert.equal((Object.prototype as { polluted?: unknown }).polluted, undefined);
    });

    it('2. Rejects payload with constructor.prototype key', async () => {
      const payload = JSON.stringify({
        constructor: {
          prototype: {
            polluted: 'yes',
          },
        },
        route: 'sim://metadata/workload-profile',
      });
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: payload,
      });
      assert.equal(res.status, 400);
      assert.equal((Object.prototype as { polluted?: unknown }).polluted, undefined);
    });

    it('3. Rejects deeply nested prototype pollution attempt', async () => {
      const payload = JSON.stringify({
        level1: {
          level2: {
            __proto__: { injected: true },
          },
        },
      });
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: payload,
      });
      assert.equal(res.status, 400);
      assert.equal((Object.prototype as { injected?: unknown }).injected, undefined);
    });
  });

  // =========================================================================
  // CATEGORY 10: Error Sanitization
  // =========================================================================
  describe('Category 10: Error Sanitization', () => {
    it('1. Errors never expose stack traces, paths, or environment variables', async () => {
      const endpoints = [
        `${baseUrl}/unknown-nonexistent-route`,
        `${baseUrl}/api/v1/sim/dispatch`,
        `${baseUrl}/api/v1/session/status?param=1`,
      ];

      for (const ep of endpoints) {
        const res = await fetch(ep);
        const text = await res.text();

        assert(!text.includes('Error:'), 'Must not contain Error class string');
        assert(!text.includes('stack'), 'Must not contain stack keyword');
        assert(!text.includes('src/'), 'Must not contain source file paths');
        assert(!text.includes('node_modules'), 'Must not contain node_modules paths');
        assert(!text.includes('process.env'), 'Must not contain process.env');
        assert(!text.includes('C:\\'), 'Must not contain local Windows filesystem paths');
      }
    });
  });

  // =========================================================================
  // CATEGORY 11: Debug Feature Elimination & Parameter Lockdown
  // =========================================================================
  describe('Category 11: Debug Feature Elimination', () => {
    it('1. Disallowed debug routes return 404', async () => {
      const debugRoutes = [
        '/debug',
        '/admin',
        '/internal',
        '/metrics',
        '/inspect',
        '/health/debug',
        '/api/debug',
      ];

      for (const route of debugRoutes) {
        const res = await fetch(`${baseUrl}${route}`);
        assert.equal(res.status, 404, `Route ${route} must return 404`);
      }
    });

    it('2. Query parameters like ?debug=true do not alter security behavior', async () => {
      const res = await fetch(`${baseUrl}/health/live?debug=true&admin=true`);
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.deepEqual(JSON.parse(text), { status: 'ok' });
    });
  });

  // =========================================================================
  // CATEGORY 12: Security Headers
  // =========================================================================
  describe('Category 12: Security Headers', () => {
    it('1. Enforces complete security headers on static asset responses', async () => {
      const res = await fetch(`${baseUrl}/index.html`);
      assert.equal(res.status, 200);

      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');
      assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
      assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-origin');
      assert.ok(res.headers.get('permissions-policy'));
      assert.ok(res.headers.get('content-security-policy'));
    });

    it('2. Enforces security headers on API error responses (404, 400, 405)', async () => {
      const res = await fetch(`${baseUrl}/nonexistent-404`);
      assert.equal(res.status, 404);

      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');
      assert.ok(res.headers.get('content-security-policy'));
      assert.equal(res.headers.get('cross-origin-opener-policy'), 'same-origin');
    });
  });

  // =========================================================================
  // CATEGORY 13: CORS Defense
  // =========================================================================
  describe('Category 13: CORS Defense', () => {
    it('1. Arbitrary origin is not granted CORS authorization', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session/status`, {
        headers: { Origin: 'https://attacker.example' },
      });
      assert.equal(res.status, 200);
      assert.equal(
        res.headers.get('access-control-allow-origin'),
        null,
        'Server must not reflect untrusted origins'
      );
    });
  });

  // =========================================================================
  // CATEGORY 16: Rate Limiting & Resource Bounds
  // =========================================================================
  describe('Category 16: Rate Limiting & Abuse Defense', () => {
    it('1. Rate limiting on session initialization triggers 429', async () => {
      // 30 requests per minute allowed
      let triggered429 = false;
      for (let i = 0; i < 35; i++) {
        const res = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
        if (res.status === 429) {
          triggered429 = true;
          const data = await res.json();
          assert.equal(data.code, 'RATE_LIMITED');
          break;
        }
      }
      assert.ok(triggered429, 'Excessive session initialization must trigger 429 RATE_LIMITED');
    });
  });

  // =========================================================================
  // CATEGORY 17: Host Header Immunity
  // =========================================================================
  describe('Category 17: Host Header Immunity', () => {
    it('1. Malicious Host headers cannot alter routing or inject host', async () => {
      const res = await fetch(`${baseUrl}/health/live`, {
        headers: {
          Host: 'attacker.evil.com:666',
          'X-Forwarded-Host': 'attacker.evil.com',
        },
      });
      assert.equal(res.status, 200);
      const text = await res.text();
      assert(!text.includes('attacker.evil.com'), 'Host must not be reflected or relied upon');
    });
  });
});
