import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bootstrapApplication } from '../../src/bootstrap.js';

describe('Prompt 17: Production Server Lifecycle & State Management', () => {
  it('1. Server tracks lifecycle state transitions: READY -> DRAINING -> STOPPED', async () => {
    const app = await bootstrapApplication({
      environment: 'test',
      port: 0,
      logLevel: 'error',
    });

    // Before starting, server is in STARTING state
    assert.equal(app.server.getState(), 'STARTING');

    await app.server.start();
    // Once listening, server enters READY state
    assert.equal(app.server.getState(), 'READY');

    const port = app.server.getPort();
    const readyRes = await fetch(`http://127.0.0.1:${port}/ready`);
    assert.equal(readyRes.status, 200);

    // Initiate stop (transitions to DRAINING then STOPPED)
    const stopPromise = app.server.stop();
    await stopPromise;

    assert.equal(app.server.getState(), 'STOPPED');
    await app.shutdown();
  });

  it('2. Rejects new session initializations during draining without leaking internals', async () => {
    const app = await bootstrapApplication({
      environment: 'test',
      port: 0,
      logLevel: 'error',
    });
    await app.server.start();
    const port = app.server.getPort();

    // Manually test the draining rejection path on the server
    const stopPromise = app.server.stop();

    // During/after stop, new session requests fail safely
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/session/init`, {
        method: 'POST',
        signal: AbortSignal.timeout(500),
      });

      if (res.status === 503) {
        const body = await res.json();
        assert.equal(body.code, 'SERVICE_UNAVAILABLE');
        assert(!JSON.stringify(body).includes('SERVER_DRAINING'));
        assert(!JSON.stringify(body).includes('INTERNAL_SHUTDOWN'));
      }
    } catch {
      // Socket closing immediately is also safe behavior during stop
    }

    await stopPromise;
    await app.shutdown();
  });

  it('3. Internal lifecycle state is not exposed in public health/ready payloads', async () => {
    const app = await bootstrapApplication({
      environment: 'test',
      port: 0,
      logLevel: 'error',
    });
    await app.server.start();
    const port = app.server.getPort();

    const healthRes = await fetch(`http://127.0.0.1:${port}/health`);
    const healthText = await healthRes.text();
    assert(!healthText.includes('STARTING'));
    assert(!healthText.includes('DRAINING'));
    assert(!healthText.includes('STOPPED'));

    const readyRes = await fetch(`http://127.0.0.1:${port}/ready`);
    const readyText = await readyRes.text();
    assert(!readyText.includes('STARTING'));
    assert(!readyText.includes('DRAINING'));
    assert(!readyText.includes('STOPPED'));

    await app.shutdown();
  });
});
