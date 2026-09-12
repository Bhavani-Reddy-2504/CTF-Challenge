import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      const port = typeof address === 'object' && address ? address.port : 18080;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

describe('Prompt 17: End-to-End Production Smoke & Operational Validation', () => {
  let app: ApplicationInstance;
  let baseUrl: string;
  let sessionCookie: string;

  before(async () => {
    const port = await getAvailablePort();
    app = await bootstrapApplication({
      environment: 'production',
      port,
      logLevel: 'error',
      cookieSecure: true,
    });
    await app.server.start();
    const assignedPort = app.server.getPort();
    baseUrl = `http://127.0.0.1:${assignedPort}`;
  });

  after(async () => {
    await app.shutdown();
  });

  it('1. Server starts cleanly and enters READY state', () => {
    assert.equal(app.server.getState(), 'READY');
    assert.ok(app.server.getPort() > 0);
  });

  it('2. Health endpoint GET /health returns 200 OK', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { status: 'OK' });
  });

  it('3. Readiness endpoint GET /ready returns 200 READY', async () => {
    const res = await fetch(`${baseUrl}/ready`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { status: 'READY' });
  });

  it('4. Serves all static player runtime assets with correct MIME types and security headers', async () => {
    // 1. Root
    const rootRes = await fetch(`${baseUrl}/`);
    assert.equal(rootRes.status, 200);
    assert.match(rootRes.headers.get('content-type') ?? '', /text\/html/);

    // 2. Index HTML
    const htmlRes = await fetch(`${baseUrl}/index.html`);
    assert.equal(htmlRes.status, 200);
    assert.match(htmlRes.headers.get('content-type') ?? '', /text\/html/);

    // 3. Stylesheet
    const cssRes = await fetch(`${baseUrl}/index.css`);
    assert.equal(cssRes.status, 200);
    assert.match(cssRes.headers.get('content-type') ?? '', /text\/css/);

    // 4. Client JS
    const jsRes = await fetch(`${baseUrl}/app.js`);
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers.get('content-type') ?? '', /application\/javascript/);

    // Security headers on static assets
    assert.equal(rootRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(rootRes.headers.get('x-frame-options'), 'DENY');
    assert.ok(rootRes.headers.get('content-security-policy')?.includes("default-src 'self'"));
    assert.ok(rootRes.headers.get('cache-control')?.includes('no-store'));
  });

  it('5. Production session lifecycle: init, status, and termination', async () => {
    // 1. Initialize
    const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    assert.equal(initRes.status, 200);
    const setCookie = initRes.headers.get('set-cookie');
    assert.ok(setCookie, 'Must set session cookie');
    assert.ok(setCookie.includes('Secure'), 'Production cookie must be Secure');
    assert.ok(setCookie.includes('HttpOnly'), 'Production cookie must be HttpOnly');
    assert.ok(setCookie.includes('SameSite=Strict'), 'Production cookie must be SameSite=Strict');

    sessionCookie = setCookie;

    const initBody = await initRes.json();
    assert.equal(initBody.session_active, true);
    assert.equal(initBody.session_id, undefined, 'Must not leak session_id in body');

    // 2. Status with session
    const statusRes = await fetch(`${baseUrl}/api/v1/session/status`, {
      headers: { Cookie: sessionCookie },
    });
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();
    assert.equal(statusBody.session_active, true);
  });

  it('6. Symbolic route dispatch functions correctly under active session', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.evidence, 'Should return dispatch evidence');
    assert.equal(body.evidence.id, 'EVD-META-01-PROFILE');
  });

  it('7. Evaluation boundary remains server-side with uniform rejection', async () => {
    const res = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ interpretation: 'WRONG_GUESS_TEST' }),
    });

    // Ungated evaluation safely produces uniform 422 error without leaking prerequisites
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.code, 'ERR_EVALUATION_CONTEXT_NOT_ESTABLISHED');
    assert.equal(body.flag, undefined, 'Must not leak flag');
    assert.equal(body.score, undefined, 'Must not leak score or partial matches');
    assert(!JSON.stringify(body).includes('EVD-'), 'Must not leak evidence IDs');
  });

  it('8. Session termination cleans up session and clears cookie', async () => {
    const termRes = await fetch(`${baseUrl}/api/v1/session/terminate`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });
    assert.equal(termRes.status, 200);
    const clearCookie = termRes.headers.get('set-cookie');
    assert.ok(clearCookie?.includes('Max-Age=0'));

    // Verify session is now inactive
    const afterRes = await fetch(`${baseUrl}/api/v1/session/status`, {
      headers: { Cookie: sessionCookie },
    });
    const afterBody = await afterRes.json();
    assert.equal(afterBody.session_active, false);
  });

  it('9. Rejects invalid or malformed requests with sanitized error payloads', async () => {
    // 1. Unknown endpoint
    const notFoundRes = await fetch(`${baseUrl}/nonexistent/random/path`);
    assert.equal(notFoundRes.status, 404);
    const notFoundBody = await notFoundRes.json();
    assert.equal(notFoundBody.code, 'NOT_FOUND');

    // 2. Invalid method on dispatch
    const methodRes = await fetch(`${baseUrl}/api/v1/sim/dispatch`, { method: 'GET' });
    assert.equal(methodRes.status, 405);
    const methodBody = await methodRes.json();
    assert.equal(methodBody.code, 'METHOD_NOT_ALLOWED');
  });
});
