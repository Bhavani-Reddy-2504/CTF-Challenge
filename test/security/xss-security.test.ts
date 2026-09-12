import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';

describe('Category 8: Cross-Site Scripting (XSS) Defense & Client Audit', () => {
  let app: ApplicationInstance;
  let baseUrl: string;
  let sessionCookie: string;

  before(async () => {
    app = await bootstrapApplication({
      environment: 'test',
      port: 0,
      cookieSecure: false,
    });
    await app.server.start();
    const port = app.server.getPort();
    baseUrl = `http://127.0.0.1:${port}`;

    // Initialize an active test session
    const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    sessionCookie = initRes.headers.get('set-cookie') ?? '';
  });

  beforeEach(() => {
    app.server.rateLimiter.reset();
  });

  after(async () => {
    await app.shutdown();
  });

  it('1. Public client code contains zero dangerous DOM injection APIs', async () => {
    const appJsPath = path.resolve(process.cwd(), 'public', 'app.js');
    const appJsContent = await fs.promises.readFile(appJsPath, 'utf-8');

    // Audit for dangerous sink APIs
    assert(!appJsContent.includes('innerHTML'), 'public/app.js must not use innerHTML');
    assert(!appJsContent.includes('outerHTML'), 'public/app.js must not use outerHTML');
    assert(!appJsContent.includes('document.write'), 'public/app.js must not use document.write');
    assert(!appJsContent.includes('eval('), 'public/app.js must not use eval()');
    assert(!appJsContent.includes('new Function('), 'public/app.js must not use new Function()');

    // Verify safe DOM text rendering is used
    assert(appJsContent.includes('textContent'), 'public/app.js must use textContent for safe text rendering');
    assert(appJsContent.includes('createElement'), 'public/app.js must construct DOM nodes safely with createElement');
  });

  it('2. Public index.html contains zero inline executable scripts or eval vectors', async () => {
    const htmlPath = path.resolve(process.cwd(), 'public', 'index.html');
    const htmlContent = await fs.promises.readFile(htmlPath, 'utf-8');

    // Verify no inline script execution or event handlers (e.g. onload=, onerror=, onclick=)
    assert(!htmlContent.includes('onload='), 'index.html must not contain inline onload handlers');
    assert(!htmlContent.includes('onerror='), 'index.html must not contain inline onerror handlers');
    assert(!htmlContent.includes('onclick='), 'index.html must not contain inline onclick handlers');
    assert(!htmlContent.includes('javascript:'), 'index.html must not contain javascript: URIs');
  });

  it('3. Route dispatch rejects or sanitizes malicious XSS payloads safely', async () => {
    const xssPayloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '"><svg onload=alert(1)>',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)"></iframe>',
    ];

    for (const payload of xssPayloads) {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ route: `sim://metadata/${payload}` }),
      });

      assert.equal(res.status, 400);
      assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');

      const text = await res.text();
      // Verify raw script tag is never executable or rendered as HTML
      const json = JSON.parse(text);
      assert.equal(json.status, 'error');
    }
  });

  it('4. Evaluation submit handles XSS payloads safely as plain text', async () => {
    const xssPayloads = [
      '<script>alert("pwned")</script>',
      '"><img src=x onerror=alert(1)>',
      '<svg/onload=alert(document.domain)>',
    ];

    for (const payload of xssPayloads) {
      const res = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({ interpretation: payload }),
      });

      // Gating will block (422) or evaluate blackbox (200 / 400)
      assert([200, 400, 422].includes(res.status), `Status ${res.status} must be 200, 400, or 422`);
      assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    }
  });
});
