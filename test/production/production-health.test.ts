import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';

describe('Prompt 17: Production Health & Readiness Monitoring', () => {
  let app: ApplicationInstance;
  let baseUrl: string;

  before(async () => {
    app = await bootstrapApplication({
      environment: 'test',
      port: 0,
      logLevel: 'error',
    });
    await app.server.start();
    const port = app.server.getPort();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await app.shutdown();
  });

  it('1. GET /health returns minimal status OK response without metadata', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.deepEqual(body, { status: 'OK' });
  });

  it('2. GET /ready confirms readiness to accept player traffic', async () => {
    const res = await fetch(`${baseUrl}/ready`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.deepEqual(body, { status: 'READY' });
  });

  it('3. Health and readiness endpoints expose zero operational internals or versions', async () => {
    const endpoints = ['/health', '/ready', '/health/live', '/health/ready'];

    for (const ep of endpoints) {
      const res = await fetch(`${baseUrl}${ep}`);
      const text = await res.text();

      // Forbid sensitive metadata leakage
      const forbiddenTokens = [
        'version',
        'dependencies',
        'modules',
        'metadata',
        'uptime',
        'pid',
        'process',
        'memory',
        'hostname',
        'config',
        'env',
        'node_env',
        'session',
        'topology',
        'evidence',
      ];

      for (const token of forbiddenTokens) {
        assert(
          !text.toLowerCase().includes(token),
          `Endpoint ${ep} must not leak '${token}': ${text}`
        );
      }
    }
  });

  it('4. Preserves backward compatibility for /health/live and /health/ready', async () => {
    const liveRes = await fetch(`${baseUrl}/health/live`);
    assert.equal(liveRes.status, 200);
    const liveData = await liveRes.json();
    assert.deepEqual(liveData, { status: 'ok' });

    const readyRes = await fetch(`${baseUrl}/health/ready`);
    assert.equal(readyRes.status, 200);
    const readyData = await readyRes.json();
    assert.deepEqual(readyData, { status: 'ok' });
  });

  it('5. Disallows non-GET methods on health and readiness endpoints', async () => {
    const invalidMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];

    for (const method of invalidMethods) {
      for (const path of ['/health', '/ready']) {
        const res = await fetch(`${baseUrl}${path}`, { method });
        assert.equal(res.status, 405, `Method ${method} should be rejected on ${path}`);
      }
    }
  });

  it('6. Health responses include mandatory security and cache headers', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.ok(res.headers.get('cache-control')?.includes('no-store'));
  });
});
