import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { bootstrapApplication, ApplicationInstance } from '../src/bootstrap.js';

describe('Health and Readiness Tests (Requirements 38-40)', () => {
  let app: ApplicationInstance;
  let baseUrl: string;

  before(async () => {
    app = await bootstrapApplication({
      environment: 'test',
      port: 0, // OS assigned ephemeral port
      cookieSecure: false,
    });
    await app.server.start();
    const port = app.server.getPort();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await app.shutdown();
  });

  it('38. Liveness probe is safe and returns ok', async () => {
    const res = await fetch(`${baseUrl}/health/live`);
    assert.equal(res.status, 200);

    // Verify security headers
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');

    const data = await res.json();
    assert.deepEqual(data, { status: 'ok' });
  });

  it('39. Readiness probe is safe and returns ok when engine is ready', async () => {
    const res = await fetch(`${baseUrl}/health/ready`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.deepEqual(data, { status: 'ok' });
  });

  it('40. Health responses expose no internal architecture, config, or secrets', async () => {
    const liveRes = await fetch(`${baseUrl}/health/live`);
    const liveJson = await liveRes.text();

    const readyRes = await fetch(`${baseUrl}/health/ready`);
    const readyJson = await readyRes.text();

    for (const json of [liveJson, readyJson]) {
      assert(!json.includes('config'), 'Health probe must not leak config');
      assert(!json.includes('env'), 'Health probe must not leak env');
      assert(!json.includes('modules'), 'Health probe must not leak module list');
      assert(!json.includes('version'), 'Health probe must not leak software version');
      assert(!json.includes('secret'), 'Health probe must not leak secrets');
      assert(!json.includes('memory'), 'Health probe must not leak memory details');
      assert(!json.includes('uptime'), 'Health probe must not leak system uptime');
    }
  });

  it('Bonus: Session lifecycle endpoints operate correctly and protect session ID', async () => {
    // 1. Check unauthenticated session status
    const statusRes = await fetch(`${baseUrl}/api/v1/session/status`);
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.equal(statusData.session_active, false);

    // 2. Initialize new session
    const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    assert.equal(initRes.status, 200);
    const setCookie = initRes.headers.get('set-cookie');
    assert.ok(setCookie, 'Set-Cookie header must be provided');
    assert(setCookie.includes('strata_session='), 'Cookie name must match');
    assert(setCookie.includes('HttpOnly'), 'HttpOnly must be set');
    assert(setCookie.includes('SameSite=Strict'), 'SameSite=Strict must be set');

    // Verify response body does NOT leak session ID
    const initData = await initRes.json();
    assert.equal(initData.session_active, true);
    assert.equal(initData.session_id, undefined, 'Session ID must not be leaked in body');

    // 3. Verify session status with cookie attached
    const authStatusRes = await fetch(`${baseUrl}/api/v1/session/status`, {
      headers: { Cookie: setCookie },
    });
    assert.equal(authStatusRes.status, 200);
    const authStatusData = await authStatusRes.json();
    assert.equal(authStatusData.session_active, true);

    // 4. Terminate session
    const termRes = await fetch(`${baseUrl}/api/v1/session/terminate`, {
      method: 'POST',
      headers: { Cookie: setCookie },
    });
    assert.equal(termRes.status, 200);
    const clearCookie = termRes.headers.get('set-cookie');
    assert.ok(clearCookie);
    assert(clearCookie.includes('Max-Age=0'), 'Must clear cookie with Max-Age=0');

    // 5. Verify terminated session is no longer active
    const postTermStatusRes = await fetch(`${baseUrl}/api/v1/session/status`, {
      headers: { Cookie: setCookie },
    });
    const postTermStatusData = await postTermStatusRes.json();
    assert.equal(postTermStatusData.session_active, false);
  });
});
