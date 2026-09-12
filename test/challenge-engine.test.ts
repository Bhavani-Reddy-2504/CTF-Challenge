import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RequestContext } from '../src/context/request-context.js';
import { ChallengeEngine, ChallengeEngineError } from '../src/engine/challenge-engine.js';
import { IChallengeModule, ModuleId } from '../src/engine/module-contract.js';
import { ModuleRegistry } from '../src/engine/module-registry.js';
import { validateAndBuildConfig } from '../src/config/config.js';
import { SessionStore } from '../src/session/session-store.js';

describe('Challenge Engine Coordination Tests', () => {
  it('Initializes modules in dependency order and injects only approved dependencies', async () => {
    const registry = new ModuleRegistry();
    const receivedDeps: Map<ModuleId, string[]> = new Map();

    const configModule: IChallengeModule = {
      id: 'config',
      version: '1.0.0',
      requiredDependencies: [],
      initialize(deps) {
        receivedDeps.set('config', Array.from(deps.keys()));
      },
    };

    const metaModule: IChallengeModule = {
      id: 'metadata',
      version: '1.0.0',
      requiredDependencies: ['config'],
      initialize(deps) {
        receivedDeps.set('metadata', Array.from(deps.keys()));
      },
    };

    registry.register(configModule);
    registry.register(metaModule);

    const engine = new ChallengeEngine(registry);
    assert.equal(engine.isReady(), false);

    await engine.initialize();
    assert.equal(engine.isReady(), true);
    assert.equal(registry.isLocked(), true);

    // Verify config received 0 dependencies
    assert.deepEqual(receivedDeps.get('config'), []);
    // Verify metadata received strictly ['config']
    assert.deepEqual(receivedDeps.get('metadata'), ['config']);

    await engine.shutdown();
    assert.equal(engine.isReady(), false);
  });

  it('Fails initialization if a required dependency is missing', async () => {
    const registry = new ModuleRegistry();

    const orphanedModule: IChallengeModule = {
      id: 'identity',
      version: '1.0.0',
      requiredDependencies: ['config'], // 'config' is NOT registered
      initialize() {},
    };

    registry.register(orphanedModule);
    const engine = new ChallengeEngine(registry);

    await assert.rejects(
      () => engine.initialize(),
      ChallengeEngineError,
      'Should reject initialization when dependency is missing'
    );
  });

  it('Validates session existence on context', () => {
    const registry = new ModuleRegistry();
    const engine = new ChallengeEngine(registry);

    const unauthenticatedCtx = new RequestContext();
    assert.throws(
      () => engine.validateContext(unauthenticatedCtx),
      ChallengeEngineError,
      'Context without session must fail validation'
    );

    const config = validateAndBuildConfig({ environment: 'test' });
    const store = new SessionStore(config);
    try {
      const session = store.createSession();
      const authenticatedCtx = new RequestContext({ session });
      assert.doesNotThrow(() => engine.validateContext(authenticatedCtx));
    } finally {
      store.shutdown();
    }
  });
});
