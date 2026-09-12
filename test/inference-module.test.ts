import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { validateAndBuildConfig } from '../src/config/config.js';
import { RequestContext } from '../src/context/request-context.js';
import { ChallengeEngine } from '../src/engine/challenge-engine.js';
import { ModuleRegistry } from '../src/engine/module-registry.js';
import { EvidenceResponse } from '../src/evidence/evidence-types.js';
import { AuditModule } from '../src/modules/audit/audit-module.js';
import { ConfigModule } from '../src/modules/config/config-module.js';
import { ConstraintModule } from '../src/modules/constraint/constraint-module.js';
import { IdentityModule } from '../src/modules/identity/identity-module.js';
import { INFERENCE_ARTIFACTS } from '../src/modules/inference/inference-artifacts.js';
import { InferenceModule } from '../src/modules/inference/inference-module.js';
import {
  InferenceNotEstablishedError,
  InferenceSessionState,
} from '../src/modules/inference/inference-types.js';
import {
  KNOWN_VALID_EVIDENCE_IDS,
} from '../src/modules/inference/inference-validator.js';
import { MetadataModule } from '../src/modules/metadata/metadata-module.js';
import { TransitionModule } from '../src/modules/transition/transition-module.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import { InvalidSimRouteError, SimRouteNotFoundError } from '../src/router/sim-errors.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { APPROVED_SIM_NAMESPACES, SimRoute } from '../src/router/sim-route.js';
import { StateOwnershipError, VALID_MODULE_NAMESPACES } from '../src/session/session-context.js';
import { SessionRecord, SessionStore } from '../src/session/session-store.js';

describe('Prompt 10: Multi-Domain Inference Engine & Controlled Hypothesis Resolution (Module)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;

  const canonicalRoutes = [
    'sim://inference/specification-model',
    'sim://inference/lineage-model',
    'sim://inference/boundary-model',
    'sim://inference/reconciliation-model',
    'sim://inference/convergence',
  ];

  function enableSpecPrerequisites(session: SessionRecord): void {
    session.context.setNamespaceState(
      'config',
      { discoveredEvidence: ['EVD-CFG-01-ACTIVE-SPEC'] },
      'config'
    );
    session.context.setNamespaceState(
      'trust',
      { discoveredEvidence: ['EVD-TRUST-02-BINDING'] },
      'trust'
    );
    session.context.setNamespaceState(
      'constraint',
      { discoveredEvidence: ['EVD-CONSTRAINT-01-SPECIFICATION'] },
      'constraint'
    );
  }

  function enableLineagePrerequisites(session: SessionRecord): void {
    session.context.setNamespaceState(
      'audit',
      { discoveredEvidence: ['EVD-AUD-03-FAILS'] },
      'audit'
    );
    session.context.setNamespaceState(
      'config',
      { discoveredEvidence: ['EVD-CFG-04-COMPAT'] },
      'config'
    );
    session.context.setNamespaceState(
      'identity',
      { discoveredEvidence: ['EVD-IDN-04-LINEAGE'] },
      'identity'
    );
    session.context.setNamespaceState(
      'constraint',
      { discoveredEvidence: ['EVD-CONSTRAINT-02-CONTINUITY'] },
      'constraint'
    );
  }

  function enableBoundaryPrerequisites(session: SessionRecord): void {
    session.context.setNamespaceState(
      'metadata',
      { discoveredEvidence: ['EVD-META-02-CONTEXT'] },
      'metadata'
    );
    session.context.setNamespaceState(
      'identity',
      { discoveredEvidence: ['EVD-IDN-03-TRUST-MEMBERSHIP'] },
      'identity'
    );
    session.context.setNamespaceState(
      'constraint',
      { discoveredEvidence: ['EVD-CONSTRAINT-03-BOUNDARY'] },
      'constraint'
    );
  }

  function enableReconciliationPrerequisites(session: SessionRecord): void {
    session.context.setNamespaceState(
      'transition',
      {
        currentState: 'RECONCILED',
        recordedTransitions: ['EVD-TRANS-03-RECONCILIATION'],
      },
      'transition'
    );
    session.context.setNamespaceState(
      'trust',
      { discoveredEvidence: ['EVD-TRUST-05-INTERPRETATION'] },
      'trust'
    );
    session.context.setNamespaceState(
      'constraint',
      { discoveredEvidence: ['EVD-CONSTRAINT-04-RECONCILIATION'] },
      'constraint'
    );
  }

  function enableAllPredecessorPrerequisites(session: SessionRecord): void {
    session.context.setNamespaceState(
      'metadata',
      { discoveredEvidence: ['EVD-META-02-CONTEXT'] },
      'metadata'
    );
    session.context.setNamespaceState(
      'audit',
      { discoveredEvidence: ['EVD-AUD-03-FAILS'] },
      'audit'
    );
    session.context.setNamespaceState(
      'config',
      { discoveredEvidence: ['EVD-CFG-01-ACTIVE-SPEC', 'EVD-CFG-04-COMPAT'] },
      'config'
    );
    session.context.setNamespaceState(
      'identity',
      { discoveredEvidence: ['EVD-IDN-03-TRUST-MEMBERSHIP', 'EVD-IDN-04-LINEAGE'] },
      'identity'
    );
    session.context.setNamespaceState(
      'trust',
      { discoveredEvidence: ['EVD-TRUST-02-BINDING', 'EVD-TRUST-05-INTERPRETATION'] },
      'trust'
    );
    session.context.setNamespaceState(
      'transition',
      {
        currentState: 'RECONCILED',
        recordedTransitions: ['EVD-TRANS-03-RECONCILIATION'],
      },
      'transition'
    );
    session.context.setNamespaceState(
      'constraint',
      {
        discoveredEvidence: [
          'EVD-CONSTRAINT-01-SPECIFICATION',
          'EVD-CONSTRAINT-02-CONTINUITY',
          'EVD-CONSTRAINT-03-BOUNDARY',
          'EVD-CONSTRAINT-04-RECONCILIATION',
        ],
      },
      'constraint'
    );
  }

  function enableConvergencePrerequisites(session: SessionRecord): void {
    enableAllPredecessorPrerequisites(session);
    session.context.setNamespaceState(
      'inference',
      {
        discoveredEvidence: [
          'EVD-INFER-01-SPECIFICATION',
          'EVD-INFER-02-LINEAGE',
          'EVD-INFER-03-BOUNDARY',
          'EVD-INFER-04-RECONCILIATION',
        ],
        accessCount: 4,
      },
      'inference'
    );
  }

  beforeEach(async () => {
    routeRegistry = new SimRouteRegistry();
    moduleRegistry = new ModuleRegistry();
    engine = new ChallengeEngine(moduleRegistry, { routeRegistry });
    const config = validateAndBuildConfig();
    sessionStore = new SessionStore(config);

    moduleRegistry.register(new MetadataModule(routeRegistry));
    moduleRegistry.register(new AuditModule(routeRegistry));
    moduleRegistry.register(new ConfigModule(routeRegistry));
    moduleRegistry.register(new IdentityModule(routeRegistry));
    moduleRegistry.register(new TrustModule(routeRegistry));
    moduleRegistry.register(new TransitionModule(routeRegistry));
    moduleRegistry.register(new ConstraintModule(routeRegistry));
    moduleRegistry.register(new InferenceModule(routeRegistry));

    await engine.initialize();
  });

  // =========================================================================
  // 1. Architecture & Registry Integration
  // =========================================================================
  it('1. InferenceModule registers with id inference and version 1.0.0', () => {
    const mod = moduleRegistry.get('inference');
    assert(mod);
    assert.equal(mod.id, 'inference');
    assert.equal(mod.version, '1.0.0');
  });

  it('2. Inference namespace is registered in VALID_MODULE_NAMESPACES and APPROVED_SIM_NAMESPACES', () => {
    assert(VALID_MODULE_NAMESPACES.has('inference'));
    assert(APPROVED_SIM_NAMESPACES.has('inference'));
  });

  it('3. InferenceModule declares all required predecessor dependencies', () => {
    const mod = moduleRegistry.get('inference');
    assert(mod);
    const deps = mod.requiredDependencies;
    assert(deps.includes('metadata'));
    assert(deps.includes('audit'));
    assert(deps.includes('config'));
    assert(deps.includes('identity'));
    assert(deps.includes('trust'));
    assert(deps.includes('transition'));
    assert(deps.includes('constraint'));
  });

  it('4. Route registry is locked after engine initialization', () => {
    assert.throws(
      () => {
        routeRegistry.register(
          new SimRoute('inference', ['test']),
          'READ',
          () => ({ status: 'ok', evidence: {} as any })
        );
      },
      (err: any) => err.code === 'SIM_DISPATCH_REJECTED' || /locked/i.test(err.message)
    );
  });

  // =========================================================================
  // 2. Canonical Routes & Route Security
  // =========================================================================
  it('5. Exactly five canonical inference routes are registered', () => {
    for (const route of canonicalRoutes) {
      assert(routeRegistry.hasRoute(parseSimRoute(route), 'READ'));
    }
  });

  it('6. Non-canonical routes are rejected with SimRouteNotFoundError', async () => {
    const forbidden = [
      'sim://inference/list',
      'sim://inference/index',
      'sim://inference/status',
      'sim://inference/debug',
      'sim://inference/explain',
      'sim://inference/answer',
      'sim://inference/solution',
      'sim://inference/winner',
      'sim://inference/result',
      'sim://inference/matrix',
      'sim://inference/score',
      'sim://inference/rank',
    ];

    const session = sessionStore.createSession();
    enableConvergencePrerequisites(session);
    const reqCtx = new RequestContext({ session });

    for (const route of forbidden) {
      await assert.rejects(
        async () => {
          await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
        },
        (err: any) => err instanceof SimRouteNotFoundError
      );
    }
  });

  it('7. Directory traversal in route is rejected', () => {
    assert.throws(() => parseSimRoute('sim://inference/../metadata'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://inference/%2e%2e/metadata'), InvalidSimRouteError);
  });

  it('8. Case sensitivity: uppercase routes fail', () => {
    assert.throws(() => parseSimRoute('sim://inference/CONVERGENCE'), InvalidSimRouteError);
  });

  it('9. Query strings and trailing slashes are rejected', () => {
    assert.throws(() => parseSimRoute('sim://inference/convergence?debug=true'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://inference/convergence/'), InvalidSimRouteError);
    assert.throws(() => parseSimRoute('sim://inference/convergence.json'), InvalidSimRouteError);
  });

  // =========================================================================
  // 3. Artifact Integrity & Determinism
  // =========================================================================
  it('10. Exactly five canonical inference artifacts exist', () => {
    assert.equal(Object.keys(INFERENCE_ARTIFACTS).length, 5);
  });

  it('11. All artifact IDs are unique and formatted with EVD-INFER- prefix', () => {
    const ids = new Set<string>();
    for (const artifact of Object.values(INFERENCE_ARTIFACTS)) {
      assert(artifact.artifactId.startsWith('EVD-INFER-'));
      assert(!ids.has(artifact.artifactId));
      ids.add(artifact.artifactId);
    }
    assert.equal(ids.size, 5);
  });

  it('12. All artifacts have version 1.0.0 and status ACTIVE', () => {
    for (const artifact of Object.values(INFERENCE_ARTIFACTS)) {
      assert.equal(artifact.version, '1.0.0');
      assert.equal(artifact.status, 'ACTIVE');
    }
  });

  it('13. All referenced evidence IDs exist in KNOWN_VALID_EVIDENCE_IDS universe', () => {
    for (const artifact of Object.values(INFERENCE_ARTIFACTS)) {
      for (const ref of artifact.correlatedEvidence) {
        assert(KNOWN_VALID_EVIDENCE_IDS.has(ref));
      }
    }
  });

  it('14. Artifact responses are deterministic across repeated dispatches', async () => {
    const session = sessionStore.createSession();
    enableConvergencePrerequisites(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res1 = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const res2 = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      assert.deepEqual(res1, res2);
    }
  });

  // =========================================================================
  // 4. Specification Model Gating & Content
  // =========================================================================
  it('15. Specification model requires relevant config, trust, and constraint evidence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    // Missing prerequisites throws 422
    await assert.rejects(
      async () => {
        await engine.dispatch(parseSimRoute('sim://inference/specification-model'), 'READ', reqCtx);
      },
      (err: any) => err instanceof InferenceNotEstablishedError && err.statusCode === 422
    );

    // Satisfy prerequisites
    enableSpecPrerequisites(session);
    const res = await engine.dispatch(
      parseSimRoute('sim://inference/specification-model'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
    const data = res.data as EvidenceResponse;
    assert.equal(data.evidence.id, 'EVD-INFER-01-SPECIFICATION');
  });

  it('16. Specification model correlates required evidence and does not expose correctness or ranking', async () => {
    const session = sessionStore.createSession();
    enableSpecPrerequisites(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(
      parseSimRoute('sim://inference/specification-model'),
      'READ',
      reqCtx
    );
    const serialized = JSON.stringify(res.data);

    assert(serialized.includes('EVD-CFG-01-ACTIVE-SPEC'));
    assert(serialized.includes('EVD-CONSTRAINT-01-SPECIFICATION'));
    assert(serialized.includes('EVD-TRUST-02-BINDING'));

    assert(!/this\s+is\s+correct/i.test(serialized));
    assert(!/this\s+wins/i.test(serialized));
    assert(!/score|rank|weight|priority|confidence/i.test(serialized));
  });

  // =========================================================================
  // 5. Lineage Model Gating & Content
  // =========================================================================
  it('17. Lineage model requires audit, config, identity, and constraint evidence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(parseSimRoute('sim://inference/lineage-model'), 'READ', reqCtx);
      },
      (err: any) => err instanceof InferenceNotEstablishedError && err.statusCode === 422
    );

    enableLineagePrerequisites(session);
    const res = await engine.dispatch(parseSimRoute('sim://inference/lineage-model'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
    const data = res.data as EvidenceResponse;
    assert.equal(data.evidence.id, 'EVD-INFER-02-LINEAGE');
  });

  it('18. Lineage model correlates required evidence and does not declare history wrong or obsolete', async () => {
    const session = sessionStore.createSession();
    enableLineagePrerequisites(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://inference/lineage-model'), 'READ', reqCtx);
    const serialized = JSON.stringify(res.data);

    assert(serialized.includes('EVD-AUD-03-FAILS'));
    assert(serialized.includes('EVD-CFG-04-COMPAT'));
    assert(serialized.includes('EVD-IDN-04-LINEAGE'));
    assert(serialized.includes('EVD-CONSTRAINT-02-CONTINUITY'));

    assert(!/history\s+is\s+wrong/i.test(serialized));
    assert(!/history\s+loses/i.test(serialized));
    assert(!/legacy\s+is\s+obsolete/i.test(serialized));
  });

  // =========================================================================
  // 6. Boundary Model Gating & Content
  // =========================================================================
  it('19. Boundary model requires metadata, identity, and constraint evidence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(parseSimRoute('sim://inference/boundary-model'), 'READ', reqCtx);
      },
      (err: any) => err instanceof InferenceNotEstablishedError && err.statusCode === 422
    );

    enableBoundaryPrerequisites(session);
    const res = await engine.dispatch(parseSimRoute('sim://inference/boundary-model'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
    const data = res.data as EvidenceResponse;
    assert.equal(data.evidence.id, 'EVD-INFER-03-BOUNDARY');
  });

  it('20. Boundary model contains zero Boolean oracle and does not expose equivalence shortcuts', async () => {
    const session = sessionStore.createSession();
    enableBoundaryPrerequisites(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://inference/boundary-model'), 'READ', reqCtx);
    const data = res.data as EvidenceResponse;

    // Verify zero boolean values in content
    for (const [, val] of Object.entries(data.evidence.content)) {
      assert.notEqual(typeof val, 'boolean');
    }
  });

  // =========================================================================
  // 7. Reconciliation Model Gating & Content
  // =========================================================================
  it('21. Reconciliation model requires transition RECONCILED state, trust, and constraint evidence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://inference/reconciliation-model'),
          'READ',
          reqCtx
        );
      },
      (err: any) => err instanceof InferenceNotEstablishedError && err.statusCode === 422
    );

    enableReconciliationPrerequisites(session);
    const res = await engine.dispatch(
      parseSimRoute('sim://inference/reconciliation-model'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
    const data = res.data as EvidenceResponse;
    assert.equal(data.evidence.id, 'EVD-INFER-04-RECONCILIATION');
  });

  it('22. Reconciliation model contains no precedence hierarchy or resolution order', async () => {
    const session = sessionStore.createSession();
    enableReconciliationPrerequisites(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(
      parseSimRoute('sim://inference/reconciliation-model'),
      'READ',
      reqCtx
    );
    const serialized = JSON.stringify(res.data);

    assert(!/precedence_hierarchy|resolution_order|precedence_rank/i.test(serialized));
    assert(!/winner|priority|score/i.test(serialized));
  });

  // =========================================================================
  // 8. Convergence Model Gating & Content
  // =========================================================================
  it('23. Convergence model cannot be accessed prematurely without all 4 prior models discovered', async () => {
    const session = sessionStore.createSession();
    enableAllPredecessorPrerequisites(session);

    // Only discover 3 of 4 models
    session.context.setNamespaceState(
      'inference',
      {
        discoveredEvidence: [
          'EVD-INFER-01-SPECIFICATION',
          'EVD-INFER-02-LINEAGE',
          'EVD-INFER-03-BOUNDARY',
        ],
        accessCount: 3,
      },
      'inference'
    );
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(parseSimRoute('sim://inference/convergence'), 'READ', reqCtx);
      },
      (err: any) => err instanceof InferenceNotEstablishedError && err.statusCode === 422
    );
  });

  it('24. Convergence model succeeds when all 4 prior inference models have been discovered', async () => {
    const session = sessionStore.createSession();
    enableConvergencePrerequisites(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://inference/convergence'), 'READ', reqCtx);
    assert.equal(res.status, 'success');
    const data = res.data as EvidenceResponse;
    assert.equal(data.evidence.id, 'EVD-INFER-05-CONVERGENCE');
  });

  it('25. Convergence model does not expose a winner or winning hypothesis', async () => {
    const session = sessionStore.createSession();
    enableConvergencePrerequisites(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://inference/convergence'), 'READ', reqCtx);
    const serialized = JSON.stringify(res.data);

    assert(!/winner|winning_hypothesis|best_hypothesis|correct_hypothesis/i.test(serialized));
    assert(!/score|rank|weight|priority|confidence/i.test(serialized));
  });

  // =========================================================================
  // 9. Session Security & Namespace Isolation
  // =========================================================================
  it('26. Inference session state is updated under inference namespace upon successful access', async () => {
    const session = sessionStore.createSession();
    enableSpecPrerequisites(session);
    const reqCtx = new RequestContext({ session });

    await engine.dispatch(parseSimRoute('sim://inference/specification-model'), 'READ', reqCtx);

    const state = session.context.getNamespaceState<InferenceSessionState>('inference');
    assert(state);
    assert.equal(state.accessCount, 1);
    assert.deepEqual(state.discoveredEvidence, ['EVD-INFER-01-SPECIFICATION']);
    assert.equal(state.lastAccessedInference, 'EVD-INFER-01-SPECIFICATION');
  });

  it('27. Cross-namespace mutation from unauthorized module throws StateOwnershipError', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => {
        // Attempt to mutate inference namespace from metadata module
        session.context.setNamespaceState('inference', { accessCount: 99 }, 'metadata' as any);
      },
      (err: any) => err instanceof StateOwnershipError
    );
  });

  it('28. Session isolation: Session A discoveries do not grant access to Session B', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();
    enableConvergencePrerequisites(sessionA);

    const reqCtxA = new RequestContext({ session: sessionA });
    const reqCtxB = new RequestContext({ session: sessionB });

    const resA = await engine.dispatch(parseSimRoute('sim://inference/convergence'), 'READ', reqCtxA);
    assert.equal(resA.status, 'success');

    await assert.rejects(
      async () => {
        await engine.dispatch(parseSimRoute('sim://inference/convergence'), 'READ', reqCtxB);
      },
      (err: any) => err instanceof InferenceNotEstablishedError
    );
  });

  // =========================================================================
  // 10. Deep Immutability & Defensive Freezing
  // =========================================================================
  it('29. Mutating returned response does not alter subsequent responses', async () => {
    const session = sessionStore.createSession();
    enableSpecPrerequisites(session);
    const reqCtx = new RequestContext({ session });

    const res1 = await engine.dispatch(
      parseSimRoute('sim://inference/specification-model'),
      'READ',
      reqCtx
    );
    const data1 = res1.data as EvidenceResponse;

    // Verify response is frozen
    assert(Object.isFrozen(data1));
    assert(Object.isFrozen(data1.evidence));
    assert(Object.isFrozen(data1.evidence.content));

    const res2 = await engine.dispatch(
      parseSimRoute('sim://inference/specification-model'),
      'READ',
      reqCtx
    );
    assert.deepEqual(res1, res2);
  });
});
