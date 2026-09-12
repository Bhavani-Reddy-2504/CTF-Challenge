import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { IChallengeModule } from '../src/engine/module-contract.js';
import { ModuleRegistry, ModuleRegistryError } from '../src/engine/module-registry.js';

describe('Module Registry Tests (Requirements 22-26)', () => {
  let registry: ModuleRegistry;

  const mockMetaModule: IChallengeModule = {
    id: 'metadata',
    version: '1.0.0',
    requiredDependencies: [],
    initialize: () => {},
  };

  const mockConfigModule: IChallengeModule = {
    id: 'config',
    version: '1.0.0',
    requiredDependencies: [],
    initialize: () => {},
  };

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  it('22. Explicit registration works', () => {
    registry.register(mockMetaModule);
    assert.equal(registry.has('metadata'), true);
    assert.equal(registry.get('metadata')?.id, 'metadata');
    assert.equal(registry.getAll().length, 1);
  });

  it('23. Duplicate registration fails', () => {
    registry.register(mockMetaModule);

    assert.throws(
      () => registry.register(mockMetaModule),
      ModuleRegistryError,
      'Duplicate module registration must throw ModuleRegistryError'
    );
  });

  it('24. Unknown module lookup fails safely and returns undefined', () => {
    assert.equal(registry.get('vault'), undefined);
    assert.equal(registry.has('vault'), false);
  });

  it('25. Registry locks after startup', () => {
    registry.register(mockMetaModule);
    assert.equal(registry.isLocked(), false);

    registry.lock();
    assert.equal(registry.isLocked(), true);
  });

  it('26. Registration after lock fails', () => {
    registry.register(mockMetaModule);
    registry.lock();

    assert.throws(
      () => registry.register(mockConfigModule),
      ModuleRegistryError,
      'Registration must fail once the registry is locked'
    );
    assert.equal(registry.has('config'), false);
  });
});
