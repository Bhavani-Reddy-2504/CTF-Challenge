import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';

describe('Category 7: Static Assets Security & Path Traversal Lockdown', () => {
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

  after(async () => {
    await app.shutdown();
  });

  it('1. Approved public static files are served with correct MIME types and security headers', async () => {
    const assets = [
      { path: '/', mime: 'text/html; charset=utf-8' },
      { path: '/index.html', mime: 'text/html; charset=utf-8' },
      { path: '/index.css', mime: 'text/css; charset=utf-8' },
      { path: '/static/index.css', mime: 'text/css; charset=utf-8' },
      { path: '/app.js', mime: 'application/javascript; charset=utf-8' },
      { path: '/static/app.js', mime: 'application/javascript; charset=utf-8' },
    ];

    for (const asset of assets) {
      const res = await fetch(`${baseUrl}${asset.path}`);
      assert.equal(res.status, 200, `Asset ${asset.path} must return 200`);
      assert.equal(res.headers.get('content-type'), asset.mime);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');
      assert.ok(res.headers.get('content-security-policy'));
      const text = await res.text();
      assert(text.length > 0, `Asset ${asset.path} must not be empty`);
    }
  });

  it('2. Sensitive files and directory traversal attempts return 404', async () => {
    const sensitivePaths = [
      '/.env',
      '/.env.local',
      '/.env.production',
      '/.git/config',
      '/.git/HEAD',
      '/package.json',
      '/package-lock.json',
      '/tsconfig.json',
      '/src/server/http-server.ts',
      '/src/bootstrap.ts',
      '/test/health.test.ts',
      '/node_modules/',
      '/app.js.map',
      '/index.html~',
      '/index.html.bak',
      '/index.css.bak',
      '/public/index.html',
    ];

    for (const p of sensitivePaths) {
      const res = await fetch(`${baseUrl}${p}`);
      assert.equal(res.status, 404, `Sensitive path ${p} must return 404 Not Found`);
      const body = await res.text();
      assert(!body.includes('devDependencies'), `Path ${p} must not leak package.json content`);
      assert(!body.includes('HttpServer'), `Path ${p} must not leak server source`);
    }
  });

  it('3. Path traversal encoding attempts return 404 and never leak files', async () => {
    const traversalPayloads = [
      '/../../package.json',
      '/..%2fpackage.json',
      '/..%5cpackage.json',
      '/%2e%2e/package.json',
      '/%252e%252e/package.json',
      '/index.html%00.jpg',
      '/index.html/../package.json',
    ];

    for (const tp of traversalPayloads) {
      const res = await fetch(`${baseUrl}${tp}`);
      assert.equal(res.status, 404, `Traversal payload ${tp} must return 404`);
    }
  });

  it('4. Source maps are disabled and not served', async () => {
    const res = await fetch(`${baseUrl}/app.js.map`);
    assert.equal(res.status, 404);
  });
});
