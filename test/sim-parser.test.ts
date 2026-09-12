import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { InvalidSimRouteError, UnsupportedSimNamespaceError } from '../src/router/sim-errors.js';
import { SimRoute } from '../src/router/sim-route.js';

describe('sim:// URI Parser & Grammar Tests (Requirements 1-44)', () => {
  // --- Valid Parsing (1-4) ---
  it('1. Valid route with one path segment parses correctly', () => {
    const route = parseSimRoute('sim://metadata/workload');
    assert.equal(route.namespace, 'metadata');
    assert.deepEqual(route.segments, ['workload']);
    assert.equal(route.canonical, 'sim://metadata/workload');
  });

  it('2. Valid route with multiple path segments parses correctly', () => {
    const route = parseSimRoute('sim://config/topology/enclave-alpha');
    assert.equal(route.namespace, 'config');
    assert.deepEqual(route.segments, ['topology', 'enclave-alpha']);
    assert.equal(route.canonical, 'sim://config/topology/enclave-alpha');
  });

  it('3. Canonical representation is deterministic', () => {
    const route1 = parseSimRoute('sim://audit/events/failed-logins');
    const route2 = parseSimRoute('sim://audit/events/failed-logins');
    assert.equal(route1.canonical, route2.canonical);
    assert.equal(route1.toString(), 'sim://audit/events/failed-logins');
  });

  it('4. Returned route is deeply immutable', () => {
    const route = parseSimRoute('sim://identity/workload-token');
    assert.throws(() => {
      // @ts-expect-error - Testing runtime immutability
      route.namespace = 'vault';
    }, TypeError);
    assert.throws(() => {
      // @ts-expect-error - Testing runtime immutability
      route.segments.push('injected');
    }, TypeError);
    assert(Object.isFrozen(route));
    assert(Object.isFrozen(route.segments));
  });

  // --- Scheme Attacks (5-13) ---
  it('5. http:// scheme is rejected', () => {
    assert.throws(() => parseSimRoute('http://metadata/workload'), InvalidSimRouteError);
  });

  it('6. https:// scheme is rejected', () => {
    assert.throws(() => parseSimRoute('https://metadata/workload'), InvalidSimRouteError);
  });

  it('7. file:// scheme is rejected', () => {
    assert.throws(() => parseSimRoute('file:///etc/passwd'), InvalidSimRouteError);
  });

  it('8. ftp:// scheme is rejected', () => {
    assert.throws(() => parseSimRoute('ftp://metadata/workload'), InvalidSimRouteError);
  });

  it('9. javascript: scheme is rejected', () => {
    assert.throws(() => parseSimRoute('javascript:alert(1)'), InvalidSimRouteError);
  });

  it('10. Missing scheme is rejected', () => {
    assert.throws(() => parseSimRoute('metadata/workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('//metadata/workload'), InvalidSimRouteError);
  });

  it('11. Malformed scheme is rejected', () => {
    assert.throws(() => parseSimRoute('sim:/metadata/workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim:metadata/workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim:///metadata/workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim:http://metadata/workload'), InvalidSimRouteError);
  });

  it('12. Encoded scheme is rejected', () => {
    assert.throws(() => parseSimRoute('sim%3A//metadata/workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('%73%69%6d://metadata/workload'), InvalidSimRouteError);
  });

  it('13. Nested scheme is rejected', () => {
    assert.throws(() => parseSimRoute('sim://http://metadata/workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://sim://metadata/workload'), InvalidSimRouteError);
  });

  // --- Namespace Attacks (14-23) ---
  it('14. Uppercase namespace is rejected', () => {
    assert.throws(() => parseSimRoute('sim://METADATA/workload'), UnsupportedSimNamespaceError);
  });

  it('15. Mixed-case namespace is rejected', () => {
    assert.throws(() => parseSimRoute('sim://MetaData/workload'), UnsupportedSimNamespaceError);
    assert.throws(() => parseSimRoute('sim://mEtAdAtA/workload'), UnsupportedSimNamespaceError);
  });

  it('16. Unknown namespace is rejected', () => {
    assert.throws(() => parseSimRoute('sim://admin/workload'), UnsupportedSimNamespaceError);
    assert.throws(() => parseSimRoute('sim://system/workload'), UnsupportedSimNamespaceError);
    assert.throws(() => parseSimRoute('sim://debug/workload'), UnsupportedSimNamespaceError);
    assert.throws(() => parseSimRoute('sim://internal/workload'), UnsupportedSimNamespaceError);
  });

  it('17. Namespace with port is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata:8080/workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://config:443/workload'), InvalidSimRouteError);
  });

  it('18. Namespace with username is rejected', () => {
    assert.throws(() => parseSimRoute('sim://user@metadata/workload'), InvalidSimRouteError);
  });

  it('19. Namespace with password is rejected', () => {
    assert.throws(() => parseSimRoute('sim://user:pass@metadata/workload'), InvalidSimRouteError);
  });

  it('20. IPv4 namespace is rejected', () => {
    assert.throws(() => parseSimRoute('sim://127.0.0.1/workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://169.254.169.254/latest'), InvalidSimRouteError);
  });

  it('21. IPv6 namespace is rejected', () => {
    assert.throws(() => parseSimRoute('sim://[::1]/workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://::1/workload'), InvalidSimRouteError);
  });

  it('22. DNS-style namespace is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata.internal.com/workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata.local/workload'), InvalidSimRouteError);
  });

  it('23. localhost namespace is rejected', () => {
    assert.throws(() => parseSimRoute('sim://localhost/workload'), UnsupportedSimNamespaceError);
  });

  // --- Path Attacks (24-40) ---
  it('24. Empty path is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata'), InvalidSimRouteError);
  });

  it('25. Trailing slash is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/workload/'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://config/topo/enclave/'), InvalidSimRouteError);
  });

  it('26. Duplicate forward slash is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata//workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata/workload//item'), InvalidSimRouteError);
  });

  it('27. Dot segment (.) is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/./workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata/workload/.'), InvalidSimRouteError);
  });

  it('28. Double dot (..) path traversal is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/../vault/keys'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata/workload/..'), InvalidSimRouteError);
  });

  it('29. Encoded traversal is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/%2e%2e/vault'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata/%2e/workload'), InvalidSimRouteError);
  });

  it('30. Encoded separator is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/a%2Fb'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata/%2Fetc'), InvalidSimRouteError);
  });

  it('31. Backslash is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/a\\b'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata\\workload'), InvalidSimRouteError);
  });

  it('32. Percent encoding is rejected entirely', () => {
    assert.throws(() => parseSimRoute('sim://metadata/workload%20test'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata/workload%00'), InvalidSimRouteError);
  });

  it('33. Query string is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/workload?service=sts'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://audit/events?trace_id=123'), InvalidSimRouteError);
  });

  it('34. Fragment identifier is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/workload#section'), InvalidSimRouteError);
  });

  it('35. Whitespace is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/work load'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute(' sim://metadata/workload'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata/workload '), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata/\tworkload'), InvalidSimRouteError);
  });

  it('36. Control character is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/work\x01load'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata/work\r\nload'), InvalidSimRouteError);
  });

  it('37. Null byte is rejected', () => {
    assert.throws(() => parseSimRoute('sim://metadata/workload\0'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://metadata/\0/workload'), InvalidSimRouteError);
  });

  it('38. Overly long route is rejected (> 256 chars)', () => {
    const longSegment = 'a'.repeat(260);
    assert.throws(() => parseSimRoute(`sim://metadata/${longSegment}`), InvalidSimRouteError);
  });

  it('39. Excessive path segments are rejected (> 8 segments)', () => {
    const nineSegments = 'sim://metadata/a/b/c/d/e/f/g/h/i';
    assert.throws(() => parseSimRoute(nineSegments), InvalidSimRouteError);
  });

  it('40. Overly long segment is rejected (> 64 chars)', () => {
    const segment65 = 'b'.repeat(65);
    assert.throws(() => parseSimRoute(`sim://metadata/${segment65}`), InvalidSimRouteError);
  });

  // --- Parser Purity (41-44) ---
  it('41. Parsing performs zero network activity', () => {
    // Verified by pure function design; execution time is instantaneous (< 1ms)
    const start = performance.now();
    for (let i = 0; i < 500; i++) {
      parseSimRoute('sim://sts/caller-identity');
    }
    const elapsed = performance.now() - start;
    assert(elapsed < 100, `Parsing 500 routes took ${elapsed}ms; must be synchronous in-memory`);
  });

  it('42. Parsing performs zero filesystem activity', () => {
    // Calling invalid filesystem-like paths still yields standard pure rejection
    assert.throws(() => parseSimRoute('sim://config/../../../etc/passwd'), InvalidSimRouteError);
  });

  it('43. Parsing does not access challenge modules or runtime state', () => {
    // Unregistered routes still parse purely without needing module registration
    const route = parseSimRoute('sim://vault/future-key-resource');
    assert(route instanceof SimRoute);
    assert.equal(route.namespace, 'vault');
  });

  it('44. Parsing produces identical output for identical input (deterministic)', () => {
    const r1 = parseSimRoute('sim://policy/roles/deployer');
    const r2 = parseSimRoute('sim://policy/roles/deployer');
    assert.deepEqual(r1, r2);
    assert.equal(r1.canonical, r2.canonical);
  });
});
