import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';

describe('Prompt 18 — Security Suite 5: Static Secret Leakage Scan', () => {
  let app: ApplicationInstance;
  let baseUrl: string;

  before(async () => {
    process.env.ENCLAVE_FLAG = 'MOCK_FLAG{STATIC_LEAKAGE_TEST_ENCLAVE_FLAG}';

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

  const endpoints = ['/', '/index.html', '/app.js', '/index.css'];

  for (const ep of endpoints) {
    it(`Static asset ${ep} leaks zero flag patterns, canonical answers, or environment values`, async () => {
      const res = await fetch(`${baseUrl}${ep}`);
      assert.equal(res.status, 200);
      const text = await res.text();

      // Flag patterns
      assert(!/(?:BPCTF|BREACH|FLAG)\{[^}]+\}/.test(text), `${ep} leaked flag pattern`);
      assert(!text.includes('STATIC_LEAKAGE_TEST'), `${ep} leaked environment flag variable`);

      // Canonical answer keywords
      assert(!text.toLowerCase().includes('hardware integrity anchor 889f'), `${ep} leaked canonical anchor`);
      assert(!text.toLowerCase().includes('enclave fabric reconciled'), `${ep} leaked canonical reconciliation`);

      // Evaluator internals
      assert(!text.includes('CANONICAL_INTERPRETATION_HASHES'), `${ep} leaked evaluator hash symbol`);
      assert(!text.includes('submitFinalInterpretation'), `${ep} leaked internal method name`);

      // Source filesystem paths
      assert(!text.includes('src/modules/evaluation'), `${ep} leaked source path`);
      assert(!text.includes('c:/Users/'), `${ep} leaked absolute filesystem path`);
      assert(!text.includes('process.env'), `${ep} leaked process.env reference`);
    });
  }
});
