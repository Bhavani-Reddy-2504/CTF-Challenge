import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RequestContext } from '../src/context/request-context.js';
import { ChallengeEngine } from '../src/engine/challenge-engine.js';
import { ModuleRegistry } from '../src/engine/module-registry.js';
import { EvidenceResponse } from '../src/evidence/evidence-types.js';
import { MetadataModule, MetadataSessionState } from '../src/modules/metadata/metadata-module.js';
import {
  SimOperationNotAllowedError,
  SimRouteNotFoundError,
} from '../src/router/sim-errors.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { validateAndBuildConfig } from '../src/config/config.js';
import { SessionStore } from '../src/session/session-store.js';
import { StateOwnershipError } from '../src/session/session-context.js';

describe('Metadata Module Tests (Requirements 1-11)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;
  let metadataModule: MetadataModule;

  beforeEach(async () => {
    moduleRegistry = new ModuleRegistry();
    routeRegistry = new SimRouteRegistry();
    engine = new ChallengeEngine(moduleRegistry, { routeRegistry });

    const config = validateAndBuildConfig({ environment: 'test' });
    sessionStore = new SessionStore(config);

    metadataModule = new MetadataModule(routeRegistry);
    moduleRegistry.register(metadataModule);
    await engine.initialize();
  });

  it('1. Metadata module registers successfully in ModuleRegistry', () => {
    assert.equal(moduleRegistry.has('metadata'), true);
    assert.equal(moduleRegistry.get('metadata')?.id, 'metadata');
    assert.equal(moduleRegistry.get('metadata')?.version, '1.0.0');
  });

  it('2. Fixed metadata routes are registered in SimRouteRegistry', () => {
    const fixedRoutes = [
      'sim://metadata/workload-profile',
      'sim://metadata/execution-context',
      'sim://metadata/trust-boundary',
      'sim://metadata/compatibility-record',
    ];

    for (const r of fixedRoutes) {
      const parsed = parseSimRoute(r);
      assert.equal(routeRegistry.hasRoute(parsed, 'READ'), true, `Route ${r} must be registered`);
    }
  });

  it('3. Valid route returns deterministic evidence', async () => {
    const route = parseSimRoute('sim://metadata/workload-profile');
    const reqCtx = new RequestContext();

    const res1 = await engine.dispatch<EvidenceResponse>(route, 'READ', reqCtx);
    const res2 = await engine.dispatch<EvidenceResponse>(route, 'READ', reqCtx);

    assert.equal(res1.status, 'success');
    assert.deepEqual(res1.data, res2.data, 'Responses must be completely deterministic');
    assert.equal(res1.data.status, 'ok');
    assert.equal(res1.data.evidence.id, 'EVD-META-01-PROFILE');
  });

  it('4. Evidence has stable ID and proper shape', async () => {
    const route = parseSimRoute('sim://metadata/execution-context');
    const res = await engine.dispatch<EvidenceResponse>(route, 'READ', new RequestContext());

    assert.equal(res.data.evidence.id, 'EVD-META-02-CONTEXT');
    assert.equal(res.data.evidence.classification, 'ENVIRONMENT_TOPOLOGY');
    assert.equal(typeof res.data.evidence.content, 'object');
  });

  it('5. Evidence source is strictly "metadata"', async () => {
    const route = parseSimRoute('sim://metadata/trust-boundary');
    const res = await engine.dispatch<EvidenceResponse>(route, 'READ', new RequestContext());

    assert.equal(res.data.evidence.source, 'metadata');
    assert.equal(res.data.evidence.id, 'EVD-META-03-BOUNDARY');
  });

  it('6. No secrets, keys, or credentials are returned in metadata content', async () => {
    const fixedRoutes = [
      'sim://metadata/workload-profile',
      'sim://metadata/execution-context',
      'sim://metadata/trust-boundary',
      'sim://metadata/compatibility-record',
    ];

    for (const r of fixedRoutes) {
      const res = await engine.dispatch<EvidenceResponse>(parseSimRoute(r), 'READ', new RequestContext());
      const str = JSON.stringify(res.data);

      assert(!str.includes('AKIA'), 'No AWS keys permitted');
      assert(!str.includes('PRIVATE KEY'), 'No private keys permitted');
      assert(!str.includes('BPCTF{'), 'Flag must never appear in metadata');
      assert(!str.includes('password'), 'No passwords permitted');
      assert(!str.includes('secret_key'), 'No secrets permitted');
    }
  });

  it('7. Discovery is recorded server-side in session context', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    const route = parseSimRoute('sim://metadata/workload-profile');
    await engine.dispatch(route, 'READ', reqCtx);

    const metaState = session.context.getNamespaceState<MetadataSessionState>('metadata');
    assert.ok(metaState);
    assert.equal(metaState.accessCount, 1);
    assert.deepEqual(metaState.discoveredEvidence, ['EVD-META-01-PROFILE']);
    assert.equal(metaState.lastAccessedArtifact, 'EVD-META-01-PROFILE');
  });

  it('8. Duplicate discovery of the same artifact behaves safely without duplicate IDs', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    const route = parseSimRoute('sim://metadata/workload-profile');
    await engine.dispatch(route, 'READ', reqCtx);
    await engine.dispatch(route, 'READ', reqCtx);

    const metaState = session.context.getNamespaceState<MetadataSessionState>('metadata');
    assert.ok(metaState);
    assert.equal(metaState.accessCount, 2);
    assert.deepEqual(metaState.discoveredEvidence, ['EVD-META-01-PROFILE']);
  });

  it('9. Metadata module cannot overwrite audit namespace state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('audit', { fake: true }, 'metadata'),
      StateOwnershipError,
      'Metadata module must be barred from modifying audit namespace'
    );
  });

  it('10. Unknown metadata route fails safely with SimRouteNotFoundError', async () => {
    const unknownRoute = parseSimRoute('sim://metadata/unknown-artifact');
    await assert.rejects(
      () => engine.dispatch(unknownRoute, 'READ', new RequestContext()),
      SimRouteNotFoundError
    );
  });

  it('11. Unsupported operation (WRITE) fails safely with SimOperationNotAllowedError', async () => {
    const route = parseSimRoute('sim://metadata/workload-profile');
    await assert.rejects(
      () => engine.dispatch(route, 'WRITE', new RequestContext()),
      SimOperationNotAllowedError
    );
  });
});
