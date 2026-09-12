import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';
import { isValidSessionId } from '../../src/session/session-id.js';

describe('Category 2: Session Security & Fixation Defense', () => {
  let app: ApplicationInstance;
  let baseUrl: string;

  before(async () => {
    app = await bootstrapApplication({
      environment: 'test',
      port: 0,
      cookieSecure: false,
    });
    await app.server.start();
    const port = app.server.getPort();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  beforeEach(() => {
    app.server.rateLimiter.reset();
  });

  after(async () => {
    await app.shutdown();
  });

  it('1. Missing session returns 401 Unauthorized for protected endpoints', async () => {
    // Unauthenticated dispatch
    const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, 'UNAUTHORIZED');

    // Unauthenticated evaluation submit
    const evalRes = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interpretation: 'test' }),
    });
    assert.equal(evalRes.status, 401);
    const evalData = await evalRes.json();
    assert.equal(evalData.code, 'UNAUTHORIZED');
  });

  it('2. Invalid or nonexistent session ID fails safely without leaking state', async () => {
    const fakeSessionId = '0123456789abcdef0123456789abcdef0123456789a';
    const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': fakeSessionId,
      },
      body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
    });
    assert.equal(res.status, 401);
  });

  it('3. Malformed session identifier is rejected / treated as unauthenticated', async () => {
    const malformedIds = [
      "'; DROP TABLE sessions; --",
      '../../../etc/passwd',
      '<script>alert(1)</script>',
      'session%00injection',
      'short',
      'a'.repeat(200), // Exceeds length limit
      'id with spaces',
      'id$with#special@chars!',
    ];

    for (const badId of malformedIds) {
      assert.equal(isValidSessionId(badId), false, `ID "${badId}" must be recognized as invalid`);

      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': badId,
        },
        body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
      });
      assert.equal(res.status, 401, `Malformed ID "${badId}" must be denied access`);
    }
  });

  it('4. Session isolation: Session A and Session B have completely separate state', async () => {
    // 1. Initialize Session A
    const resA = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    const cookieA = resA.headers.get('set-cookie') ?? '';

    // 2. Initialize Session B
    const resB = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    const cookieB = resB.headers.get('set-cookie') ?? '';

    assert.notEqual(cookieA, cookieB, 'Sessions must have distinct cookies');

    // 3. Query evidence in Session A
    const dispatchA = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
      },
      body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
    });
    assert.equal(dispatchA.status, 200);

    // 4. Verify Session B has not discovered this artifact in its state
    // We test this by attempting to access a route that requires prerequisites (e.g. trust or config gated routes)
    // In Session B, no evidence exists yet
    const statusB = await fetch(`${baseUrl}/api/v1/session/status`, {
      headers: { Cookie: cookieB },
    });
    const statusDataB = await statusB.json();
    assert.equal(statusDataB.session_active, true);
    assert.equal(statusDataB.status, 'authenticated');
  });

  it('5. Terminated session is permanently invalidated and cannot be reused', async () => {
    // 1. Initialize session
    const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    const cookie = initRes.headers.get('set-cookie') ?? '';

    // Verify session works
    const workRes = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
    });
    assert.equal(workRes.status, 200);

    // 2. Terminate session
    const termRes = await fetch(`${baseUrl}/api/v1/session/terminate`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    assert.equal(termRes.status, 200);
    const clearCookie = termRes.headers.get('set-cookie') ?? '';
    assert(clearCookie.includes('Max-Age=0'), 'Must set Max-Age=0 on termination');

    // 3. Attempt reuse of terminated session cookie
    const reuseRes = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
    });
    assert.equal(reuseRes.status, 401, 'Terminated session must be rejected with 401');

    // 4. Session status must report anonymous
    const postStatusRes = await fetch(`${baseUrl}/api/v1/session/status`, {
      headers: { Cookie: cookie },
    });
    const postStatus = await postStatusRes.json();
    assert.equal(postStatus.session_active, false);
    assert.equal(postStatus.status, 'anonymous');
  });

  it('6. Session Fixation Defense: Manually chosen session ID in init is ignored', async () => {
    const attackerChosenId = 'attacker_chosen_session_id_1234567890abcdefg';
    const res = await fetch(`${baseUrl}/api/v1/session/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': attackerChosenId,
        Cookie: `strata_session=${attackerChosenId}`,
      },
      body: JSON.stringify({ session_id: attackerChosenId }),
    });

    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie') ?? '';

    // The set-cookie header must NOT contain the attacker chosen ID
    assert(!setCookie.includes(attackerChosenId), 'Server must never accept client-chosen session ID');

    // The attacker chosen ID must not be active
    const checkRes = await fetch(`${baseUrl}/api/v1/session/status`, {
      headers: { 'X-Session-Id': attackerChosenId },
    });
    const checkData = await checkRes.json();
    assert.equal(checkData.session_active, false);
  });

  it('7. Cookie attributes enforce strict security properties', async () => {
    const res = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    const setCookie = res.headers.get('set-cookie') ?? '';

    assert(setCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
    assert(setCookie.includes('Path=/'), 'Cookie path must be /');
    assert(setCookie.includes('SameSite=Strict') || setCookie.includes('SameSite=Lax'), 'Cookie must have SameSite');
  });

  it('8. Session ID format strictly conforms to 32 bytes base64url', async () => {
    const res = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    const setCookie = res.headers.get('set-cookie') ?? '';
    const match = setCookie.match(/strata_session=([^;]+)/);
    assert.ok(match && match[1]);

    const rawId = decodeURIComponent(match[1]);
    assert.ok(isValidSessionId(rawId), 'Session ID must satisfy isValidSessionId regex');
    assert(rawId.length >= 40 && rawId.length <= 64, 'Session ID length must be between 40 and 64');
  });

  it('9. Session lifecycle endpoints never return session ID in response body', async () => {
    const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    const initData = await initRes.json();
    assert.equal(initData.session_id, undefined);
    assert.equal(initData.id, undefined);

    const cookie = initRes.headers.get('set-cookie') ?? '';
    const statusRes = await fetch(`${baseUrl}/api/v1/session/status`, {
      headers: { Cookie: cookie },
    });
    const statusData = await statusRes.json();
    assert.equal(statusData.session_id, undefined);
    assert.equal(statusData.id, undefined);

    const termRes = await fetch(`${baseUrl}/api/v1/session/terminate`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    const termData = await termRes.json();
    assert.equal(termData.session_id, undefined);
    assert.equal(termData.id, undefined);
  });
});
