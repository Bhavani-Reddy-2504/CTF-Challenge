import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';

describe('Prompt 18 — Security Suite 7: Error Sanitization & Leakage Audit', () => {
  let app: ApplicationInstance;
  let baseUrl: string;

  before(async () => {
    process.env.ENCLAVE_FLAG = 'MOCK_FLAG{ERROR_LEAKAGE_TEST_SECRET_FLAG_12345}';

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

  function assertSanitizedResponse(_status: number, body: string): void {
    assert(!body.includes('stack'), 'Error response must not contain stack trace');
    assert(!body.includes('at '), 'Error response must not contain call stack frames');
    assert(!body.includes('ERROR_LEAKAGE_TEST'), 'Error response must not leak environment secret');
    assert(!body.includes('src/'), 'Error response must not leak source paths');
    assert(!body.includes('node:'), 'Error response must not leak internal node modules');
    assert(!body.includes('CANONICAL_INTERPRETATION'), 'Error response must not leak evaluator constants');
    assert(!body.includes('hardware integrity anchor 889f'), 'Error response must not leak canonical answer');
  }

  it('1. Malformed JSON returns sanitized 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/v1/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"malformed":',
    });

    assert.equal(res.status, 400);
    const text = await res.text();
    assertSanitizedResponse(res.status, text);
  });

  it('2. Invalid routes return sanitized 404 Not Found', async () => {
    const res = await fetch(`${baseUrl}/api/v1/nonexistent/endpoint`);
    assert.equal(res.status, 404);
    const text = await res.text();
    assertSanitizedResponse(res.status, text);
  });

  it('3. Missing session returns sanitized 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
    });

    assert.equal(res.status, 401);
    const text = await res.text();
    assertSanitizedResponse(res.status, text);
  });

  it('4. Invalid HTTP method returns sanitized 405 Method Not Allowed', async () => {
    const res = await fetch(`${baseUrl}/api/v1/session/init`, {
      method: 'PUT',
    });

    assert.equal(res.status, 405);
    const text = await res.text();
    assertSanitizedResponse(res.status, text);
  });

  it('5. Internal server errors return sanitized 500 without stack trace', async () => {
    // Probing path designed to test central error formatting
    const res = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json',
    });

    const text = await res.text();
    assertSanitizedResponse(res.status, text);
  });
});
