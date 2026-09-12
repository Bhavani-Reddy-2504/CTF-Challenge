import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';
import { parseSimRoute } from '../../src/router/sim-parser.js';

describe('Category 6: Symbolic Route Security & Traversal Defense', () => {
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

  async function dispatchRoute(route: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ route }),
    });
    const body = await res.json();
    return { status: res.status, body };
  }

  it('1. Valid canonical route succeeds with status 200', async () => {
    const { status, body } = await dispatchRoute('sim://metadata/workload-profile');
    assert.equal(status, 200);
    assert.equal(body.status, 'ok');
    assert.ok(body.evidence);
  });

  it('2. Invalid route syntax throws InvalidSimRouteError / 400 Bad Request', async () => {
    const invalidSyntaxes = [
      '',
      'not_a_uri',
      'http://metadata/workload-profile',
      'sim:/metadata/workload-profile',
      'sim:///metadata/workload-profile',
      'sim://',
      'sim://metadata', // missing resource path
    ];

    for (const inv of invalidSyntaxes) {
      assert.throws(() => parseSimRoute(inv));
      const { status } = await dispatchRoute(inv);
      assert.equal(status, 400);
    }
  });

  it('3. Trailing slashes are strictly prohibited', async () => {
    const route = 'sim://metadata/workload-profile/';
    assert.throws(() => parseSimRoute(route));
    const { status } = await dispatchRoute(route);
    assert.equal(status, 400);
  });

  it('4. Consecutive forward slashes are strictly prohibited', async () => {
    const route = 'sim://metadata//workload-profile';
    assert.throws(() => parseSimRoute(route));
    const { status } = await dispatchRoute(route);
    assert.equal(status, 400);
  });

  it('5. Uppercase and mixed casing namespaces are rejected', async () => {
    const routes = [
      'sim://METADATA/workload-profile',
      'sim://Metadata/workload-profile',
      'sim://metadata/WORKLOAD-PROFILE',
    ];

    for (const route of routes) {
      assert.throws(() => parseSimRoute(route));
      const { status } = await dispatchRoute(route);
      assert.equal(status, 400);
    }
  });

  it('6. Query strings (?debug=true) are strictly prohibited in symbolic routes', async () => {
    const routes = [
      'sim://metadata/workload-profile?debug=true',
      'sim://metadata/workload-profile?admin=1',
    ];

    for (const route of routes) {
      assert.throws(() => parseSimRoute(route));
      const { status } = await dispatchRoute(route);
      assert.equal(status, 400);
    }
  });

  it('7. Fragment identifiers (#anchor) are strictly prohibited', async () => {
    const route = 'sim://metadata/workload-profile#fragment';
    assert.throws(() => parseSimRoute(route));
    const { status } = await dispatchRoute(route);
    assert.equal(status, 400);
  });

  it('8. Directory traversal (..) is strictly prohibited', async () => {
    const traversalRoutes = [
      'sim://metadata/../evaluation/submission-context',
      'sim://metadata/workload-profile/..',
      'sim://metadata/./workload-profile',
    ];

    for (const route of traversalRoutes) {
      assert.throws(() => parseSimRoute(route));
      const { status } = await dispatchRoute(route);
      assert.equal(status, 400);
    }
  });

  it('9. Percent-encoded traversal (%2e%2e) is strictly prohibited', async () => {
    const encodedRoutes = [
      'sim://metadata/%2e%2e/evaluation',
      'sim://metadata/%2e%2e%2fworkload-profile',
      'sim://metadata/workload%2dprofile',
    ];

    for (const route of encodedRoutes) {
      assert.throws(() => parseSimRoute(route));
      const { status } = await dispatchRoute(route);
      assert.equal(status, 400);
    }
  });

  it('10. Double-encoded traversal (%252e%252e) is strictly prohibited', async () => {
    const doubleEncoded = 'sim://metadata/%252e%252e/evaluation';
    assert.throws(() => parseSimRoute(doubleEncoded));
    const { status } = await dispatchRoute(doubleEncoded);
    assert.equal(status, 400);
  });

  it('11. Null byte injection (%00, \\0) is strictly prohibited', async () => {
    const nullByteRoutes = [
      'sim://metadata/workload-profile\x00',
      'sim://metadata/workload-profile%00',
    ];

    for (const route of nullByteRoutes) {
      assert.throws(() => parseSimRoute(route));
      const { status } = await dispatchRoute(route);
      assert.equal(status, 400);
    }
  });

  it('12. Unexpected file extension appendages (.json, .ts) are prohibited', async () => {
    const extRoutes = [
      'sim://metadata/workload-profile.json',
      'sim://metadata/workload-profile.ts',
      'sim://metadata/workload-profile.js',
    ];

    for (const route of extRoutes) {
      assert.throws(() => parseSimRoute(route));
      const { status } = await dispatchRoute(route);
      assert.equal(status, 400);
    }
  });

  it('13. Userinfo and authority delimiters (@, :) are strictly forbidden', async () => {
    const authorityRoutes = [
      'sim://user:pass@metadata/workload-profile',
      'sim://metadata:8080/workload-profile',
    ];

    for (const route of authorityRoutes) {
      assert.throws(() => parseSimRoute(route));
      const { status } = await dispatchRoute(route);
      assert.equal(status, 400);
    }
  });
});
