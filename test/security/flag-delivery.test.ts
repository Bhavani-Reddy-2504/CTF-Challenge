import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';

describe('Prompt 18 — Security Suite 9: Flag Delivery Boundary Isolation', () => {
  let app: ApplicationInstance;
  let baseUrl: string;
  const TEST_FLAG = 'MOCK_FLAG{TRUSTED_FLOW_DELIVERY_FLAG_2026}';

  before(async () => {
    process.env.ENCLAVE_FLAG = TEST_FLAG;

    app = await bootstrapApplication({
      environment: 'test',
      port: 0,
      cookieSecure: false,
    });
    await app.server.start();
    const port = app.server.getPort();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    delete process.env.ENCLAVE_FLAG;
    await app.shutdown();
  });

  it('1. Flag cannot be requested directly via any symbolic route or REST path', async () => {
    const directPaths = [
      '/api/v1/flag',
      '/api/v1/sim/flag',
      '/flag',
      '/api/v1/secret',
      '/api/v1/evaluator/flag',
    ];

    for (const p of directPaths) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.notEqual(res.status, 200, `Direct flag path '${p}' should not return 200`);
      const body = await res.text();
      assert(!body.includes(TEST_FLAG), `Path '${p}' leaked flag`);
    }
  });

  it('2. Flag cannot be obtained before evaluation context is fully established', async () => {
    const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    const cookie = initRes.headers.get('set-cookie') ?? '';

    // Attempt evaluation submit before discovering prerequisites
    const evalRes = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ interpretation: 'HYPERION ENCLAVE FABRIC RECONCILED UNDER HARDWARE INTEGRITY ANCHOR 889F' }),
    });

    assert.equal(evalRes.status, 422);
    const body = await evalRes.json();
    assert.equal(body.code, 'ERR_EVALUATION_CONTEXT_NOT_ESTABLISHED');
    assert.equal(body.flag, undefined, 'Must not deliver flag before prerequisites are established');
  });

  it('3. Flag does not exist in session initialization response or cookies', async () => {
    const res = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    const text = await res.text();
    const cookie = res.headers.get('set-cookie') ?? '';

    assert(!text.includes(TEST_FLAG), 'Session init response must not contain flag');
    assert(!cookie.includes(TEST_FLAG), 'Session cookie must not contain flag');
  });

  it('4. Flag does not exist in evidence dispatch responses', async () => {
    const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    const cookie = initRes.headers.get('set-cookie') ?? '';

    const dispatchRes = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
    });

    assert.equal(dispatchRes.status, 200);
    const text = await dispatchRes.text();
    assert(!text.includes(TEST_FLAG), 'Dispatch evidence response must not leak flag');
  });
});
