import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';
import { Logger, LogEntry } from '../../src/logging/logger.js';

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

describe('Prompt 17: Production Security, Backdoor Prevention & Operational Observability', () => {
  let app: ApplicationInstance;
  let baseUrl: string;
  const capturedLogs: LogEntry[] = [];

  before(async () => {
    const port = await getAvailablePort();
    app = await bootstrapApplication({
      environment: 'production',
      port,
      logLevel: 'debug',
      cookieSecure: true, // required in production
    });

    // Tap into logger sink to inspect operational logs
    app.logger.setSink((entry) => {
      capturedLogs.push(entry);
    });

    await app.server.start();
    const assignedPort = app.server.getPort();
    baseUrl = `http://127.0.0.1:${assignedPort}`;
  });

  after(async () => {
    await app.shutdown();
  });

  it('1. Production error responses strictly suppress stack traces, paths, and line numbers', async () => {
    // Malformed body on route dispatch
    const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'INVALID_JSON_STREAM{{{',
    });

    const raw = await res.text();
    assert(!raw.includes('at '), 'Response must not contain stack traces');
    assert(!raw.includes('node_modules'), 'Response must not contain node_modules paths');
    assert(!raw.includes('.ts:'), 'Response must not contain source file line numbers');
    assert(!raw.includes('.js:'), 'Response must not contain source file line numbers');
    assert(!raw.includes('Error:'), 'Response must not contain internal error class names');
  });

  it('2. Debug query parameters do not bypass discovery, evaluation, or reveal state', async () => {
    const debugQueries = [
      '?debug=true',
      '?debug=1',
      '?admin=true',
      '?admin=1',
      '?dev=true',
      '?test=true',
      '?bypass=true',
      '?evaluator=true',
    ];

    for (const query of debugQueries) {
      // 1. Unauthenticated dispatch with debug query
      const dispatchRes = await fetch(`${baseUrl}/api/v1/sim/dispatch${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: 'sim://telemetry/read' }),
      });
      assert.equal(dispatchRes.status, 401, `Debug query ${query} should not bypass authentication`);

      // 2. Evaluation submit with debug query
      const evalRes = await fetch(`${baseUrl}/api/v1/evaluation/submit${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate: 'HYPERION_TEST' }),
      });
      assert.equal(evalRes.status, 401, `Debug query ${query} should not bypass evaluation session check`);
    }
  });

  it('3. Privileged headers do not grant administrative bypass or leak internal state', async () => {
    const privilegedHeaders: Record<string, string>[] = [
      { 'X-Debug': 'true' },
      { 'X-Admin': 'true' },
      { 'X-Internal': 'true' },
      { 'X-Privileged': 'true' },
      { 'X-Role': 'admin' },
    ];

    for (const headers of privilegedHeaders) {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ route: 'sim://telemetry/read' }),
      });
      assert.equal(res.status, 401, 'Privileged headers must not bypass security');
    }
  });

  it('4. Probing endpoints (/env, /config, /debug, /server-info) return 404 and never leak process.env', async () => {
    const probeEndpoints = [
      '/env',
      '/environment',
      '/config',
      '/configuration',
      '/debug',
      '/server-info',
      '/api/debug',
      '/api/v1/debug',
    ];

    for (const endpoint of probeEndpoints) {
      const res = await fetch(`${baseUrl}${endpoint}`);
      assert.equal(res.status, 404, `Endpoint ${endpoint} must return 404`);

      const text = await res.text();
      assert(!text.includes('NODE_ENV'), `${endpoint} must not leak NODE_ENV`);
      assert(!text.includes('PORT'), `${endpoint} must not leak PORT`);
      assert(!text.includes('process.env'), `${endpoint} must not leak process.env`);
    }
  });

  it('5. Operational logging strictly redacts session IDs, cookies, flags, and candidate submissions', () => {
    const testLogger = new Logger('debug');
    const captured: LogEntry[] = [];
    testLogger.setSink((entry) => captured.push(entry));

    // Log message containing sensitive fields
    testLogger.info('User action logged', 'req_test_123', {
      session_id: '00000000-0000-4000-8000-000000000001',
      cookie: 'strata_session=secret_cookie_val',
      auth_token: 'Bearer super_secret_token_123',
      candidate_interpretation: 'CANONICAL_TARGET_VAL',
      flag: 'BPCTF{secret_flag_value}',
      random_field: 'BPCTF{inline_flag_secret}',
      private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...',
    });

    assert.equal(captured.length, 1);
    const serialized = JSON.stringify(captured[0]);

    assert(!serialized.includes('00000000-0000-4000-8000-000000000001'), 'Must redact session_id');
    assert(!serialized.includes('secret_cookie_val'), 'Must redact cookie');
    assert(!serialized.includes('super_secret_token_123'), 'Must redact auth_token');
    assert(!serialized.includes('CANONICAL_TARGET_VAL'), 'Must redact candidate interpretation');
    assert(!serialized.includes('secret_flag_value'), 'Must redact flag');
    assert(!serialized.includes('inline_flag_secret'), 'Must redact inline flag');
    assert(!serialized.includes('MIIE...'), 'Must redact private key');
  });
});
