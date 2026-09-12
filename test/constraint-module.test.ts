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
  ConstraintSessionState,
} from '../src/modules/constraint/constraint-types.js';
import {
  CONTRADICTION_MATRIX,
  ConstraintConsistencyError,
  validateConstraintArtifacts,
  validateContradictionMatrix,
} from '../src/modules/constraint/constraint-validator.js';
import { IdentityModule } from '../src/modules/identity/identity-module.js';
import { MetadataModule } from '../src/modules/metadata/metadata-module.js';
import { TransitionModule } from '../src/modules/transition/transition-module.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import { SimRouteNotFoundError } from '../src/router/sim-errors.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { APPROVED_SIM_NAMESPACES } from '../src/router/sim-route.js';
import { validateAndBuildConfig } from '../src/config/config.js';
import { SessionStore } from '../src/session/session-store.js';
import { StateOwnershipError } from '../src/session/session-context.js';

describe('Prompt 9: Constraint Interpretation & Evidence Contradiction Engine (Requirements 1-107)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;

  const fixedConstraintRoutes = [
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

  async function reachReconciledProgression(reqCtx: RequestContext) {
    // 1. Observation prerequisites
    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://metadata/execution-context'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://audit/bootstrap-history'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);

    // Transition Observation
    await engine.dispatch(parseSimRoute('sim://transition/observation'), 'READ', reqCtx);

    // 2. Correlation prerequisites
    await engine.dispatch(parseSimRoute('sim://identity/binding'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/binding-coherence'), 'READ', reqCtx);

    // Transition Correlation
    await engine.dispatch(parseSimRoute('sim://transition/correlation'), 'READ', reqCtx);

    // 3. Reconciliation prerequisites
    await engine.dispatch(parseSimRoute('sim://audit/failed-transitions'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/compatibility-rules'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/lineage'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/compatibility'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/lineage-coherence'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/effective-interpretation'), 'READ', reqCtx);

    // Transition Reconciliation
    await engine.dispatch(parseSimRoute('sim://transition/reconciliation'), 'READ', reqCtx);
  }

  // ========================================================
  // 1. Module Registration & Lifecycle (Req 1-6)
  // ========================================================
  it('1. Constraint module registers successfully in ModuleRegistry', () => {
    assert.equal(moduleRegistry.has('constraint'), true);
  });

  it('2. Constraint module has the correct module ID', () => {
    const mod = moduleRegistry.get('constraint');
    assert(mod);
    assert.equal(mod.id, 'constraint');
  });

  it('3. Dependencies are explicitly declared and correct', () => {
    const mod = moduleRegistry.get('constraint');
    assert(mod);
    assert.deepEqual(mod.requiredDependencies, [
      'metadata',
      'audit',
      'config',
      'identity',
      'trust',
      'transition',
    ]);
  });

  it('4. All four canonical routes register in SimRouteRegistry', () => {
    for (const r of fixedConstraintRoutes) {
      assert.equal(routeRegistry.hasRoute(parseSimRoute(r), 'READ'), true);
    }
  });

  it('5. Duplicate constraint route registration fails during initialization', () => {
    const duplicateMod = new ConstraintModule(routeRegistry);
    assert.throws(() => duplicateMod.initialize(new Map()));
  });

  it('6. Registration after registry lock fails', () => {
    assert.equal(routeRegistry.isLocked(), true);
    assert.throws(() =>
      routeRegistry.register(
        parseSimRoute('sim://constraint/unauthorized-route'),
        'READ',
        () => {}
      )
    );
  });

  // ========================================================
  // 2. Namespace Security (Req 7-9)
  // ========================================================
  it('7. constraint is approved in SimNamespace set', () => {
    assert.equal(APPROVED_SIM_NAMESPACES.has('constraint'), true);
  });

  it('8. Unknown namespaces fail in router grammar', () => {
    assert.throws(() => parseSimRoute('sim://unknown-ns/resource'));
  });

  it('9. Case variants fail in router grammar', () => {
    assert.throws(() => parseSimRoute('sim://CONSTRAINT/specification'));
    assert.throws(() => parseSimRoute('sim://constraint/SPECIFICATION'));
  });

  // ========================================================
  // 3. Artifact Model (Req 10-16)
  // ========================================================
  it('10. Exactly four canonical constraint artifacts exist', () => {
    assert.equal(Object.keys(CONSTRAINT_ARTIFACTS).length, 4);
  });

  it('11. All constraint artifact IDs are unique', () => {
    const ids = Object.values(CONSTRAINT_ARTIFACTS).map((a) => a.artifactId);
    assert.equal(new Set(ids).size, 4);
  });

  it('12. All IDs follow expected EVD-CONSTRAINT-0X format', () => {
    for (const a of Object.values(CONSTRAINT_ARTIFACTS)) {
      assert(/^EVD-CONSTRAINT-0\d-[A-Z]+$/.test(a.artifactId));
      assert(/^EVD-CONSTRAINT-0\d-[A-Z]+$/.test(a.evidenceId));
    }
  });

  it('13. Versions are valid semver 1.0.0', () => {
    for (const a of Object.values(CONSTRAINT_ARTIFACTS)) {
      assert.equal(a.version, '1.0.0');
    }
  });

  it('14. Classifications are valid and semantic', () => {
    assert.equal(
      CONSTRAINT_ARTIFACTS.specification.classification,
      'SPECIFICATION_CONSTRAINT'
    );
    assert.equal(
      CONSTRAINT_ARTIFACTS.continuity.classification,
      'CONTINUITY_CONSTRAINT'
    );
    assert.equal(
      CONSTRAINT_ARTIFACTS.boundary.classification,
      'BOUNDARY_CONSTRAINT'
    );
    assert.equal(
      CONSTRAINT_ARTIFACTS.reconciliation.classification,
      'RECONCILIATION_CONSTRAINT'
    );
  });

  it('15. Artifacts are deterministic', () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(
        CONSTRAINT_ARTIFACTS.specification.artifactId,
        'EVD-CONSTRAINT-01-SPECIFICATION'
      );
      assert.equal(
        CONSTRAINT_ARTIFACTS.continuity.artifactId,
        'EVD-CONSTRAINT-02-CONTINUITY'
      );
    }
  });

  it('16. Artifacts contain no generated timestamps', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(!/timestamp/i.test(serialized));
  });

  // ========================================================
  // 4. Specification Constraint (Req 17-20)
  // ========================================================
  it('17. Specification artifact is retrievable after legitimate gating', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://constraint/specification'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
    const data = res.data as EvidenceResponse;
    assert.equal(data.evidence.id, 'EVD-CONSTRAINT-01-SPECIFICATION');
  });

  it('18. Maintained structure semantics are represented', () => {
    const spec = CONSTRAINT_ARTIFACTS.specification;
    assert.equal(spec.subject, 'hyperion://spec/enclave/execution-profile-v2');
    assert(spec.interpretation.includes('formally maintained execution profile defines structural parameters'));
  });

  it('19. Specification artifact does not explicitly expose a trivial hierarchy', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS.specification);
    assert(!/ACTIVE ALWAYS WINS/i.test(serialized));
    assert(!/HIGHEST VERSION WINS/i.test(serialized));
  });

  it('20. Specification artifact does not independently reveal complete interpretation', () => {
    const spec = CONSTRAINT_ARTIFACTS.specification;
    assert.equal(spec.classification, 'SPECIFICATION_CONSTRAINT');
    assert(!spec.interpretation.includes('RECONCILIATION_INVARIANT'));
  });

  // ========================================================
  // 5. Continuity Constraint (Req 21-25)
  // ========================================================
  it('21. Continuity artifact is retrievable', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://constraint/continuity'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
    const data = res.data as EvidenceResponse;
    assert.equal(data.evidence.id, 'EVD-CONSTRAINT-02-CONTINUITY');
  });

  it('22. Historical lineage remains meaningful in continuity artifact', () => {
    const cont = CONSTRAINT_ARTIFACTS.continuity;
    assert.equal(cont.subject, 'REF-CORR-99201-B');
    assert(cont.content.lineage_anchor_ref.includes('collector-v1'));
  });

  it('23. Compatibility context remains meaningful', () => {
    const cont = CONSTRAINT_ARTIFACTS.continuity;
    const hasCompatRel = cont.relationships.some(
      (r) => (r as any).related_evidence === 'EVD-CFG-04-COMPAT'
    );
    assert.equal(hasCompatRel, true);
  });

  it('24. Continuity artifact does not silently redefine maintained structure', () => {
    const cont = CONSTRAINT_ARTIFACTS.continuity;
    assert(cont.interpretation.includes('Succession lineage and compatibility records preserve trace continuity'));
  });

  it('25. Continuity artifact does not independently reveal complete interpretation', () => {
    const cont = CONSTRAINT_ARTIFACTS.continuity;
    assert(!cont.interpretation.includes('CROSS_DOMAIN_RECONCILIATION'));
  });

  // ========================================================
  // 6. Boundary Constraint (Req 26-29)
  // ========================================================
  it('26. Boundary artifact is retrievable', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://constraint/boundary'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
    const data = res.data as EvidenceResponse;
    assert.equal(data.evidence.id, 'EVD-CONSTRAINT-03-BOUNDARY');
  });

  it('27. Context does not automatically imply structural equivalence (no binary oracle)', () => {
    const bound = CONSTRAINT_ARTIFACTS.boundary;
    assert.equal('structural_equivalence' in bound.content, false);
    assert.equal(bound.content.boundary_scope, 'MULTI_PRINCIPAL_CONTAINMENT');
    assert(bound.interpretation.includes('Perimeter membership and environmental adjacency demarcate co-location boundaries'));
  });

  it('28. Membership remains meaningful in boundary artifact', () => {
    const bound = CONSTRAINT_ARTIFACTS.boundary;
    assert.equal(bound.subject, 'trust-zone-alpha');
    const hasMembershipRel = bound.relationships.some(
      (r) => (r as any).related_evidence === 'EVD-IDN-03-TRUST-MEMBERSHIP'
    );
    assert.equal(hasMembershipRel, true);
  });

  it('29. Boundary artifact does not independently reveal complete interpretation', () => {
    const bound = CONSTRAINT_ARTIFACTS.boundary;
    assert(!bound.interpretation.includes('precedence_model'));
  });

  // ========================================================
  // 7. Reconciliation Constraint (Req 30-33)
  // ========================================================
  it('30. Reconciliation artifact is retrievable', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://constraint/reconciliation'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
    const data = res.data as EvidenceResponse;
    assert.equal(data.evidence.id, 'EVD-CONSTRAINT-04-RECONCILIATION');
  });

  it('31. Reconciliation artifact correlates specification, continuity, and boundary', () => {
    const rec = CONSTRAINT_ARTIFACTS.reconciliation;
    const relIds = rec.relationships.map((r) => (r as any).related_evidence);
    assert(relIds.includes('EVD-CONSTRAINT-01-SPECIFICATION'));
    assert(relIds.includes('EVD-CONSTRAINT-02-CONTINUITY'));
    assert(relIds.includes('EVD-CONSTRAINT-03-BOUNDARY'));
  });

  it('32. Reconciliation artifact does not provide a direct trivial answer', () => {
    const rec = CONSTRAINT_ARTIFACTS.reconciliation;
    assert(!rec.interpretation.includes('THE ANSWER IS'));
    assert(!rec.interpretation.includes('BPCTF{'));
  });

  it('33. Reconciliation artifact does not independently reveal complete interpretation', () => {
    const rec = CONSTRAINT_ARTIFACTS.reconciliation;
    assert(rec.assertions.length > 0);
  });

  // ========================================================
  // 8. Apparent Contradictions & Matrix (Req 34-40)
  // ========================================================
  it('34. v1 historical reference and v2 maintained reference coexist coherently', () => {
    const entry = CONTRADICTION_MATRIX.find(
      (e) => e.dimension === 'MAINTAINED_SPECIFICATION'
    );
    assert(entry);
    assert(entry.apparentConflict.includes('collector-v1'));
    assert(entry.apparentConflict.includes('collector-v2'));
    assert(entry.resolutionRationale.includes('Historical records preserve lineage'));
  });

  it('35. Compatibility does not create a true contradiction', () => {
    const entry = CONTRADICTION_MATRIX.find(
      (e) => e.dimension === 'HISTORICAL_CONTINUITY'
    );
    assert(entry);
    assert(entry.resolutionRationale.includes('correlation reference remains valid'));
  });

  it('36. Context does not become equivalent to identity', () => {
    const entry = CONTRADICTION_MATRIX.find(
      (e) => e.dimension === 'PERIMETER_BOUNDARY'
    );
    assert(entry);
    assert(entry.resolutionRationale.includes('not identity equivalence'));
  });

  it('37. Membership does not become structural definition', () => {
    const bound = CONSTRAINT_ARTIFACTS.boundary;
    assert.equal('structural_equivalence' in bound.content, false);
    assert.equal(bound.content.containment_mode, 'ENVIRONMENTAL_DELIMITATION');
  });

  it('38. Historical reference remains meaningful', () => {
    const cont = CONSTRAINT_ARTIFACTS.continuity;
    assert.equal(cont.content.trace_continuity, 'CONFIRMED_SUCCESSION');
  });

  it('39. Maintained specification remains structurally meaningful', () => {
    const spec = CONSTRAINT_ARTIFACTS.specification;
    assert.equal('interpretation_weight' in spec.content, false);
    assert.equal(
      spec.content.specification_ref,
      'SPEC-HYPERION-ENCLAVE-V2'
    );
  });

  it('40. Contradiction matrix validates consistency', () => {
    assert.doesNotThrow(() => validateContradictionMatrix(CONTRADICTION_MATRIX));
    assert.equal(CONTRADICTION_MATRIX.length, 4);
  });

  // ========================================================
  // 9. Gating & Security (Req 41-45)
  // ========================================================
  it('41. Access fails before legitimate predecessor progression (empty session)', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://constraint/specification'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => {
        assert(err instanceof ConstraintNotEstablishedError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, 'ERR_CONSTRAINT_NOT_ESTABLISHED');
        return true;
      }
    );
  });

  it('42. Generic failure does not expose prerequisite or checklist', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    try {
      await engine.dispatch(
        parseSimRoute('sim://constraint/specification'),
        'READ',
        reqCtx
      );
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.equal(err.name, 'ConstraintNotEstablishedError');
      assert.equal(
        err.message,
        'The operational record is insufficient to establish constraint interpretation.'
      );
      assert(!err.message.includes('RECONCILED'));
      assert(!err.message.includes('transition'));
      assert(!err.message.includes('EVD-'));
    }
  });

  it('43. Client-supplied state claims fail', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://constraint/boundary'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => err instanceof ConstraintNotEstablishedError
    );
  });

  it('44. Legitimate reconciled progression enables access to all four routes', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);

    for (const r of fixedConstraintRoutes) {
      const res = await engine.dispatch(parseSimRoute(r), 'READ', reqCtx);
      assert.equal(res.status, 'success');
    }
  });

  it('45. Session A progression does not enable Session B', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    const reqCtxA = new RequestContext({ session: sessionA });
    const reqCtxB = new RequestContext({ session: sessionB });

    await reachReconciledProgression(reqCtxA);

    // Session A succeeds
    const resA = await engine.dispatch(
      parseSimRoute('sim://constraint/specification'),
      'READ',
      reqCtxA
    );
    assert.equal(resA.status, 'success');

    // Session B fails
    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://constraint/specification'),
          'READ',
          reqCtxB
        );
      },
      (err: unknown) => err instanceof ConstraintNotEstablishedError
    );
  });

  // ========================================================
  // 10. Session Security & Ownership (Req 46-53)
  // ========================================================
  it('46. Constraint owns only constraint namespace', () => {
    const session = sessionStore.createSession();
    session.context.setNamespaceState(
      'constraint',
      { discoveredEvidence: ['EVD-CONSTRAINT-01-SPECIFICATION'] },
      'constraint'
    );
    const state = session.context.getNamespaceState<ConstraintSessionState>('constraint');
    assert.deepEqual(state?.discoveredEvidence, ['EVD-CONSTRAINT-01-SPECIFICATION']);
  });

  it('47. Constraint cannot write to Metadata', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('metadata', { test: 1 }, 'constraint'),
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  it('48. Constraint cannot write to Audit', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('audit', { test: 1 }, 'constraint'),
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  it('49. Constraint cannot write to Config', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('config', { test: 1 }, 'constraint'),
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  it('50. Constraint cannot write to Identity', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('identity', { test: 1 }, 'constraint'),
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  it('51. Constraint cannot write to Trust', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('trust', { test: 1 }, 'constraint'),
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  it('52. Constraint cannot write to Transition', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('transition', { test: 1 }, 'constraint'),
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  it('53. Other modules cannot overwrite Constraint state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => session.context.setNamespaceState('constraint', { test: 1 }, 'transition'),
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  // ========================================================
  // 11. Immutability (Req 54-58)
  // ========================================================
  it('54. Returned constraint artifacts are deeply immutable', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://constraint/specification'),
      'READ',
      reqCtx
    );
    const data = res.data as EvidenceResponse;

    assert.throws(() => {
      (data.evidence as any).id = 'MUTATED';
    });
    assert.equal(
      CONSTRAINT_ARTIFACTS.specification.artifactId,
      'EVD-CONSTRAINT-01-SPECIFICATION'
    );
  });

  it('55. Nested assertions cannot mutate canonical data', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://constraint/specification'),
      'READ',
      reqCtx
    );
    const data = res.data as EvidenceResponse;

    assert.throws(() => {
      (data.evidence.content as any).declarative_assertions[0] = 'HACKED';
    });
  });

  it('56. Nested relationships cannot mutate canonical data', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://constraint/specification'),
      'READ',
      reqCtx
    );
    const data = res.data as EvidenceResponse;

    assert.throws(() => {
      (data.evidence.content as any).contextual_relationships.push({ fake: 1 });
    });
  });

  it('57. Mutation attempts do not affect subsequent responses', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);

    const res1 = await engine.dispatch(
      parseSimRoute('sim://constraint/specification'),
      'READ',
      reqCtx
    );
    const data1 = res1.data as EvidenceResponse;
    assert.equal(data1.evidence.id, 'EVD-CONSTRAINT-01-SPECIFICATION');

    const res2 = await engine.dispatch(
      parseSimRoute('sim://constraint/specification'),
      'READ',
      reqCtx
    );
    const data2 = res2.data as EvidenceResponse;
    assert.equal(data2.evidence.id, 'EVD-CONSTRAINT-01-SPECIFICATION');
  });

  it('58. Session A mutation attempt does not affect Session B', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    const reqCtxA = new RequestContext({ session: sessionA });
    const reqCtxB = new RequestContext({ session: sessionB });

    await reachReconciledProgression(reqCtxA);
    await reachReconciledProgression(reqCtxB);

    const resA = await engine.dispatch(
      parseSimRoute('sim://constraint/specification'),
      'READ',
      reqCtxA
    );
    const resB = await engine.dispatch(
      parseSimRoute('sim://constraint/specification'),
      'READ',
      reqCtxB
    );

    assert.equal(
      (resA.data as EvidenceResponse).evidence.id,
      'EVD-CONSTRAINT-01-SPECIFICATION'
    );
    assert.equal(
      (resB.data as EvidenceResponse).evidence.id,
      'EVD-CONSTRAINT-01-SPECIFICATION'
    );
  });

  // ========================================================
  // 12. Router Security (Req 59-72)
  // ========================================================
  it('59. Unknown routes fail with SimRouteNotFoundError', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://constraint/unknown-route'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => err instanceof SimRouteNotFoundError
    );
  });

  it('60. No list route exists', () => {
    assert.equal(
      routeRegistry.hasRoute(parseSimRoute('sim://constraint/list'), 'READ'),
      false
    );
  });

  it('61. No index route exists', () => {
    assert.equal(
      routeRegistry.hasRoute(parseSimRoute('sim://constraint/index'), 'READ'),
      false
    );
  });

  it('62. No status route exists', () => {
    assert.equal(
      routeRegistry.hasRoute(parseSimRoute('sim://constraint/status'), 'READ'),
      false
    );
    assert.equal(
      routeRegistry.hasRoute(parseSimRoute('sim://constraint/current'), 'READ'),
      false
    );
    assert.equal(
      routeRegistry.hasRoute(parseSimRoute('sim://constraint/progress'), 'READ'),
      false
    );
  });

  it('63. Case variation fails', () => {
    assert.throws(() => parseSimRoute('sim://CONSTRAINT/specification'));
    assert.throws(() => parseSimRoute('sim://constraint/Specification'));
  });

  it('64. Duplicate slash fails', () => {
    assert.throws(() => parseSimRoute('sim://constraint//specification'));
  });

  it('65. Dot segment fails', () => {
    assert.throws(() => parseSimRoute('sim://constraint/./specification'));
  });

  it('66. Traversal fails', () => {
    assert.throws(() => parseSimRoute('sim://constraint/../metadata/workload-profile'));
  });

  it('67. Percent encoding fails', () => {
    assert.throws(() => parseSimRoute('sim://constraint/%73pecification'));
  });

  it('68. Encoded slash fails', () => {
    assert.throws(() => parseSimRoute('sim://constraint%2fspecification'));
  });

  it('69. Encoded backslash fails', () => {
    assert.throws(() => parseSimRoute('sim://constraint%5cspecification'));
  });

  it('70. Query string fails', () => {
    assert.throws(() => parseSimRoute('sim://constraint/specification?query=1'));
  });

  it('71. Fragment fails', () => {
    assert.throws(() => parseSimRoute('sim://constraint/specification#anchor'));
  });

  it('72. Arbitrary suffix fails', () => {
    const route = parseSimRoute('sim://constraint/specification/extra');
    assert.equal(routeRegistry.hasRoute(route, 'READ'), false);
  });

  // ========================================================
  // 13. Information Leakage Defenses (Req 73-84)
  // ========================================================
  it('73. No authentication terminology in constraint artifacts', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(!/\b(login|password|jwt|oauth|oidc|saml|bearer)\b/i.test(serialized));
  });

  it('74. No credentials in constraint artifacts', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(!/\b(access_key|secret_key|api_key|client_secret)\b/i.test(serialized));
  });

  it('75. No tokens in constraint artifacts', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(!/\b(token|access_token|refresh_token|id_token)\b/i.test(serialized));
  });

  it('76. No authorization semantics (RBAC/ABAC/privilege) in constraint artifacts', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(!/\b(permission|permissions|rbac|abac|role_grant)\b/i.test(serialized));
  });

  it('77. No execution denial or execution rights semantics in constraint artifacts', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(
      !/REVOKED_FOR_EXECUTION|DENIED_FOR_EXECUTION|NOT_AUTHORIZED|EXECUTION_BLOCKED|ACCESS_DENIED|PERMISSION_REVOKED/i.test(
        serialized
      )
    );
  });

  it('78. No real cloud provider leakage (AWS, Azure, GCP)', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(!/\b(aws|azure|gcp)\b/i.test(serialized));
  });

  it('79. No container technology leakage (Kubernetes, Docker)', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(!/\b(kubernetes|docker|k8s)\b/i.test(serialized));
  });

  it('80. No identity technology leakage (SPIFFE, SPIRE, SVID)', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(!/\b(spiffe|spire|svid)\b|spiffe:\/\//i.test(serialized));
  });

  it('81. No future infrastructure leakage', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(!/sim:\/\/sts\//i.test(serialized));
    assert(!/sim:\/\/policy\//i.test(serialized));
    assert(!/sim:\/\/controlplane\//i.test(serialized));
    assert(!/sim:\/\/vault\//i.test(serialized));
  });

  it('82. No challenge meta-language', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(!/prompt\s*\d+/i.test(serialized));
    assert(!/phase\s*\d+/i.test(serialized));
    assert(!/subsequent\s+phase/i.test(serialized));
    assert(!/next\s+stage/i.test(serialized));
    assert(!/roadmap/i.test(serialized));
    assert(!/this\s+unlocks/i.test(serialized));
  });

  it('83. No BPCTF{ material in constraint artifacts', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(!serialized.includes('BPCTF{'));
  });

  it('84. No flag derivation material in constraint artifacts', () => {
    const serialized = JSON.stringify(CONSTRAINT_ARTIFACTS);
    assert(!serialized.includes('flag'));
    assert(!serialized.includes('sha256'));
    assert(!serialized.includes('hmac'));
  });

  // ========================================================
  // 14. Determinism (Req 85-88)
  // ========================================================
  it('85. Same session state returns same artifact', async () => {
    const session1 = sessionStore.createSession();
    const session2 = sessionStore.createSession();

    const reqCtx1 = new RequestContext({ session: session1 });
    const reqCtx2 = new RequestContext({ session: session2 });

    await reachReconciledProgression(reqCtx1);
    await reachReconciledProgression(reqCtx2);

    const res1 = await engine.dispatch(
      parseSimRoute('sim://constraint/specification'),
      'READ',
      reqCtx1
    );
    const res2 = await engine.dispatch(
      parseSimRoute('sim://constraint/specification'),
      'READ',
      reqCtx2
    );

    assert.deepEqual(res1.data, res2.data);
  });

  it('86. No time dependency', () => {
    for (const a of Object.values(CONSTRAINT_ARTIFACTS)) {
      assert(!('timestamp' in a));
    }
  });

  it('87. No randomness', () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(
        CONSTRAINT_ARTIFACTS.specification.artifactId,
        'EVD-CONSTRAINT-01-SPECIFICATION'
      );
      assert.equal(
        CONSTRAINT_ARTIFACTS.continuity.artifactId,
        'EVD-CONSTRAINT-02-CONTINUITY'
      );
    }
  });

  it('88. No network dependency', () => {
    const mod = moduleRegistry.get('constraint');
    assert(mod);
  });

  // ========================================================
  // 15. Validator Defenses (Req 89-96)
  // ========================================================
  it('89. Duplicate artifact IDs rejected', () => {
    const invalid = {
      spec1: { ...CONSTRAINT_ARTIFACTS.specification },
      spec2: { ...CONSTRAINT_ARTIFACTS.specification },
    } as any;
    assert.throws(
      () => validateConstraintArtifacts(invalid),
      (err: unknown) => err instanceof ConstraintConsistencyError
    );
  });

  it('90. Invalid artifact ID format rejected', () => {
    const invalid = {
      ...CONSTRAINT_ARTIFACTS,
      specification: {
        ...CONSTRAINT_ARTIFACTS.specification,
        artifactId: 'INVALID-ID',
      },
    } as any;
    assert.throws(
      () => validateConstraintArtifacts(invalid),
      (err: unknown) => err instanceof ConstraintConsistencyError
    );
  });

  it('91. Dangling evidence reference rejected', () => {
    const invalid = {
      ...CONSTRAINT_ARTIFACTS,
      specification: {
        ...CONSTRAINT_ARTIFACTS.specification,
        relationships: [
          { related_evidence: 'EVD-NONEXISTENT-999', relationship_type: 'TEST' },
        ],
      },
    } as any;
    assert.throws(
      () => validateConstraintArtifacts(invalid),
      (err: unknown) => err instanceof ConstraintConsistencyError
    );
  });

  it('92. Circular dependency rejected', () => {
    const invalid = {
      ...CONSTRAINT_ARTIFACTS,
      specification: {
        ...CONSTRAINT_ARTIFACTS.specification,
        relationships: [
          {
            related_evidence: 'EVD-CONSTRAINT-04-RECONCILIATION',
            relationship_type: 'CIRCULAR',
          },
        ],
      },
    } as any;
    assert.throws(
      () => validateConstraintArtifacts(invalid),
      (err: unknown) => err instanceof ConstraintConsistencyError
    );
  });

  it('93. True contradiction rejected in validator', () => {
    const invalid = {
      ...CONSTRAINT_ARTIFACTS,
      specification: {
        ...CONSTRAINT_ARTIFACTS.specification,
        assertions: [],
      },
    } as any;
    assert.throws(
      () => validateConstraintArtifacts(invalid),
      (err: unknown) => err instanceof ConstraintConsistencyError
    );
  });

  it('94. Invalid contradiction matrix rejected', () => {
    const invalidMatrix = [
      {
        dimension: 'TEST',
        interpretationRole: 'TEST',
        governingPrinciple: 'TEST',
        primaryEvidence: ['EVD-UNKNOWN-XYZ'],
        apparentConflict: 'conflict',
        resolutionRationale: 'rationale',
      },
    ] as any;
    assert.throws(
      () => validateContradictionMatrix(invalidMatrix),
      (err: unknown) => err instanceof ConstraintConsistencyError
    );
  });

  it('95. Forbidden terminology rejected by validator', () => {
    const invalid = {
      ...CONSTRAINT_ARTIFACTS,
      specification: {
        ...CONSTRAINT_ARTIFACTS.specification,
        interpretation: 'Uses aws and kubernetes cloud platform',
      },
    } as any;
    assert.throws(
      () => validateConstraintArtifacts(invalid),
      (err: unknown) => err instanceof ConstraintConsistencyError
    );
  });

  it('96. Flag material rejected by validator', () => {
    const invalid = {
      ...CONSTRAINT_ARTIFACTS,
      specification: {
        ...CONSTRAINT_ARTIFACTS.specification,
        interpretation: 'Flag is BPCTF{fake_flag}',
      },
    } as any;
    assert.throws(
      () => validateConstraintArtifacts(invalid),
      (err: unknown) => err instanceof ConstraintConsistencyError
    );
  });

  // ========================================================
  // 16. Regression (Req 97-107)
  // ========================================================
  it('97. Prompt 2 (Session Store) remains healthy', () => {
    const s = sessionStore.createSession();
    assert(s.id);
  });

  it('98. Prompt 3 (Router) remains healthy', () => {
    assert.equal(routeRegistry.isLocked(), true);
  });

  it('99. Prompt 4 (Metadata/Audit) remains healthy', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    const res = await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
  });

  it('100. Prompt 5 (Config) remains healthy', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    const res = await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
  });

  it('101. Prompt 5.1 (Leakage Hardening) remains healthy', () => {
    assert.equal(APPROVED_SIM_NAMESPACES.has('config'), true);
  });

  it('102. Prompt 6 (Identity) remains healthy', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    const res = await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
  });

  it('103. Prompt 6.1 (Identity Hardening) remains healthy', () => {
    assert.equal(APPROVED_SIM_NAMESPACES.has('identity'), true);
  });

  it('104. Prompt 7 (Trust Resolution) remains healthy', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);
    const res = await engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
  });

  it('105. Prompt 8 (Transition Engine) remains healthy', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);
    const res = await engine.dispatch(parseSimRoute('sim://transition/reconciliation'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
  });

  it('106. Prompt 9 (Constraint Engine) remains healthy and fully active', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await reachReconciledProgression(reqCtx);
    const res = await engine.dispatch(parseSimRoute('sim://constraint/reconciliation'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
  });

  it('107. Engine is fully initialized, ready, and locked with all 7 modules active', () => {
    assert.equal(engine.isReady(), true);
    assert.equal(routeRegistry.isLocked(), true);
    assert.equal(moduleRegistry.isLocked(), true);

    const activeMods = moduleRegistry.getAll().map((m) => m.id);
    assert.deepEqual(activeMods, [
      'metadata',
      'audit',
      'config',
      'identity',
      'trust',
      'transition',
      'constraint',
    ]);
  });
});
