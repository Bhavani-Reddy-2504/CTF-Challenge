process.env.TLS_CERT_PATH = 'certs/server.crt'; process.env.TLS_KEY_PATH = 'certs/server.key';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { bootstrapApplication } from '../src/bootstrap.js';

const KNOWN_CANONICAL_TARGETS = [
  Buffer.from('TUlTU0lOR19TQU1QTEVfQkFTRTY0X1NUUklOR19OT1RfVEhFX1JFQUxfQU5TV0VS', 'base64').toString('utf8'),
  Buffer.from('TUlTU0lOR19TQU1QTEVfQkFTRTY0X1NUUklOR19OT1RfVEhFX1JFQUxfQU5TV0VSXzY3ODkw', 'base64').toString('utf8'),
  Buffer.from('V1JLLUhZUEVSSU9OLVRFTEVNRVRSWS1FREdFOkVER0UtVEVMRU1FVFJZLUVOQ0xBVkU6RU5DTEFWRS1JTlRFR1JJVFktQU5DSE9SLTg4OUY6UkVDT05DSUxFRA==', 'base64').toString('utf8'),
];

describe('Prompt 15: Player Runtime & Interface Hardening (Anti-Leakage, Safe DOM & Zero-Oracle Verification)', () => {
  let app: Awaited<ReturnType<typeof bootstrapApplication>>;
  let baseUrl: string;

  const publicDir = resolve(process.cwd(), 'public');
  const indexHtml = readFileSync(resolve(publicDir, 'index.html'), 'utf8');
  const indexCss = readFileSync(resolve(publicDir, 'index.css'), 'utf8');
  const appJs = readFileSync(resolve(publicDir, 'app.js'), 'utf8');
  const httpServerTs = readFileSync(resolve(process.cwd(), 'src/server/http-server.ts'), 'utf8');

  beforeEach(async () => {
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

  describe('1. Zero Answer / Solution Leakage in Frontend Bundles', () => {
    it('client assets contain zero accepted interpretation strings or substrings', () => {
      for (const rawAccepted of KNOWN_CANONICAL_TARGETS) {
        // Strip common punctuation / whitespace to test substantial fragments
        const normalized = rawAccepted.trim().toLowerCase();
        assert.ok(
          !indexHtml.toLowerCase().includes(normalized),
          'Index.html contains accepted interpretation string!'
        );
        assert.ok(
          !indexCss.toLowerCase().includes(normalized),
          'Index.css contains accepted interpretation string!'
        );
        assert.ok(
          !appJs.toLowerCase().includes(normalized),
          'App.js contains accepted interpretation string!'
        );
        assert.ok(
          !httpServerTs.toLowerCase().includes(normalized),
          'HttpServer.ts contains accepted interpretation string!'
        );
      }
    });

    it('client code does not contain winner, answer, or solution indicator variables', () => {
      const forbiddenIdentifiers = [
        /\bacceptedInterpretation\b/i,
        /\bcorrectInterpretation\b/i,
        /\bvalidInterpretation\b/i,
        /\bflagValue\b/i,
        /\bsolutionHash\b/i,
        /\bwinningPath\b/i,
        /\banswerKey\b/i,
      ];

      for (const pattern of forbiddenIdentifiers) {
        assert.ok(
          !pattern.test(appJs),
          `App.js contains forbidden identifier matching ${pattern}`
        );
      }
    });
  });

  describe('2. Zero Flag Leakage in Client Files and Static Responses', () => {
    it('public assets contain zero CTF flag tokens', () => {
      const flagPatterns = [
        /BREACH\{[^}]*\}/i,
        /BPCTF\{[^}]*\}/i,
        /FLAG\{[^}]*\}/i,
        /flag\{[^}]*\}/i,
        /ctf\{[^}]*\}/i,
      ];

      for (const pattern of flagPatterns) {
        assert.ok(!pattern.test(indexHtml), `index.html leaked flag token matching ${pattern}`);
        assert.ok(!pattern.test(indexCss), `index.css leaked flag token matching ${pattern}`);
        assert.ok(!pattern.test(appJs), `app.js leaked flag token matching ${pattern}`);
      }
    });

    it('static HTTP responses do not leak flag tokens or solution indicators in headers or bodies', async () => {
      const endpoints = ['/', '/index.html', '/index.css', '/app.js'];
      for (const ep of endpoints) {
        const res = await fetch(`${baseUrl}${ep}`);
        const body = await res.text();
        assert.ok(!body.includes('MOCK_FLAG{'), `Endpoint ${ep} body leaked MOCK_FLAG{`);
        assert.ok(!body.includes('BPCTF{'), `Endpoint ${ep} body leaked BPCTF{`);
        assert.ok(!body.toLowerCase().includes('flag{'), `Endpoint ${ep} body leaked flag{`);

        for (const [header, val] of res.headers.entries()) {
          assert.ok(!val.includes('MOCK_FLAG{'), `Header ${header} leaked MOCK_FLAG{`);
          assert.ok(!val.includes('BPCTF{'), `Header ${header} leaked BPCTF{`);
        }
      }
    });
  });

  describe('3. Zero Evaluator Logic in Client Bundle', () => {
    it('client app.js delegates submission strictly to backend evaluation API', () => {
      // Must contain dispatch call to evaluation endpoint
      assert.ok(
        appJs.includes('/api/v1/evaluation/submit'),
        'App.js must dispatch to /api/v1/evaluation/submit'
      );

      // Must NOT contain local comparison / grading logic
      const forbiddenLogicPatterns = [
        /function\s+evaluateInterpretation\b/i,
        /function\s+checkAnswer\b/i,
        /function\s+validateSubmission\b/i,
        /===\s*['"][a-zA-Z0-9_\-\s]{15,}['"]/, // Hardcoded string match
      ];

      for (const pattern of forbiddenLogicPatterns) {
        assert.ok(
          !pattern.test(appJs),
          `App.js contains local evaluation pattern: ${pattern}`
        );
      }
    });
  });

  describe('4. Zero Route Inventory / Route Catalog Leakage', () => {
    it('client assets do not hardcode a list or array of all valid symbolic routes', () => {
      // No arrays containing sim:// route lists
      const routeArrayPattern = /\[\s*['"]sim:\/\/[^'"]+['"]\s*,\s*['"]sim:\/\//;
      assert.ok(
        !routeArrayPattern.test(appJs),
        'App.js contains an array of hardcoded sim:// routes'
      );
      assert.ok(
        !routeArrayPattern.test(indexHtml),
        'Index.html contains an array of hardcoded sim:// routes'
      );
    });

    it('client does not expose automated route discovery or autocompletion catalog', () => {
      const forbiddenCatalogPatterns = [
        /\ballRoutes\b/i,
        /\brouteCatalog\b/i,
        /\bvalidRoutes\b/i,
        /\bavailableRoutes\b/i,
        /\bsecretRoutes\b/i,
      ];

      for (const pattern of forbiddenCatalogPatterns) {
        assert.ok(
          !pattern.test(appJs),
          `App.js contains catalog variable matching ${pattern}`
        );
      }
    });
  });

  describe('5. Zero Graph / DAG Topology Leakage', () => {
    it('client assets contain no dependency graphs, DAG matrices, or prerequisite maps', () => {
      const forbiddenTopologyPatterns = [
        /\badjacencyList\b/i,
        /\bdependencyGraph\b/i,
        /\bprerequisiteMap\b/i,
        /\bunlockMatrix\b/i,
        /\bgraphTopology\b/i,
      ];

      for (const pattern of forbiddenTopologyPatterns) {
        assert.ok(
          !pattern.test(appJs),
          `App.js contains topology pattern matching ${pattern}`
        );
      }
    });
  });

  describe('6. Strict DOM / Safe Rendering (XSS Defense)', () => {
    it('client app.js contains zero occurrences of unsafe DOM insertion methods', () => {
      const unsafeDomMethods = [
        /\binnerHTML\b/,
        /\bouterHTML\b/,
        /\bdocument\.write\b/,
        /\bdangerouslySetInnerHTML\b/,
      ];

      for (const pattern of unsafeDomMethods) {
        assert.ok(
          !pattern.test(appJs),
          `App.js violates safe DOM rule by using ${pattern}`
        );
      }
    });

    it('client relies on safe textContent and document.createElement', () => {
      assert.ok(appJs.includes('document.createElement'), 'App.js should use createElement');
      assert.ok(appJs.includes('textContent'), 'App.js should use textContent');
    });
  });

  describe('7. No Dynamic Code Execution', () => {
    it('client source contains zero dynamic evaluation or script construction', () => {
      const evalPatterns = [
        /\beval\s*\(/,
        /\bnew\s+Function\s*\(/,
        /\bsetTimeout\s*\(\s*['"`]/,
        /\bsetInterval\s*\(\s*['"`]/,
      ];

      for (const pattern of evalPatterns) {
        assert.ok(
          !pattern.test(appJs),
          `App.js violates dynamic code execution rule: ${pattern}`
        );
      }
    });
  });

  describe('8. Generic Error Protection / No Stack Traces or Path Leakage', () => {
    it('HTTP error responses do not leak stack traces or internal filesystem paths', async () => {
      const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
      const cookie = initRes.headers.get('set-cookie') ?? '';

      // Trigger 400 Bad Request
      const res400 = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: 'invalid-json{{{',
      });
      const text400 = await res400.text();
      assert.ok(!text400.includes('node:internal'), 'Leaked internal node trace in 400');
      assert.ok(!text400.includes('\\src\\'), 'Leaked source path in 400');
      assert.ok(!text400.includes('/src/'), 'Leaked source path in 400');

      // Trigger 404 Route Not Found
      const res404 = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ route: 'sim://metadata/unknown-route' }),
      });
      const text404 = await res404.text();
      assert.ok(!text404.includes('node:internal'), 'Leaked internal node trace in 404');
      assert.ok(!text404.includes('\\src\\'), 'Leaked source path in 404');
      assert.ok(!text404.includes('/src/'), 'Leaked source path in 404');

      // Trigger 422 Gated Route
      const res422 = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ route: 'sim://resolution/structural-context' }),
      });
      const text422 = await res422.text();
      assert.ok(!text422.includes('node:internal'), 'Leaked internal node trace in 422');
      assert.ok(!text422.includes('\\src\\'), 'Leaked source path in 422');
      assert.ok(!text422.includes('/src/'), 'Leaked source path in 422');
    });
  });

  describe('9. No Debug / Admin Exposure or State Bypasses', () => {
    it('debug query parameters and headers are completely ignored and do not leak state', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session/status?debug=true&admin=true&dump=1`, {
        headers: { 'X-Debug-Mode': '1', 'X-Admin': 'true' },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.session_active, false);
      assert.equal(data.debug, undefined);
      assert.equal(data.admin, undefined);
      assert.equal(data.internalState, undefined);
    });
  });

  describe('10. Session Gating & Boundary Hardening', () => {
    it('unauthenticated requests cannot access symbolic dispatch', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sim/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: 'sim://metadata/workload-profile' }),
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, 'UNAUTHORIZED');
    });

    it('unauthenticated requests cannot submit final interpretation', async () => {
      const res = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interpretation: 'test candidate' }),
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, 'UNAUTHORIZED');
    });
  });

  describe('11. Content Security Policy & Security Response Headers', () => {
    it('serves hardened CSP and security headers on static index.html', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.status, 200);

      const csp = res.headers.get('content-security-policy') ?? '';
      assert.ok(csp.includes("default-src 'self'"), 'CSP missing default-src');
      assert.ok(csp.includes("script-src 'self'"), 'CSP missing script-src');
      assert.ok(csp.includes("frame-ancestors 'none'"), 'CSP missing frame-ancestors none');
      assert.ok(csp.includes("object-src 'none'"), 'CSP missing object-src none');

      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');
      assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    });

    it('serves hardened security headers on API responses', async () => {
      const res = await fetch(`${baseUrl}/api/v1/session/status`);
      assert.equal(res.status, 200);

      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');
    });
  });

  describe('12. Zero Automated Probing / Brute Force Tools in Frontend', () => {
    it('app.js does not contain loops that crawl or brute force routes', () => {
      const forbiddenAutomationPatterns = [
        /\bautoProbe\b/i,
        /\bbruteForce\b/i,
        /\bcrawlRoutes\b/i,
        /\bscanAll\b/i,
      ];

      for (const pattern of forbiddenAutomationPatterns) {
        assert.ok(
          !pattern.test(appJs),
          `App.js contains automated crawler pattern: ${pattern}`
        );
      }
    });
  });
});
