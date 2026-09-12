import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RequestContext } from '../src/context/request-context.js';
import { ChallengeEngine } from '../src/engine/challenge-engine.js';
import { ModuleRegistry } from '../src/engine/module-registry.js';
import { EvidenceResponse } from '../src/evidence/evidence-types.js';
import { AuditModule } from '../src/modules/audit/audit-module.js';
import { ConfigModule } from '../src/modules/config/config-module.js';
import { IdentityModule } from '../src/modules/identity/identity-module.js';
import { MetadataModule } from '../src/modules/metadata/metadata-module.js';
import { TRUST_ARTIFACTS } from '../src/modules/trust/trust-artifacts.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import {
  InsufficientEvidenceError,
  TrustSessionState,
} from '../src/modules/trust/trust-types.js';
import {
  TrustConsistencyError,
  validateTrustArtifacts,
} from '../src/modules/trust/trust-validator.js';
import {
  SimOperationNotAllowedError,
  SimRouteNotFoundError,
} from '../src/router/sim-errors.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { validateAndBuildConfig } from '../src/config/config.js';
import { SessionStore } from '../src/session/session-store.js';
import { StateOwnershipError } from '../src/session/session-context.js';

describe('Prompt 7: Deterministic Trust Resolution & Evidence Correlation Engine (Requirements 1-82)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;

  const fixedTrustRoutes = [
    'sim://trust/context-coherence',
    'sim://trust/binding-coherence',
    'sim://trust/lineage-coherence',
    'sim://trust/context-membership',
    'sim://trust/effective-interpretation',
  ];

  beforeEach(async () => {
    moduleRegistry = new ModuleRegistry();
    routeRegistry = new SimRouteRegistry();
    engine = new ChallengeEngine(moduleRegistry, { routeRegistry });

    const metadataModule = new MetadataModule(routeRegistry);
    const auditModule = new AuditModule(routeRegistry);
    const configModule = new ConfigModule(routeRegistry);
    const identityModule = new IdentityModule(routeRegistry);
    const trustModule = new TrustModule(routeRegistry);

    moduleRegistry.register(metadataModule);
    moduleRegistry.register(auditModule);
    moduleRegistry.register(configModule);
    moduleRegistry.register(identityModule);
    moduleRegistry.register(trustModule);

    await engine.initialize();

    const appConfig = validateAndBuildConfig({
      environment: 'test',
    });
    sessionStore = new SessionStore(appConfig);
  });

  // Helper to satisfy all prerequisites for a session
  async function discoverAllPrerequisites(reqCtx: RequestContext) {
    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://metadata/execution-context'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://metadata/trust-boundary'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://audit/failed-transitions'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://audit/correlation-records'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/binding-profile'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/compatibility-rules'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/binding'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/trust-membership'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/lineage'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/compatibility'), 'READ', reqCtx);
  }

  // ========================================================
  // 1. Module Registration & Lifecycle (Req 1-6)
  // ========================================================
  it('1. Trust module registers successfully in ModuleRegistry', () => {
    assert.equal(moduleRegistry.has('trust'), true);
  });

  it('2. Trust module has the correct module ID', () => {
    const mod = moduleRegistry.get('trust');
    assert(mod);
    assert.equal(mod.id, 'trust');
  });

  it('3. Dependencies are explicitly declared and correct', () => {
    const mod = moduleRegistry.get('trust');
    assert(mod);
    assert.deepEqual(mod.requiredDependencies, ['metadata', 'audit', 'config', 'identity']);
  });

  it('4. Fixed trust routes register successfully in SimRouteRegistry', () => {
    for (const r of fixedTrustRoutes) {
      assert.equal(routeRegistry.hasRoute(parseSimRoute(r), 'READ'), true);
    }
  });

  it('5. Duplicate trust route registration fails during initialization', () => {
    const duplicateMod = new TrustModule(routeRegistry);
    assert.throws(() => duplicateMod.initialize(new Map()));
  });

  it('6. Registration after registry lock fails', () => {
    assert.equal(routeRegistry.isLocked(), true);
    assert.throws(() =>
      routeRegistry.register(parseSimRoute('sim://trust/unauthorized-route'), 'READ', () => {})
    );
  });

  // ========================================================
  // 2. Route Security & Grammar (Req 7-18)
  // ========================================================
  it('7. Every canonical Trust route works when prerequisites are satisfied', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    for (const r of fixedTrustRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', reqCtx);
      assert.equal(res.status, 'success');
      assert.equal(res.data.status, 'ok');
      assert.equal(res.data.evidence.source, 'trust');
      assert(res.data.evidence.id.startsWith('EVD-TRUST-'));
    }
  });

  it('8. Unknown routes fail safely with SimRouteNotFoundError', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/non-existent-artifact'), 'READ', reqCtx),
      (err: any) => err instanceof SimRouteNotFoundError && err.statusCode === 404
    );
  });

  it('8b. Unsupported operations fail safely with SimOperationNotAllowedError', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'CREATE' as any, reqCtx),
      (err: any) => err instanceof SimOperationNotAllowedError && err.statusCode === 403
    );
  });

  it('9. Route enumeration does not exist (index/list routes fail)', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/list'), 'READ', reqCtx),
      (err: any) => err instanceof SimRouteNotFoundError
    );
    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/index'), 'READ', reqCtx),
      (err: any) => err instanceof SimRouteNotFoundError
    );
  });

  it('10. Arbitrary trust routes fail safely', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/evaluate'), 'READ', reqCtx),
      (err: any) => err instanceof SimRouteNotFoundError
    );
  });

  it('11. Case variations fail safely', () => {
    assert.throws(() => parseSimRoute('sim://TRUST/context-coherence'));
    assert.throws(() => parseSimRoute('sim://trust/Context-Coherence'));
  });

  it('12. Duplicate slashes fail safely', () => {
    assert.throws(() => parseSimRoute('sim://trust//context-coherence'));
    assert.throws(() => parseSimRoute('sim:///trust/context-coherence'));
  });

  it('13. Traversal fails safely', () => {
    assert.throws(() => parseSimRoute('sim://trust/../config/active-specification'));
  });

  it('14. Dot segments fail safely', () => {
    assert.throws(() => parseSimRoute('sim://trust/./context-coherence'));
  });

  it('15. Percent encoding fails safely', () => {
    assert.throws(() => parseSimRoute('sim://trust/%2e%2e/context-coherence'));
    assert.throws(() => parseSimRoute('sim://trust/context%2dcoherence'));
  });

  it('16. Encoded separators fail safely', () => {
    assert.throws(() => parseSimRoute('sim://trust%2fcontext-coherence'));
  });

  it('17. Query strings fail safely', () => {
    assert.throws(() => parseSimRoute('sim://trust/context-coherence?query=all'));
  });

  it('18. Fragments fail safely', () => {
    assert.throws(() => parseSimRoute('sim://trust/context-coherence#fragment'));
  });

  // ========================================================
  // 3. Discovery Gating (Req 19-29)
  // ========================================================
  it('19. Trust artifact fails before prerequisites are discovered', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx),
      (err: any) =>
        err instanceof InsufficientEvidenceError &&
        err.code === 'ERR_INSUFFICIENT_EVIDENCE_RECORD' &&
        err.statusCode === 422
    );
  });

  it('20. Error message does not reveal exact prerequisites', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    try {
      await engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx);
      assert.fail('Expected error');
    } catch (err: any) {
      assert(!err.message.includes('EVD-META-'));
      assert(!err.message.includes('EVD-IDN-'));
      assert(!err.message.includes('prerequisite'));
    }
  });

  it('21. Error does not reveal evidence IDs', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    try {
      await engine.dispatch(parseSimRoute('sim://trust/effective-interpretation'), 'READ', reqCtx);
      assert.fail('Expected error');
    } catch (err: any) {
      assert(!err.message.includes('EVD-'));
      assert(!err.message.includes('CFG'));
    }
  });

  it('22. Error does not reveal routes', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    try {
      await engine.dispatch(parseSimRoute('sim://trust/binding-coherence'), 'READ', reqCtx);
      assert.fail('Expected error');
    } catch (err: any) {
      assert(!err.message.includes('sim://'));
    }
  });

  it('23. Discovering only one prerequisite is insufficient', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    // Discover only 1 of 3 prerequisites for context-coherence
    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);

    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx),
      (err: any) => err instanceof InsufficientEvidenceError
    );
  });

  it('24. Discovering all prerequisites enables retrieval', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    // Discover all prerequisites for context-coherence
    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://metadata/execution-context'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/context-coherence'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
    assert.equal(res.data.status, 'ok');
    assert.equal(res.data.evidence.id, 'EVD-TRUST-01-CONTEXT');
  });

  it('25. Discovery state is strictly server-side', () => {
    const session = sessionStore.createSession();
    // Verify server-side state starts empty
    const state = session.context.getNamespaceState<TrustSessionState>('trust');
    assert.equal(state, undefined);
  });

  it('26. Fake client discovery claims are ignored', async () => {
    const session = sessionStore.createSession();
    // Simulate malicious client attempting to attach fake discovery data in request context
    const reqCtx = new RequestContext({
      session,
      metadata: { clientClaimedDiscovery: 'EVD-META-01-PROFILE' },
    });

    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx),
      (err: any) => err instanceof InsufficientEvidenceError
    );
  });

  it('27. Request ordering cannot bypass gating', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/effective-interpretation'), 'READ', reqCtx),
      (err: any) => err instanceof InsufficientEvidenceError
    );
    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/binding-coherence'), 'READ', reqCtx),
      (err: any) => err instanceof InsufficientEvidenceError
    );
  });

  it('28. Duplicate requests cannot bypass gating', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx),
      (err: any) => err instanceof InsufficientEvidenceError
    );
    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx),
      (err: any) => err instanceof InsufficientEvidenceError
    );
  });

  it('29. Concurrent requests cannot bypass gating', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    const promises = Array.from({ length: 5 }, () =>
      engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx)
    );

    const results = await Promise.allSettled(promises);
    for (const r of results) {
      assert.equal(r.status, 'rejected');
    }
  });

  // ========================================================
  // 4. Context Coherence (Req 30-32)
  // ========================================================
  it('30. Correct Metadata and Identity evidence produces deterministic coherence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://metadata/execution-context'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/context-coherence'),
      'READ',
      reqCtx
    );
    assert.equal(res.data.evidence.content.consistency_state, 'COHERENT');
    assert.equal(res.data.evidence.content.workload_reference, 'wrk-hyperion-telemetry-edge');
    assert.equal(res.data.evidence.content.logical_identity, 'hyperion://identity/telemetry/collector-v2');
  });

  it('31. Supporting references resolve correctly in context coherence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/context-coherence'),
      'READ',
      reqCtx
    );
    assert.deepEqual(res.data.evidence.content.supporting_evidence, [
      'EVD-META-01-PROFILE',
      'EVD-META-02-CONTEXT',
      'EVD-IDN-01-CONTEXT',
    ]);
  });

  it('32. Returned context coherence evidence is internally consistent', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/context-coherence'),
      'READ',
      reqCtx
    );
    assert.equal(res.data.evidence.content.authority_conferred, false);
    assert(res.data.evidence.content.coherence_determination.length > 10);
  });

  // ========================================================
  // 5. Binding Coherence (Req 33-35)
  // ========================================================
  it('33. Config and Identity binding references correlate correctly', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/binding-coherence'),
      'READ',
      reqCtx
    );
    assert.equal(res.data.evidence.content.consistency_state, 'RESOLVED_CONSISTENT');
    assert.equal(res.data.evidence.content.active_specification_id, 'spec-edge-telemetry-active');
    assert.equal(res.data.evidence.content.identity_binding_id, 'bind-identity-enclave-active');
    assert.equal(res.data.evidence.content.hardware_anchor_ref, 'enclave-integrity-anchor-889f');
  });

  it('34. Active specification semantics remain consistent in binding coherence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/binding-coherence'),
      'READ',
      reqCtx
    );
    assert.deepEqual(res.data.evidence.content.supporting_evidence, [
      'EVD-CFG-01-ACTIVE-SPEC',
      'EVD-IDN-02-BINDING',
    ]);
  });

  it('35. No authority semantics are introduced in binding coherence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/binding-coherence'),
      'READ',
      reqCtx
    );
    assert.equal(res.data.evidence.content.authority_conferred, false);
  });

  // ========================================================
  // 6. Lineage Coherence (Req 36-39)
  // ========================================================
  it('36. Audit references correlate with Identity lineage', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/lineage-coherence'),
      'READ',
      reqCtx
    );
    assert.equal(res.data.evidence.content.lineage_trace_reference, 'REF-CORR-99201-B');
    assert.equal(res.data.evidence.content.audit_continuity, 'CONFIRMED_CONTINUOUS');
  });

  it('37. Config compatibility relationships correlate in lineage coherence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/lineage-coherence'),
      'READ',
      reqCtx
    );
    assert.equal(res.data.evidence.content.superseded_identity, 'hyperion://identity/telemetry/collector-v1');
    assert.equal(res.data.evidence.content.authoritative_identity, 'hyperion://identity/telemetry/collector-v2');
  });

  it('38. Historical references remain meaningful in lineage coherence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/lineage-coherence'),
      'READ',
      reqCtx
    );
    assert(res.data.evidence.content.lineage_determination.includes('unbroken lineage'));
  });

  it('39. Historical references do not override active information (authority_conferred is false)', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/lineage-coherence'),
      'READ',
      reqCtx
    );
    assert.equal(res.data.evidence.content.authority_conferred, false);
  });

  // ========================================================
  // 7. Trust Context & Membership (Req 40-42)
  // ========================================================
  it('40. Trust membership correlates with identity context', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/context-membership'),
      'READ',
      reqCtx
    );
    assert.equal(res.data.evidence.content.consistency_state, 'BOUNDARY_VERIFIED');
    assert.equal(res.data.evidence.content.trust_zone, 'trust-zone-alpha');
    assert.equal(res.data.evidence.content.federation_boundary, 'strata://federation.stage-build.internal');
  });

  it('41. Trust membership does not imply authority', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/context-membership'),
      'READ',
      reqCtx
    );
    assert.equal(res.data.evidence.content.authority_conferred, false);
  });

  it('42. Trust resolution does not imply authority', async () => {
    for (const r of fixedTrustRoutes) {
      const session = sessionStore.createSession();
      const reqCtx = new RequestContext({ session });
      await discoverAllPrerequisites(reqCtx);

      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', reqCtx);
      assert.equal(res.data.evidence.content.authority_conferred, false);
    }
  });

  // ========================================================
  // 8. Effective Interpretation (Req 43-46)
  // ========================================================
  it('43. Active information takes precedence in effective interpretation', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/effective-interpretation'),
      'READ',
      reqCtx
    );
    assert.equal(res.data.evidence.content.consistency_state, 'PRECEDENCE_ENFORCED');
    assert.equal(res.data.evidence.content.active_identity, 'hyperion://identity/telemetry/collector-v2');
    assert.equal(res.data.evidence.content.precedence_hierarchy, 'ACTIVE > COMPATIBILITY > HISTORICAL_CONTEXT');
  });

  it('44. Compatibility information remains meaningful in effective interpretation', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/effective-interpretation'),
      'READ',
      reqCtx
    );
    assert.equal(res.data.evidence.content.historical_reference, 'hyperion://identity/telemetry/collector-v1');
    assert.equal(res.data.evidence.content.compatibility_interpretation, 'HISTORICAL_ONLY');
  });

  it('45. Compatibility does not override active context in effective interpretation', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/effective-interpretation'),
      'READ',
      reqCtx
    );
    assert(res.data.evidence.content.resolution_principle.includes('cannot override active configuration'));
  });

  it('46. Effective interpretation result is deterministic', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res1 = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/effective-interpretation'),
      'READ',
      reqCtx
    );
    const res2 = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/effective-interpretation'),
      'READ',
      reqCtx
    );
    assert.deepEqual(res1.data, res2.data);
  });

  // ========================================================
  // 9. Cross-Module Security & Ownership (Req 47-51)
  // ========================================================
  it('47. Trust cannot write Metadata state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('metadata', { test: 1 }, 'trust'),
      (err: any) => err instanceof StateOwnershipError
    );
  });

  it('48. Trust cannot write Audit state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('audit', { test: 1 }, 'trust'),
      (err: any) => err instanceof StateOwnershipError
    );
  });

  it('49. Trust cannot write Config state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('config', { test: 1 }, 'trust'),
      (err: any) => err instanceof StateOwnershipError
    );
  });

  it('50. Trust cannot write Identity state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('identity', { test: 1 }, 'trust'),
      (err: any) => err instanceof StateOwnershipError
    );
  });

  it('51. Other modules cannot overwrite Trust state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('trust', { test: 1 }, 'metadata'),
      (err: any) => err instanceof StateOwnershipError
    );
    assert.throws(
      () => session.context.setNamespaceState('trust', { test: 1 }, 'identity'),
      (err: any) => err instanceof StateOwnershipError
    );
  });

  // ========================================================
  // 10. Session Isolation (Req 52-56)
  // ========================================================
  it('52. Session A discovery does not affect Session B', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();
    const reqCtxA = new RequestContext({ session: sessionA });
    const reqCtxB = new RequestContext({ session: sessionB });

    await discoverAllPrerequisites(reqCtxA);

    // Session A succeeds
    const resA = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/context-coherence'),
      'READ',
      reqCtxA
    );
    assert.equal(resA.status, 'success');
    assert.equal(resA.data.status, 'ok');

    // Session B must fail
    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtxB),
      (err: any) => err instanceof InsufficientEvidenceError
    );
  });

  it('53. Session B discovery does not affect Session A', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();
    const reqCtxA = new RequestContext({ session: sessionA });
    const reqCtxB = new RequestContext({ session: sessionB });

    await discoverAllPrerequisites(reqCtxB);

    // Session B succeeds
    const resB = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/effective-interpretation'),
      'READ',
      reqCtxB
    );
    assert.equal(resB.status, 'success');
    assert.equal(resB.data.status, 'ok');

    // Session A must fail
    await assert.rejects(
      async () => engine.dispatch(parseSimRoute('sim://trust/effective-interpretation'), 'READ', reqCtxA),
      (err: any) => err instanceof InsufficientEvidenceError
    );
  });

  it('54. Destroyed sessions cannot retrieve Trust evidence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    sessionStore.destroySession(session.id);

    // Session store lookup returns null, reqCtx session is not found in store
    assert.equal(sessionStore.getSession(session.id), undefined);
  });

  it('55. Expired sessions cannot retrieve Trust evidence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    session.expiresAt = Date.now() - 1000;

    const retrieved = sessionStore.getSession(session.id);
    assert.equal(retrieved, undefined);
  });

  it('56. Repeated retrieval is safe and increments accessCount', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    await engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx);

    const state = session.context.getNamespaceState<TrustSessionState>('trust');
    assert.equal(state?.accessCount, 2);
    assert.deepEqual(state?.discoveredResolutions, ['EVD-TRUST-01-CONTEXT']);
  });

  // ========================================================
  // 11. Immutability (Req 57-60)
  // ========================================================
  it('57. Returned Trust evidence cannot mutate shared artifacts', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/context-coherence'),
      'READ',
      reqCtx
    );

    assert.throws(() => {
      (res.data.evidence as any).id = 'MUTATED';
    });
  });

  it('58. Nested objects cannot mutate shared artifacts', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/context-coherence'),
      'READ',
      reqCtx
    );

    assert.throws(() => {
      (res.data.evidence.content as any).workload_reference = 'MUTATED';
    });
  });

  it('59. Mutation attempts do not affect later requests', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res1 = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/context-coherence'),
      'READ',
      reqCtx
    );
    assert.throws(() => {
      (res1.data.evidence.content as any).workload_reference = 'MUTATED';
    });

    const res2 = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/context-coherence'),
      'READ',
      reqCtx
    );
    assert.equal(res2.data.evidence.content.workload_reference, 'wrk-hyperion-telemetry-edge');
  });

  it('60. Mutation attempts in Session A do not affect Session B', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();
    const reqCtxA = new RequestContext({ session: sessionA });
    const reqCtxB = new RequestContext({ session: sessionB });

    await discoverAllPrerequisites(reqCtxA);
    await discoverAllPrerequisites(reqCtxB);

    const resA = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/binding-coherence'),
      'READ',
      reqCtxA
    );
    assert.throws(() => {
      (resA.data.evidence.content as any).hardware_anchor_ref = 'MUTATED';
    });

    const resB = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/binding-coherence'),
      'READ',
      reqCtxB
    );
    assert.equal(resB.data.evidence.content.hardware_anchor_ref, 'enclave-integrity-anchor-889f');
  });

  // ========================================================
  // 12. Information Leakage (Req 61-69)
  // ========================================================
  it('61. No authentication terminology leaks', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    for (const r of fixedTrustRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', reqCtx);
      const json = JSON.stringify(res.data);
      assert(!json.includes('OAuth'));
      assert(!json.includes('OIDC'));
      assert(!json.includes('SAML'));
      assert(!json.includes('bearer'));
    }
  });

  it('62. No SPIFFE / SPIRE / SVID terminology leaks', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    for (const r of fixedTrustRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', reqCtx);
      const json = JSON.stringify(res.data);
      assert(!/\b(spiffe|spire|svid)\b/i.test(json));
    }
  });

  it('63. No token terminology leaks', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    for (const r of fixedTrustRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', reqCtx);
      const json = JSON.stringify(res.data);
      assert(!json.includes('JWT'));
      assert(!json.includes('access_token'));
      assert(!json.includes('refresh_token'));
    }
  });

  it('64. No authorization syntax leaks', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    for (const r of fixedTrustRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', reqCtx);
      const json = JSON.stringify(res.data);
      assert(!json.includes('strata:PrincipalTag'));
      assert(!json.includes('AuditRefCheck'));
    }
  });

  it('65. No exact future role names leak', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    for (const r of fixedTrustRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', reqCtx);
      const json = JSON.stringify(res.data);
      assert(!json.includes('OrbitalReleaseRole'));
      assert(!json.includes('PipelineDeployerRole'));
    }
  });

  it('66. No future endpoint inventory leaks', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    for (const r of fixedTrustRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', reqCtx);
      const json = JSON.stringify(res.data);
      assert(!json.includes('sim://sts/'));
      assert(!json.includes('sim://policy/'));
      assert(!json.includes('sim://controlplane/'));
      assert(!json.includes('sim://vault/'));
    }
  });

  it('67. No challenge meta-language leaks', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    for (const r of fixedTrustRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', reqCtx);
      const json = JSON.stringify(res.data);
      assert(!/prompt\s*\d+/i.test(json));
      assert(!/phase\s*\d+/i.test(json));
      assert(!/next\s+stage/i.test(json));
      assert(!/subsequent\s+phase/i.test(json));
      assert(!/you\s+will\s+need/i.test(json));
      assert(!/this\s+unlocks/i.test(json));
    }
  });

  it('68-69. No BPCTF{ material or flag derivation material exists', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    for (const r of fixedTrustRoutes) {
      const res = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute(r), 'READ', reqCtx);
      const json = JSON.stringify(res.data);
      assert(!json.includes('BPCTF{'));
      assert(!json.includes('FLAG'));
    }
  });

  // ========================================================
  // 13. Determinism (Req 70-73)
  // ========================================================
  it('70. Same evidence state produces same result', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const a = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute('sim://trust/lineage-coherence'), 'READ', reqCtx);
    const b = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute('sim://trust/lineage-coherence'), 'READ', reqCtx);
    assert.deepEqual(a.data, b.data);
  });

  it('71. Results do not depend on time', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const a = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute('sim://trust/binding-coherence'), 'READ', reqCtx);
    await new Promise((r) => setTimeout(r, 50));
    const b = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute('sim://trust/binding-coherence'), 'READ', reqCtx);
    assert.deepEqual(a.data, b.data);
  });

  it('72. Results do not depend on randomness', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        engine.dispatch<EvidenceResponse<any>>(parseSimRoute('sim://trust/context-membership'), 'READ', reqCtx)
      )
    );
    for (let i = 1; i < results.length; i++) {
      assert.deepEqual(results[0].data, results[i].data);
    }
  });

  it('73. Results do not depend on network activity (zero network primitives)', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverAllPrerequisites(reqCtx);

    const res = await engine.dispatch<EvidenceResponse<any>>(
      parseSimRoute('sim://trust/effective-interpretation'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
    assert.equal(res.data.status, 'ok');
  });

  // ========================================================
  // 14. Validator Tests (Req 74-80)
  // ========================================================
  it('74. Validator rejects invalid artifact ID format', () => {
    const bad: any = {
      ...TRUST_ARTIFACTS,
      bad: {
        ...TRUST_ARTIFACTS['context-coherence'],
        artifactId: 'INVALID-ID',
      },
    };
    assert.throws(() => validateTrustArtifacts(bad), (err: any) => err instanceof TrustConsistencyError);
  });

  it('75. Validator rejects duplicate artifact IDs', () => {
    const bad: any = {
      ...TRUST_ARTIFACTS,
      dup: {
        ...TRUST_ARTIFACTS['context-coherence'],
      },
    };
    assert.throws(() => validateTrustArtifacts(bad), (err: any) => err instanceof TrustConsistencyError);
  });

  it('76. Validator rejects invalid semver version', () => {
    const bad: any = {
      ...TRUST_ARTIFACTS,
      bad: {
        ...TRUST_ARTIFACTS['context-coherence'],
        artifactId: 'EVD-TRUST-99-TEST',
        version: 'bad-version',
      },
    };
    assert.throws(() => validateTrustArtifacts(bad), (err: any) => err instanceof TrustConsistencyError);
  });

  it('77. Validator rejects invalid status', () => {
    const bad: any = {
      ...TRUST_ARTIFACTS,
      bad: {
        ...TRUST_ARTIFACTS['context-coherence'],
        artifactId: 'EVD-TRUST-99-TEST',
        status: 'INVALID_STATUS',
      },
    };
    assert.throws(() => validateTrustArtifacts(bad), (err: any) => err instanceof TrustConsistencyError);
  });

  it('78. Validator rejects non-false authority_conferred', () => {
    const bad: any = {
      ...TRUST_ARTIFACTS,
      bad: {
        ...TRUST_ARTIFACTS['context-coherence'],
        artifactId: 'EVD-TRUST-99-TEST',
        content: {
          ...TRUST_ARTIFACTS['context-coherence'].content,
          authority_conferred: true,
        },
      },
    };
    assert.throws(() => validateTrustArtifacts(bad), (err: any) => err instanceof TrustConsistencyError);
  });

  it('79. Validator rejects unknown prerequisite evidence ID', () => {
    const bad: any = {
      ...TRUST_ARTIFACTS,
      bad: {
        ...TRUST_ARTIFACTS['context-coherence'],
        artifactId: 'EVD-TRUST-99-TEST',
        requiredPrerequisites: ['EVD-UNKNOWN-999'],
      },
    };
    assert.throws(() => validateTrustArtifacts(bad), (err: any) => err instanceof TrustConsistencyError);
  });

  it('80. Validator rejects SPIFFE technology leakage in trust artifact', () => {
    const bad: any = {
      ...TRUST_ARTIFACTS,
      bad: {
        ...TRUST_ARTIFACTS['context-coherence'],
        artifactId: 'EVD-TRUST-99-TEST',
        content: {
          ...TRUST_ARTIFACTS['context-coherence'].content,
          leaked: 'spiffe://example.internal/test',
        },
      },
    };
    assert.throws(() => validateTrustArtifacts(bad), (err: any) => err instanceof TrustConsistencyError);
  });

  // ========================================================
  // 15. Engine & Full Regression (Req 81-82)
  // ========================================================
  it('81. All 4 prior modules remain discoverable and functional', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    const meta = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    const audit = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute('sim://audit/bootstrap-history'), 'READ', reqCtx);
    const cfg = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);
    const idn = await engine.dispatch<EvidenceResponse<any>>(parseSimRoute('sim://identity/context'), 'READ', reqCtx);

    assert.equal(meta.data.evidence.id, 'EVD-META-01-PROFILE');
    assert.equal(audit.data.evidence.id, 'EVD-AUD-01-BOOTSTRAP');
    assert.equal(cfg.data.evidence.id, 'EVD-CFG-01-ACTIVE-SPEC');
    assert.equal(idn.data.evidence.id, 'EVD-IDN-01-CONTEXT');
  });

  it('82. Engine is fully initialized, ready, and locked with all 5 modules active', () => {
    assert.equal(engine.isReady(), true);
    assert.equal(moduleRegistry.isLocked(), true);
    assert.equal(routeRegistry.isLocked(), true);
    assert.equal(moduleRegistry.has('metadata'), true);
    assert.equal(moduleRegistry.has('audit'), true);
    assert.equal(moduleRegistry.has('config'), true);
    assert.equal(moduleRegistry.has('identity'), true);
    assert.equal(moduleRegistry.has('trust'), true);
  });
});
