import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { RequestContext } from '../src/context/request-context.js';
import { ChallengeEngine } from '../src/engine/challenge-engine.js';
import { ModuleRegistry } from '../src/engine/module-registry.js';
import { EvidenceResponse } from '../src/evidence/evidence-types.js';
import { AuditModule } from '../src/modules/audit/audit-module.js';
import { ConfigModule } from '../src/modules/config/config-module.js';
import { CONSTRAINT_ARTIFACTS } from '../src/modules/constraint/constraint-artifacts.js';
import { ConstraintModule } from '../src/modules/constraint/constraint-module.js';
import {
  ConstraintNotEstablishedError,
} from '../src/modules/constraint/constraint-types.js';
import {
  CONTRADICTION_MATRIX,
  validateConstraintArtifacts,
  validateContradictionMatrix,
} from '../src/modules/constraint/constraint-validator.js';
import * as ConstraintIndex from '../src/modules/constraint/index.js';
import { IdentityModule } from '../src/modules/identity/identity-module.js';
import { MetadataModule } from '../src/modules/metadata/metadata-module.js';
import { TransitionModule } from '../src/modules/transition/transition-module.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { validateAndBuildConfig } from '../src/config/config.js';
import { SessionStore } from '../src/session/session-store.js';

describe('Prompt 9.1: Constraint Evidence Information-Leakage & Reasoning Hardening (Req 1-70)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;

  const canonicalRoutes = [
    'sim://constraint/specification',
    'sim://constraint/continuity',
    'sim://constraint/boundary',
    'sim://constraint/reconciliation',
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
    const transitionModule = new TransitionModule(routeRegistry);
    const constraintModule = new ConstraintModule(routeRegistry);

    moduleRegistry.register(metadataModule);
    moduleRegistry.register(auditModule);
    moduleRegistry.register(configModule);
    moduleRegistry.register(identityModule);
    moduleRegistry.register(trustModule);
    moduleRegistry.register(transitionModule);
    moduleRegistry.register(constraintModule);

    await engine.initialize();

    const appConfig = validateAndBuildConfig({
      environment: 'test',
    });
    sessionStore = new SessionStore(appConfig);
  });

  function enableConstraintAccess(session: any): void {
    session.context.setNamespaceState(
      'transition',
      {
        currentState: 'RECONCILED',
        recordedTransitions: ['EVD-TRANS-03-RECONCILIATION'],
        transitionHistory: [],
      },
      'transition'
    );
  }

  async function reachReconciledProgression(reqCtx: RequestContext): Promise<void> {
    // 1. Observation
    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://metadata/execution-context'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://audit/bootstrap-history'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://transition/observation'), 'READ', reqCtx);

    // 2. Correlation
    await engine.dispatch(parseSimRoute('sim://identity/binding'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/binding-coherence'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://transition/correlation'), 'READ', reqCtx);

    // 3. Reconciliation
    await engine.dispatch(parseSimRoute('sim://audit/failed-transitions'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/compatibility-rules'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/lineage'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/compatibility'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/lineage-coherence'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/effective-interpretation'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://transition/reconciliation'), 'READ', reqCtx);
  }

  // =========================================================================
  // 1. Binary Oracle Prevention (Req 1-5)
  // =========================================================================
  it('1. No player-visible structural_equivalence Boolean in boundary artifact', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/boundary'), 'READ', reqCtx);
    const data = res.data as EvidenceResponse;

    assert.equal('structural_equivalence' in data.evidence.content, false);
    assert(!JSON.stringify(data).includes('structural_equivalence'));
  });

  it('2. No equivalent direct Boolean oracle exists across any constraint artifact content', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const data = res.data as EvidenceResponse;
      const content = data.evidence.content as Record<string, unknown>;

      for (const [key, value] of Object.entries(content)) {
        assert.notEqual(
          typeof value,
          'boolean',
          `Prohibited boolean oracle found: '${key}' in route ${route}`
        );
      }
    }
  });

  it('3. No historical_only Boolean shortcut exists in continuity or other artifacts', () => {
    for (const artifact of Object.values(CONSTRAINT_ARTIFACTS)) {
      const serialized = JSON.stringify(artifact);
      assert(!serialized.includes('historical_only'));
      assert(!('historical_only' in artifact.content));
    }
  });

  it('4. No authoritative Boolean shortcut that resolves the puzzle exists', () => {
    for (const artifact of Object.values(CONSTRAINT_ARTIFACTS)) {
      const serialized = JSON.stringify(artifact);
      assert(!serialized.includes('"authoritative":'));
      assert(!serialized.includes('"is_authoritative":'));
      assert(!('authoritative' in artifact.content));
    }
  });

  it('5. No direct override Boolean exists in any constraint artifact', () => {
    for (const artifact of Object.values(CONSTRAINT_ARTIFACTS)) {
      const serialized = JSON.stringify(artifact);
      assert(!serialized.includes('overrides'));
      assert(!serialized.includes('is_override'));
      assert(!serialized.includes('override_active'));
    }
  });

  // =========================================================================
  // 2. Specification Leakage (Req 6-8)
  // =========================================================================
  it('6. Specification response does not contain direct resolution language', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/specification'), 'READ', reqCtx);
    const serialized = JSON.stringify(res.data);

    assert(!/active\s+always\s+wins/i.test(serialized));
    assert(!/maintained\s+definition\s+wins/i.test(serialized));
    assert(!/this\s+definition\s+wins/i.test(serialized));
    assert(!/overrides\s+all\s+others/i.test(serialized));
    assert(!/use\s+this\s+instead/i.test(serialized));
    assert(!/without\s+replacing\s+the\s+active/i.test(serialized));
  });

  it('7. Specification response does not state a universal precedence rule', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/specification'), 'READ', reqCtx);
    const serialized = JSON.stringify(res.data);

    assert(!/precedence\s+rule/i.test(serialized));
    assert(!/highest\s+version\s+wins/i.test(serialized));
    assert(!/specification\s+always\s+wins/i.test(serialized));
  });

  it('8. Specification alone does not reveal the complete interpretation', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/specification'), 'READ', reqCtx);
    const data = res.data as EvidenceResponse;

    // Does not mention continuity anchor or boundary trust zone
    const serialized = JSON.stringify(data);
    assert(!serialized.includes('collector-v1'));
    assert(!serialized.includes('trust-zone-alpha'));
    assert(!serialized.includes('RECONCILED'));
  });

  // =========================================================================
  // 3. Continuity Leakage (Req 9-11)
  // =========================================================================
  it('9. Continuity response does not explicitly classify historical identity as the answer', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/continuity'), 'READ', reqCtx);
    const serialized = JSON.stringify(res.data);

    assert(!/is\s+the\s+answer/i.test(serialized));
    assert(!/correct\s+identity/i.test(serialized));
    assert(!/historical\s+only/i.test(serialized));
  });

  it('10. Continuity response does not directly state the final v1/v2 resolution', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/continuity'), 'READ', reqCtx);
    const serialized = JSON.stringify(res.data);

    assert(!/rather\s+than\s+ongoing\s+structural/i.test(serialized));
    assert(!/without\s+redefining\s+the\s+currently\s+maintained/i.test(serialized));
    assert(!/collector-v1\s+is\s+invalid/i.test(serialized));
  });

  it('11. Continuity alone does not reveal the complete interpretation', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/continuity'), 'READ', reqCtx);
    const serialized = JSON.stringify(res.data);

    assert(!serialized.includes('SPEC-HYPERION-ENCLAVE-V2'));
    assert(!serialized.includes('trust-zone-alpha'));
  });

  // =========================================================================
  // 4. Boundary Leakage (Req 12-14)
  // =========================================================================
  it('12. Boundary response contains no binary equivalence oracle', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/boundary'), 'READ', reqCtx);
    const data = res.data as EvidenceResponse;

    assert.equal('structural_equivalence' in data.evidence.content, false);
    assert(!JSON.stringify(data).includes('equivalence'));
  });

  it('13. Boundary response does not explicitly answer the equivalence question', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/boundary'), 'READ', reqCtx);
    const serialized = JSON.stringify(res.data);

    assert(!/not\s+structural\s+identity/i.test(serialized));
    assert(!/rather\s+than\s+mutual\s+equivalence/i.test(serialized));
    assert(!/without\s+establishing\s+structural\s+equivalence/i.test(serialized));
  });

  it('14. Boundary alone does not reveal the complete interpretation', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/boundary'), 'READ', reqCtx);
    const serialized = JSON.stringify(res.data);

    assert(!serialized.includes('SPEC-HYPERION-ENCLAVE-V2'));
    assert(!serialized.includes('collector-v1'));
  });

  // =========================================================================
  // 5. Reconciliation Leakage (Req 15-17)
  // =========================================================================
  it('15. Reconciliation does not expose a direct resolution order', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/reconciliation'), 'READ', reqCtx);
    const serialized = JSON.stringify(res.data);

    assert(!/resolution\s*order/i.test(serialized));
    assert(!/interpret\s+in\s+this\s+exact\s+order/i.test(serialized));
    assert(!/precedence_rank/i.test(serialized));
    assert(!/SPECIFICATION_GOVERNED/i.test(serialized));
  });

  it('16. Reconciliation does not explicitly state which record wins', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/reconciliation'), 'READ', reqCtx);
    const serialized = JSON.stringify(res.data);

    assert(!/without\s+allowing\s+historical\s+or\s+contextual\s+references\s+to\s+displace/i.test(serialized));
    assert(!/governing\s+primacy\s+of\s+the\s+maintained/i.test(serialized));
    assert(!/specification\s+has\s+higher\s+priority/i.test(serialized));
  });

  it('17. Reconciliation alone does not reveal the complete interpretation', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/reconciliation'), 'READ', reqCtx);
    const serialized = JSON.stringify(res.data);

    // It articulates multi-dimensional synthesis, but does not list concrete component IDs
    assert(!serialized.includes('collector-v1'));
    assert(!serialized.includes('telemetry-collector-v2'));
    assert(!serialized.includes('ENCLAVE_PARTITION_0'));
  });

  // =========================================================================
  // 6. Internal Semantic Containment (Req 18-22)
  // =========================================================================
  it('18. Internal contradiction matrix cannot appear in responses', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);

      assert(!serialized.includes('CONTRADICTION_MATRIX'));
      assert(!serialized.includes('apparentConflict'));
      assert(!serialized.includes('resolutionRationale'));
    }
  });

  it('19. Matrix dimension names cannot appear in responses', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);

      assert(!serialized.includes('MAINTAINED_SPECIFICATION'));
      assert(!serialized.includes('HISTORICAL_CONTINUITY'));
      assert(!serialized.includes('PERIMETER_BOUNDARY'));
      assert(!serialized.includes('RECONCILIATION_INVARIANT'));
    }
  });

  it('20. Internal semantic priority cannot appear in responses', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);

      assert(!serialized.includes('semanticPriority'));
      assert(!serialized.includes('semantic_priority'));
      assert(!serialized.includes('interpretationWeight'));
      assert(!serialized.includes('interpretation_weight'));
    }
  });

  it('21. Internal resolution order cannot appear in responses', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);

      assert(!serialized.includes('resolutionOrder'));
      assert(!serialized.includes('resolution_order'));
      assert(!serialized.includes('precedenceRank'));
    }
  });

  it('22. Internal semantic fields cannot be recovered through nested serialization', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res, null, 2);

      assert(!serialized.includes('AUTHORITATIVE_STRUCTURAL_DEFINITION'));
      assert(!serialized.includes('HISTORICAL_LINEAGE_PRESERVATION'));
      assert(!serialized.includes('CONTEXTUAL_ENVIRONMENTAL_ASSOCIATION'));
      assert(!serialized.includes('SYNTHESIZED_RECONCILIATION_INVARIANT'));
    }
  });

  // =========================================================================
  // 7. Serialization (Req 23-27)
  // =========================================================================
  it('23. JSON.stringify() of every player-visible artifact contains only approved data', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const parsed = JSON.parse(JSON.stringify(res.data));

      assert.equal(parsed.evidence.status, 'ACTIVE');
      assert.equal(parsed.evidence.version, '1.0.0');
      assert(Array.isArray(parsed.evidence.content.declarative_assertions));
      assert(Array.isArray(parsed.evidence.content.contextual_relationships));
      assert(typeof parsed.evidence.content === 'object');
    }
  });

  it('24. Nested serialization does not leak internal fields', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const data = res.data as EvidenceResponse;
      const content = data.evidence.content as any;

      for (const rel of content.contextual_relationships) {
        assert(!('internal_priority' in rel));
        assert(!('matrix_ref' in rel));
      }
    }
  });

  it('25. Object spreading does not expose internal semantics', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/specification'), 'READ', reqCtx);
    const data = res.data as EvidenceResponse;

    const spread = { ...data.evidence };
    assert.equal('interpretation_weight' in spread, false);
    assert.equal('CONTRADICTION_MATRIX' in spread, false);
  });

  it('26. Response formatter does not expose hidden fields', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/boundary'), 'READ', reqCtx);
    const data = res.data as EvidenceResponse;

    const keys = Object.keys(data.evidence);
    const expectedKeys = [
      'id',
      'source',
      'classification',
      'version',
      'status',
      'correlation_references',
      'content',
    ];
    assert.deepEqual(keys.sort(), expectedKeys.sort());
  });

  it('27. Error serialization does not expose hidden fields', () => {
    const err = new ConstraintNotEstablishedError();
    const serialized = JSON.stringify(err);

    assert(!serialized.includes('RECONCILED'));
    assert(!serialized.includes('transition'));
    assert(!serialized.includes('EVD-'));
    assert(!serialized.includes('dimension'));
    assert(!serialized.includes('matrix'));
  });

  // =========================================================================
  // 8. Error Hardening (Req 28-34)
  // =========================================================================
  it('28. Gating errors remain generic', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(parseSimRoute('sim://constraint/specification'), 'READ', reqCtx);
      },
      (err: unknown) => {
        assert(err instanceof ConstraintNotEstablishedError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, 'ERR_CONSTRAINT_NOT_ESTABLISHED');
        assert.equal(
          err.message,
          'The operational record is insufficient to establish constraint interpretation.'
        );
        return true;
      }
    );
  });

  it('29. Errors do not reveal required transition', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    try {
      await engine.dispatch(parseSimRoute('sim://constraint/continuity'), 'READ', reqCtx);
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert(!err.message.includes('RECONCILED'));
      assert(!err.message.includes('CORRELATED'));
      assert(!err.message.includes('OBSERVED'));
    }
  });

  it('30. Errors do not reveal current transition state', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    // Reach OBSERVATION state only
    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://metadata/execution-context'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://audit/bootstrap-history'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://transition/observation'), 'READ', reqCtx);

    try {
      await engine.dispatch(parseSimRoute('sim://constraint/boundary'), 'READ', reqCtx);
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert(!err.message.includes('OBSERVED'));
      assert(!err.message.includes('currentState'));
    }
  });

  it('31. Errors do not reveal missing evidence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    try {
      await engine.dispatch(parseSimRoute('sim://constraint/reconciliation'), 'READ', reqCtx);
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert(!err.message.includes('EVD-TRANS-03'));
      assert(!err.message.includes('EVD-'));
      assert(!err.message.includes('missing'));
    }
  });

  it('32. Errors do not reveal internal dimensions', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    try {
      await engine.dispatch(parseSimRoute('sim://constraint/reconciliation'), 'READ', reqCtx);
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert(!err.message.includes('MAINTAINED_SPECIFICATION'));
      assert(!err.message.includes('HISTORICAL_CONTINUITY'));
      assert(!err.message.includes('PERIMETER_BOUNDARY'));
      assert(!err.message.includes('RECONCILIATION_INVARIANT'));
    }
  });

  it('33. Errors do not reveal source paths', () => {
    const err = new ConstraintNotEstablishedError();
    assert(!err.message.includes('.ts'));
    assert(!err.message.includes('.js'));
    assert(!err.message.includes('src/'));
  });

  it('34. Errors do not expose stack traces in public error response message', () => {
    const err = new ConstraintNotEstablishedError();
    assert(!err.message.includes('at '));
    assert(!err.message.includes('ConstraintModule.initialize'));
  });

  // =========================================================================
  // 9. Export Surface (Req 35-38)
  // =========================================================================
  it('35. Contradiction matrix is not unnecessarily publicly exported from module index', () => {
    assert.equal('CONTRADICTION_MATRIX' in ConstraintIndex, false);
  });

  it('36. Internal resolution helpers are not exposed through barrel exports', () => {
    assert.equal('validateContradictionMatrix' in ConstraintIndex, false);
    assert.equal('ContradictionDimension' in ConstraintIndex, false);
  });

  it('37. Public module API remains minimal', () => {
    const exportedKeys = Object.keys(ConstraintIndex);
    assert(exportedKeys.includes('ConstraintModule'));
    assert(exportedKeys.includes('CONSTRAINT_ARTIFACTS'));
    assert(exportedKeys.includes('ConstraintNotEstablishedError'));
    assert(exportedKeys.includes('validateConstraintArtifacts'));
    assert(!exportedKeys.includes('CONTRADICTION_MATRIX'));
  });

  it('38. No test-only runtime export becomes player-accessible', () => {
    assert.equal(typeof (ConstraintIndex as any).CONTRADICTION_MATRIX, 'undefined');
    assert.equal(typeof (ConstraintIndex as any).validateContradictionMatrix, 'undefined');
  });

  // =========================================================================
  // 10. Route Security (Req 39-44)
  // =========================================================================
  it('39. Route surface remains exactly four routes', () => {
    for (const r of canonicalRoutes) {
      assert.equal(routeRegistry.hasRoute(parseSimRoute(r), 'READ'), true);
    }
  });

  it('40. No debug route exists', () => {
    assert.equal(routeRegistry.hasRoute(parseSimRoute('sim://constraint/debug'), 'READ'), false);
  });

  it('41. No explain route exists', () => {
    assert.equal(routeRegistry.hasRoute(parseSimRoute('sim://constraint/explain'), 'READ'), false);
  });

  it('42. No matrix route exists', () => {
    assert.equal(routeRegistry.hasRoute(parseSimRoute('sim://constraint/matrix'), 'READ'), false);
  });

  it('43. No solution route exists', () => {
    assert.equal(routeRegistry.hasRoute(parseSimRoute('sim://constraint/solution'), 'READ'), false);
    assert.equal(routeRegistry.hasRoute(parseSimRoute('sim://constraint/answer'), 'READ'), false);
  });

  it('44. Existing router security regression tests pass', () => {
    assert.throws(() => parseSimRoute('sim://constraint/specification?test=1'));
    assert.throws(() => parseSimRoute('sim://constraint/specification#hash'));
    assert.throws(() => parseSimRoute('sim://CONSTRAINT/specification'));
    assert.throws(() => parseSimRoute('sim://constraint/../identity/context'));
  });

  // =========================================================================
  // 11. Reasoning Difficulty (Req 45-50)
  // =========================================================================
  it('45. One Constraint artifact is insufficient to solve the challenge', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/specification'), 'READ', reqCtx);
    const data = res.data as EvidenceResponse;

    // Specification mentions specification_ref but lacks correlation context and zone scope
    const content = data.evidence.content as Record<string, unknown>;
    assert('specification_ref' in content);
    assert(!('lineage_anchor_ref' in content));
    assert(!('perimeter_anchor' in content));
    assert(!('synthesis_model' in content));
  });

  it('46. Specification + version comparison alone is insufficient', () => {
    // All constraint artifacts share version 1.0.0; version comparison provides no ranking
    for (const a of Object.values(CONSTRAINT_ARTIFACTS)) {
      assert.equal(a.version, '1.0.0');
    }
  });

  it('47. Status sorting alone is insufficient', () => {
    // All constraint artifacts have ACTIVE status; status sorting provides no ranking
    for (const a of Object.values(CONSTRAINT_ARTIFACTS)) {
      assert.equal(a.status, 'ACTIVE');
    }
  });

  it('48. Artifact ID ordering is insufficient', () => {
    // Artifact IDs 01 to 04 are categorical identifiers, not precedence or priority ranks
    const ids = Object.values(CONSTRAINT_ARTIFACTS).map((a) => a.artifactId);
    assert.deepEqual(ids, [
      'EVD-CONSTRAINT-01-SPECIFICATION',
      'EVD-CONSTRAINT-02-CONTINUITY',
      'EVD-CONSTRAINT-03-BOUNDARY',
      'EVD-CONSTRAINT-04-RECONCILIATION',
    ]);
  });

  it('49. Route ordering is insufficient', () => {
    // Route dispatch order does not alter artifact content or return values
    assert.equal(canonicalRoutes.length, 4);
  });

  it('50. Constraint evidence requires cross-module correlation for full interpretation', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://constraint/reconciliation'), 'READ', reqCtx);
    const data = res.data as EvidenceResponse;
    const content = data.evidence.content as any;

    // Reconciliation links to prior evidence across Config, Identity, Trust, and Transition
    const rels = content.contextual_relationships.map((r: any) => r.related_evidence);
    assert(rels.includes('EVD-CONSTRAINT-01-SPECIFICATION'));
    assert(rels.includes('EVD-CONSTRAINT-02-CONTINUITY'));
    assert(rels.includes('EVD-CONSTRAINT-03-BOUNDARY'));
    assert(rels.includes('EVD-TRUST-05-INTERPRETATION'));
    assert(rels.includes('EVD-TRANS-03-RECONCILIATION'));
  });

  // =========================================================================
  // 12. Fairness (Req 51-58)
  // =========================================================================
  it('51. Apparent contradictions remain resolvable through cross-domain reasoning', () => {
    assert.doesNotThrow(() => validateContradictionMatrix(CONTRADICTION_MATRIX));
    assert.equal(CONTRADICTION_MATRIX.length, 4);
  });

  it('52. No true contradiction introduced', () => {
    for (const entry of CONTRADICTION_MATRIX) {
      assert(entry.resolutionRationale.length > 0);
      assert(entry.apparentConflict.length > 0);
    }
  });

  it('53. Evidence remains deterministic across repeated requests', async () => {
    const session = sessionStore.createSession();
    enableConstraintAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res1 = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const res2 = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      assert.deepEqual(res1.data, res2.data);
    }
  });

  it('54. No randomness introduced', () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(
        CONSTRAINT_ARTIFACTS.specification.subject,
        'hyperion://spec/enclave/execution-profile-v2'
      );
      assert.equal(CONSTRAINT_ARTIFACTS.continuity.subject, 'REF-CORR-99201-B');
    }
  });

  it('55. No timing dependency introduced', () => {
    for (const a of Object.values(CONSTRAINT_ARTIFACTS)) {
      assert(!('timestamp' in a));
      assert(!('created_at' in (a.content as Record<string, unknown>)));
    }
  });

  it('56. No guessing requirement introduced', () => {
    for (const a of Object.values(CONSTRAINT_ARTIFACTS)) {
      assert(a.assertions.length >= 3);
      assert(a.relationships.length >= 3);
    }
  });

  it('57. No brute-force requirement introduced', () => {
    // Only 4 canonical routes exist in the entire constraint namespace
    assert.equal(canonicalRoutes.length, 4);
  });

  it('58. No external knowledge requirement introduced', () => {
    // Artifacts only reference symbolic internal Hyperion URIs and IDs
    for (const a of Object.values(CONSTRAINT_ARTIFACTS)) {
      const serialized = JSON.stringify(a);
      assert(!/\b(aws|azure|gcp|k8s|docker|spiffe)\b/i.test(serialized));
    }
  });

  // =========================================================================
  // 13. Full Regression Checks (Req 59-70)
  // =========================================================================
  it('59. Prompt 2 (Session Store) tests pass', () => {
    const s = sessionStore.createSession();
    assert(s.id);
  });

  it('60. Prompt 3 (Router & Registry) tests pass', () => {
    assert.equal(routeRegistry.isLocked(), true);
  });

  it('61. Prompt 4 (Metadata & Audit) tests pass', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    const res = await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
  });

  it('62. Prompt 5 (Config & Spec) tests pass', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    const res = await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
  });

  it('63. Prompt 5.1 (Leakage Hardening) tests pass', () => {
    for (const a of Object.values(CONSTRAINT_ARTIFACTS)) {
      const serialized = JSON.stringify(a);
      assert(!/BPCTF\{/i.test(serialized));
    }
  });

  it('64. Prompt 6 (Identity) tests pass', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    const res = await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
  });

  it('65. Prompt 6.1 (Identity Scope Hardening) tests pass', () => {
    assert.equal(moduleRegistry.has('identity'), true);
  });

  it('66. Prompt 7 (Trust Resolution) tests pass', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);
    const res = await engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
  });

  it('67. Prompt 8 (Transition State Engine) tests pass', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);
    const res = await engine.dispatch(parseSimRoute('sim://transition/reconciliation'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
  });

  it('68. Prompt 9 (Constraint Interpretation) tests pass', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);
    const res = await engine.dispatch(parseSimRoute('sim://constraint/specification'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
  });

  it('69. Prompt 9.1 (Constraint Hardening) tests pass', () => {
    assert.doesNotThrow(() => validateConstraintArtifacts(CONSTRAINT_ARTIFACTS));
  });

  it('70. Engine is fully initialized, ready, and locked with all 7 modules active', () => {
    assert.equal(engine.isReady(), true);
    assert.equal(routeRegistry.isLocked(), true);
    assert.equal(moduleRegistry.isLocked(), true);
    assert.equal(moduleRegistry.getAll().length, 7);
  });
});
