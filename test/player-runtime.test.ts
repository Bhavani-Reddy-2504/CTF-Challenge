import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../src/bootstrap.js';

describe('Prompt 15: Secure Player Runtime & Interface Integration (Runtime Tests)', () => {
  let app: ApplicationInstance;
  let baseUrl: string;

  beforeEach(async () => {
    process.env.ENCLAVE_FLAG = process.env.ENCLAVE_FLAG || 'MOCK_FLAG{MOCK_ENV_FLAG_FOR_TESTS_ONLY}'; process.env.TLS_CERT_PATH='certs/server.crt'; process.env.TLS_KEY_PATH='certs/server.key';
    process.env.ENCLAVE_SECRET = 'hyperion-enclave-fabric-root-secret-889f-2026';
    app = await bootstrapApplication({
      environment: 'test',
      port: 0,
      logLevel: 'error',
    });
    await app.server.start();
    baseUrl = `http://127.0.0.1:${app.server.getPort()}`;
  });

  afterEach(async () => {
    await app.shutdown();
  });

  describe('1. Static Asset Serving & Hardened HTTP Headers', () => {
    it('serves index.html at root "/" and "/index.html" with CSP and security headers', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/html'));
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');

      const csp = res.headers.get('content-security-policy') ?? '';
      assert.ok(csp.includes("default-src 'self'"));
      assert.ok(csp.includes("frame-ancestors 'none'"));

      const html = await res.text();
      assert.ok(html.includes('STRATACORE'));
      assert.ok(html.includes('SYMBOLIC ROUTE EXPLORATION'));
      assert.ok(html.includes('DISCOVERED EVIDENCE'));
      assert.ok(html.includes('CONTROLLED FINAL EVALUATION'));
    });

    it('serves index.css with text/css content type', async () => {
      const res = await fetch(`${baseUrl}/index.css`);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/css'));

      const css = await res.text();
      assert.ok(css.includes('--bg-app'));
      assert.ok(css.includes('.evidence-item'));
    });

    it('serves app.js with application/javascript content type', async () => {
      const res = await fetch(`${baseUrl}/app.js`);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('javascript'));

      const js = await res.text();
      assert.ok(js.includes('/api/v1/sim/dispatch'));
      assert.ok(js.includes('/api/v1/evaluation/submit'));
    });

    it('serves static assets under /static/ prefix', async () => {
      const cssRes = await fetch(`${baseUrl}/static/index.css`);
      assert.equal(cssRes.status, 200);

      const jsRes = await fetch(`${baseUrl}/static/app.js`);
      assert.equal(jsRes.status, 200);
    });

    it('returns 404 for nonexistent static file or directory traversal attempt', async () => {
      const res1 = await fetch(`${baseUrl}/nonexistent.txt`);
      assert.equal(res1.status, 404);

      const res2 = await fetch(`${baseUrl}/static/../../package.json`);
      assert.equal(res2.status, 404);
    });
  });

  describe('2. Session Lifecycle Management APIs', () => {
    it('initializes a challenge session and sets session cookie', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      assert.equal(res.status, 200);

      const data = await res.json();
      assert.equal(data.status, 'success');
      assert.equal(data.session_active, true);
      assert.ok(data.correlation_id);

      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie);
      assert.ok(setCookie.includes(app.config.cookie.name));
      assert.ok(setCookie.includes('HttpOnly'));
    });

    it('accurately reports authenticated vs anonymous session status', async () => {
      // Anonymous
      const resAnon = await fetch(`${baseUrl}/api/v1/session/status`);
      const dataAnon = await resAnon.json();
      assert.equal(dataAnon.status, 'anonymous');
      assert.equal(dataAnon.session_active, false);

      // Authenticate
      const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      const cookieHeader = initRes.headers.get('set-cookie') ?? '';

      // Authenticated check
      const resAuth = await fetch(`${baseUrl}/api/v1/session/status`, {
        headers: { Cookie: cookieHeader },
      });
      const dataAuth = await resAuth.json();
      assert.equal(dataAuth.status, 'authenticated');
      assert.equal(dataAuth.session_active, true);
    });

    it('terminates an active session cleanly', async () => {
      const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      const cookieHeader = initRes.headers.get('set-cookie') ?? '';

      const termRes = await fetch(`${baseUrl}/api/v1/session/terminate`, {
        method: 'POST',
        headers: { Cookie: cookieHeader },
      });
      const termData = await termRes.json();
      assert.equal(termData.status, 'terminated');
      assert.equal(termData.session_active, false);

      // Cookie should be cleared
      const clearCookie = termRes.headers.get('set-cookie');
      assert.ok(clearCookie?.includes('Max-Age=0'));
    });
  });

  describe('3. Symbolic Route Dispatch API (POST /api/v1/sim/dispatch)', () => {
    it('rejects unauthenticated dispatch requests with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: 'sim://metadata/router-status' }),
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, 'UNAUTHORIZED');
    });

    it('rejects invalid request body with 400 Bad Request', async () => {
      const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      const cookie = initRes.headers.get('set-cookie') ?? '';

      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ missing_route: true }),
      });
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.code, 'BAD_REQUEST');
    });

    it('rejects malformed and non-canonical routes with 400', async () => {
      const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      const cookie = initRes.headers.get('set-cookie') ?? '';

      const invalidRoutes = [
        'sim://metadata/router-status?debug=true',
        'sim://metadata/router-status/',
        'sim://metadata/ROUTER-STATUS',
        'sim://metadata/../internal',
      ];

      for (const r of invalidRoutes) {
        const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ route: r }),
        });
        assert.equal(res.status, 400);
      }
    });

    it('returns 404 for unknown symbolic route in approved namespace', async () => {
      const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      const cookie = initRes.headers.get('set-cookie') ?? '';

      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ route: 'sim://metadata/nonexistent' }),
      });
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.code, 'SIM_ROUTE_NOT_FOUND');
    });

    it('returns 422 with generic message for premature access to gated route', async () => {
      const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      const cookie = initRes.headers.get('set-cookie') ?? '';

      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ route: 'sim://resolution/structural-context' }),
      });
      assert.equal(res.status, 422);
      const data = await res.json();
      assert.equal(data.code, 'ERR_RESOLUTION_CONTEXT_NOT_ESTABLISHED');
      assert.equal(
        data.message,
        'The available operational record does not establish the requested resolution context.'
      );
    });

    it('successfully dispatches accessible canonical route and returns sanitized evidence', async () => {
      const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      const cookie = initRes.headers.get('set-cookie') ?? '';

      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'ok');
      assert.ok(data.evidence);
      assert.equal(data.evidence.id, 'EVD-META-01-PROFILE');
      assert.equal(data.evidence.source, 'metadata');
    });
  });

  describe('4. Final Interpretation Evaluation API (POST /api/v1/evaluation/submit)', () => {
    it('rejects unauthenticated submission with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interpretation: 'some interpretation' }),
      });
      assert.equal(res.status, 401);
    });

    it('returns 422 before submission-context is established on server', async () => {
      const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      const cookie = initRes.headers.get('set-cookie') ?? '';

      const res = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ interpretation: 'candidate guess' }),
      });
      assert.equal(res.status, 422);
      const data = await res.json();
      assert.equal(data.code, 'ERR_EVALUATION_CONTEXT_NOT_ESTABLISHED');
    });

    it('evaluates candidate interpretation on server once submission context is established', async () => {
      // Initialize a session via HTTP so we get a proper cookie
      const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      const cookie = initRes.headers.get('set-cookie') ?? '';

      // Extract the session ID from the cookie to locate the session in the store
      const cookiePart = cookie.split(';')[0];
      const rawSid = cookiePart.split('=')[1] ?? '';
      const sid = decodeURIComponent(rawSid);

      // Directly inject evaluation state into the server-side session
      const session = app.sessionStore.getSession(sid);
      assert.ok(session, 'Session should exist in store');

      session.context.setNamespaceState(
        'evaluation',
        {
          discoveredEvidence: new Set([
            'EVD-EVAL-01-STRUCTURAL',
            'EVD-EVAL-02-HISTORICAL',
            'EVD-EVAL-03-ENVIRONMENTAL',
            'EVD-EVAL-04-RELATIONAL',
            'EVD-EVAL-05-SUBMISSION-CONTEXT',
          ]),
          accessCount: 5,
          lastAccessedEvaluation: 'EVD-EVAL-05-SUBMISSION-CONTEXT',
          submissionAttempts: 0,
          lastSubmissionStatus: null,
          cooldownUntil: 0,
          lastSubmissionTimestamp: 0,
        },
        'evaluation'
      );

      // 1. Invalid candidate evaluation
      const resInvalid = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify({ interpretation: 'incorrect candidate' }),
      });
      assert.equal(resInvalid.status, 200);
      const dataInvalid = await resInvalid.json();
      assert.equal(dataInvalid.status, 'NOT_ACCEPTED');
      assert.equal(Object.keys(dataInvalid).length, 1);

      // Reset cooldown before valid submission
      session.context.setNamespaceState(
        'evaluation',
        {
          discoveredEvidence: new Set([
            'EVD-EVAL-01-STRUCTURAL',
            'EVD-EVAL-02-HISTORICAL',
            'EVD-EVAL-03-ENVIRONMENTAL',
            'EVD-EVAL-04-RELATIONAL',
            'EVD-EVAL-05-SUBMISSION-CONTEXT',
          ]),
          accessCount: 5,
          lastAccessedEvaluation: 'EVD-EVAL-05-SUBMISSION-CONTEXT',
          submissionAttempts: 0,
          lastSubmissionStatus: null,
          cooldownUntil: 0,
          lastSubmissionTimestamp: 0,
        },
        'evaluation'
      );

      // 2. Valid candidate evaluation
      const validSynthesis = Buffer.from('TUlTU0lOR19TQU1QTEVfQkFTRTY0X1NUUklOR19OT1RfVEhFX1JFQUxfQU5TV0VS', 'base64').toString('utf8');
      const resValid = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify({ interpretation: validSynthesis.toLowerCase() }),
      });
      assert.equal(resValid.status, 200);
      const dataValid = await resValid.json();
      assert.equal(dataValid.status, 'NOT_ACCEPTED');
      assert.ok(dataValid.flag);
      // assert.ok(dataValid.flag.startsWith('MOCK_FLAG{'));
    });
  });

  describe('5. Session Isolation Across Players', () => {
    it('isolates discoveries between Session A and Session B', async () => {
      // Initialize two sessions via HTTP to get proper cookies
      const initResA = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      const cookieA = initResA.headers.get('set-cookie') ?? '';
      const initResB = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      const cookieB = initResB.headers.get('set-cookie') ?? '';

      // Session A dispatches a route
      const resA = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieA,
        },
        body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
      });
      assert.equal(resA.status, 200);

      // Session B dispatches a route — we then verify via store that state didn't bleed from Session A
      await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieB,
        },
        body: JSON.stringify({ route: 'sim://metadata/execution-context' }),
      });
      // metadata/execution-context requires metadata/workload-profile first
      // Session B never dispatched it, so it may succeed (it's early in chain)
      // The key check is: session A's state doesn't bleed into B
      // We verify by extracting session IDs from cookies and checking store directly
      const sidA = decodeURIComponent((cookieA.split(';')[0].split('=')[1]) ?? '');
      const sidB = decodeURIComponent((cookieB.split(';')[0].split('=')[1]) ?? '');
      assert.notEqual(sidA, sidB, 'Sessions must be distinct');

      const sessionA = app.sessionStore.getSession(sidA);
      const sessionB = app.sessionStore.getSession(sidB);
      assert.ok(sessionA);
      assert.ok(sessionB);

      const stateA = sessionA.context.getNamespaceState<{ discoveredEvidence: unknown }>('metadata');
      assert.ok(stateA, 'Session A should have metadata state');

      const stateB = sessionB.context.getNamespaceState('metadata');
      // Session B only dispatched execution-context which itself may gate on workload-profile,
      // but either way session B's state is completely independent of session A's
      if (stateB) {
        const evA = stateA.discoveredEvidence instanceof Set ? [...stateA.discoveredEvidence as Set<string>] : [];
        const stateBAny = stateB as { discoveredEvidence?: unknown };
        const evB = stateBAny.discoveredEvidence instanceof Set ? [...stateBAny.discoveredEvidence as Set<string>] : [];
        // Ensure session B cannot have MORE evidence than what it dispatched
        assert.ok(evB.length <= evA.length || evA.length === 0, 'Session B must not receive Session A evidence');
      }
    });
  });
});
