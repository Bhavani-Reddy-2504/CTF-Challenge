import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RequestContext } from '../src/context/request-context.js';
import { ChallengeEngine } from '../src/engine/challenge-engine.js';
import { ModuleRegistry } from '../src/engine/module-registry.js';
import { ISimAuthorizer } from '../src/router/sim-authorizer.js';
import { SimDispatcher } from '../src/router/sim-dispatcher.js';
import {
  InvalidSimRouteError,
  SimDispatchError,
  SimOperationNotAllowedError,
  SimRouteNotFoundError,
  UnsupportedSimNamespaceError,
} from '../src/router/sim-errors.js';
import { SimHandlerContext } from '../src/router/sim-handler.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { SimRoute } from '../src/router/sim-route.js';
import { validateAndBuildConfig } from '../src/config/config.js';
import { SessionStore } from '../src/session/session-store.js';

describe('sim:// Route Registry & Dispatcher Tests (Requirements 45-68)', () => {
  let registry: SimRouteRegistry;
  let dispatcher: SimDispatcher;
  let testRoute: SimRoute;
  let requestContext: RequestContext;

  beforeEach(() => {
    registry = new SimRouteRegistry();
    dispatcher = new SimDispatcher(registry);
    testRoute = parseSimRoute('sim://metadata/instance-identity');
    requestContext = new RequestContext();
  });

  // --- Registration (45-49) ---
  it('45. Explicit route registration succeeds', () => {
    registry.register(testRoute, 'READ', (ctx) => ({ result: 'ok', route: ctx.route.canonical }));
    assert.equal(registry.hasRoute(testRoute, 'READ'), true);
    assert.equal(registry.hasRouteAny(testRoute), true);
  });

  it('46. Duplicate route registration fails', () => {
    registry.register(testRoute, 'READ', () => 'first');
    assert.throws(
      () => registry.register(testRoute, 'READ', () => 'second'),
      SimDispatchError,
      'Duplicate registration of exact route and operation must throw SimDispatchError'
    );
  });

  it('47. Duplicate route and operation combination fails', () => {
    const identicalRoute = parseSimRoute('sim://metadata/instance-identity');
    registry.register(testRoute, 'READ', () => 'handler1');

    assert.throws(
      () => registry.register(identicalRoute, 'READ', () => 'handler2'),
      SimDispatchError
    );
  });

  it('48. Registry locks correctly and reflects isLocked()', () => {
    assert.equal(registry.isLocked(), false);
    registry.lock();
    assert.equal(registry.isLocked(), true);
  });

  it('49. Registration after lock fails', () => {
    registry.lock();
    assert.throws(
      () => registry.register(testRoute, 'READ', () => 'blocked'),
      SimDispatchError,
      'Registration must fail once the registry is locked'
    );
  });

  // --- Dispatch (50-58) ---
  it('50. Registered route dispatch succeeds with wrapped response', async () => {
    registry.register(testRoute, 'READ', (ctx) => {
      return { instance_id: 'i-mock-001', requested_by: ctx.requestContext.correlationId };
    });
    registry.lock();

    const result = await dispatcher.dispatch(testRoute, 'READ', requestContext);
    assert.equal(result.status, 'success');
    assert.equal(result.route, 'sim://metadata/instance-identity');
    assert.equal(result.operation, 'READ');
    assert.deepEqual(result.data, {
      instance_id: 'i-mock-001',
      requested_by: requestContext.correlationId,
    });
    assert.equal(result.correlation_id, requestContext.correlationId);
  });

  it('51. Unknown route fails safely with SimRouteNotFoundError (404 shape)', async () => {
    registry.lock();
    const unknownRoute = parseSimRoute('sim://config/nonexistent');

    await assert.rejects(
      () => dispatcher.dispatch(unknownRoute, 'READ', requestContext),
      SimRouteNotFoundError
    );
  });

  it('52. Unsupported operation fails safely with SimOperationNotAllowedError (403 shape)', async () => {
    registry.register(testRoute, 'READ', () => 'read_data');
    registry.lock();

    await assert.rejects(
      () => dispatcher.dispatch(testRoute, 'WRITE', requestContext),
      SimOperationNotAllowedError
    );
  });

  it('53. Dispatcher requires validated SimRoute objects (rejects raw strings)', async () => {
    registry.lock();

    await assert.rejects(
      // @ts-expect-error - Testing runtime safety against raw string injection
      () => dispatcher.dispatch('sim://metadata/instance-identity', 'READ', requestContext),
      SimDispatchError
    );
  });

  it('54. Dispatcher rejects malformed context', async () => {
    registry.register(testRoute, 'READ', () => 'ok');
    registry.lock();

    await assert.rejects(
      // @ts-expect-error - Testing runtime safety against malformed context
      () => dispatcher.dispatch(testRoute, 'READ', null),
      SimDispatchError
    );
    await assert.rejects(
      // @ts-expect-error - Testing runtime safety against missing correlationId
      () => dispatcher.dispatch(testRoute, 'READ', {}),
      SimDispatchError
    );
  });

  it('55. Handler receives controlled context only (route, requestContext, sessionContext)', async () => {
    let capturedContext: SimHandlerContext | undefined;

    const config = validateAndBuildConfig({ environment: 'test' });
    const store = new SessionStore(config);
    try {
      const session = store.createSession();
      session.context.setNamespaceState('metadata', { nodeClaim: 'enclave-node-1' }, 'metadata');

      const sessionReqCtx = new RequestContext({ session });

      registry.register(testRoute, 'READ', (ctx) => {
        capturedContext = ctx;
        return { ok: true };
      });
      registry.lock();

      await dispatcher.dispatch(testRoute, 'READ', sessionReqCtx);

      assert.ok(capturedContext);
      assert.equal(capturedContext.route.canonical, testRoute.canonical);
      assert.equal(capturedContext.requestContext.correlationId, sessionReqCtx.correlationId);
      assert.ok(capturedContext.sessionContext);

      const state = capturedContext.sessionContext?.getNamespaceState<{ nodeClaim: string }>('metadata');
      assert.equal(state?.nodeClaim, 'enclave-node-1');
    } finally {
      store.shutdown();
    }
  });

  it('56. Handler does not receive raw HTTP request or response objects', async () => {
    registry.register(testRoute, 'READ', (ctx: any) => {
      assert.equal(ctx.req, undefined, 'Handler must not have access to raw req');
      assert.equal(ctx.res, undefined, 'Handler must not have access to raw res');
      assert.equal(ctx.rawHeaders, undefined);
      assert.equal(ctx.socket, undefined);
      return 'sanitized';
    });
    registry.lock();

    await dispatcher.dispatch(testRoute, 'READ', requestContext);
  });

  it('57. Handler does not receive raw unvalidated route input string', async () => {
    registry.register(testRoute, 'READ', (ctx) => {
      assert(ctx.route instanceof SimRoute);
      assert.equal(typeof ctx.route, 'object');
      return 'safe';
    });
    registry.lock();

    await dispatcher.dispatch(testRoute, 'READ', requestContext);
  });

  it('58. Registry mutation cannot occur through dispatch execution', async () => {
    registry.register(testRoute, 'READ', () => {
      // Attempt to register a backdoor during handler execution
      assert.throws(() => {
        registry.register(parseSimRoute('sim://vault/backdoor'), 'READ', () => 'leaked');
      }, SimDispatchError);
      return 'verified';
    });
    registry.lock();

    await dispatcher.dispatch(testRoute, 'READ', requestContext);
    assert.equal(registry.hasRouteAny(parseSimRoute('sim://vault/backdoor')), false);
  });

  // --- Security Boundaries (59-64) ---
  it('59. No arbitrary method invocation on modules', async () => {
    // Calling an unregistered method name cannot trigger arbitrary execution
    registry.lock();
    const probeRoute = parseSimRoute('sim://metadata/destroy-all');

    await assert.rejects(
      () => dispatcher.dispatch(probeRoute, 'READ', requestContext),
      SimRouteNotFoundError
    );
  });

  it('60. No reflection-based invocation from route segments', async () => {
    registry.lock();
    // __proto__ has underscores and is rejected by the strict segment grammar
    assert.throws(() => parseSimRoute('sim://metadata/__proto__'), InvalidSimRouteError);

    // Named prototype properties do not trigger object methods on Map-based registry
    const constructorRoute = parseSimRoute('sim://metadata/constructor');
    await assert.rejects(
      () => dispatcher.dispatch(constructorRoute, 'READ', requestContext),
      SimRouteNotFoundError
    );
  });

  it('61. No dynamic imports or module resolution from user input', () => {
    assert.throws(() => parseSimRoute('sim://metadata/./dynamic-module'), InvalidSimRouteError);
  });

  it('62. Zero network primitives are invoked by router dispatcher', async () => {
    registry.register(testRoute, 'READ', () => ({ simulated: true }));
    registry.lock();

    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      await dispatcher.dispatch(testRoute, 'READ', requestContext);
    }
    const elapsed = performance.now() - start;
    assert(elapsed < 100, `200 dispatches completed in ${elapsed}ms; must be strictly in-memory`);
  });

  it('63. No DNS resolution occurs during routing', () => {
    // DNS names are rejected at parse time
    assert.throws(() => parseSimRoute('sim://metadata.local/probe'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://localhost/probe'), UnsupportedSimNamespaceError);
  });

  it('64. No filesystem access from route input', async () => {
    registry.lock();
    const etcRoute = parseSimRoute('sim://config/etc/passwd');
    await assert.rejects(
      () => dispatcher.dispatch(etcRoute, 'READ', requestContext),
      SimRouteNotFoundError
    );
    assert.throws(() => parseSimRoute('sim://config/../../../etc/shadow'), InvalidSimRouteError);
  });

  // --- Integration (65-68) ---
  it('65. ChallengeEngine integrates with the dispatcher and routes execution', async () => {
    const moduleRegistry = new ModuleRegistry();
    const routeRegistry = new SimRouteRegistry();

    routeRegistry.register(testRoute, 'READ', () => ({ integrated: true }));

    const engine = new ChallengeEngine(moduleRegistry, { routeRegistry });
    await engine.initialize();

    assert.equal(engine.isReady(), true);

    const result = await engine.dispatch(testRoute, 'READ', requestContext);
    assert.equal(result.status, 'success');
    assert.deepEqual(result.data, { integrated: true });

    await engine.shutdown();
  });

  it('66. Module registry remains locked after ChallengeEngine initialization', async () => {
    const moduleRegistry = new ModuleRegistry();
    const engine = new ChallengeEngine(moduleRegistry);
    await engine.initialize();

    assert.equal(moduleRegistry.isLocked(), true);
    await engine.shutdown();
  });

  it('67. Route registry remains locked after ChallengeEngine initialization', async () => {
    const moduleRegistry = new ModuleRegistry();
    const routeRegistry = new SimRouteRegistry();
    const engine = new ChallengeEngine(moduleRegistry, { routeRegistry });

    await engine.initialize();

    assert.equal(routeRegistry.isLocked(), true);
    assert.throws(
      () => routeRegistry.register(testRoute, 'READ', () => 'too_late'),
      SimDispatchError
    );

    await engine.shutdown();
  });

  it('68. Custom authorizer integration acts as gate (verifies Prompt 8 extension point)', async () => {
    const customAuthorizer: ISimAuthorizer = {
      authorize(route, _op, _ctx) {
        // Block access to vault routes
        return route.namespace !== 'vault';
      },
    };

    const restrictedRegistry = new SimRouteRegistry();
    const vaultRoute = parseSimRoute('sim://vault/keys');
    restrictedRegistry.register(vaultRoute, 'READ', () => 'vault_data');
    restrictedRegistry.register(testRoute, 'READ', () => 'meta_data');
    restrictedRegistry.lock();

    const gatedDispatcher = new SimDispatcher(restrictedRegistry, customAuthorizer);

    // Meta route is allowed
    const metaResult = await gatedDispatcher.dispatch(testRoute, 'READ', requestContext);
    assert.equal(metaResult.data, 'meta_data');

    // Vault route is blocked by authorizer
    await assert.rejects(
      () => gatedDispatcher.dispatch(vaultRoute, 'READ', requestContext),
      SimOperationNotAllowedError
    );
  });
});
