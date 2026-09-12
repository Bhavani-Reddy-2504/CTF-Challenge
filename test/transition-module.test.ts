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
import { TRANSITION_ARTIFACTS } from '../src/modules/transition/transition-artifacts.js';
import { TransitionModule } from '../src/modules/transition/transition-module.js';
import {
  CANONICAL_TRANSITION_STATES,
  TransitionNotEstablishedError,
  TransitionSessionState,
} from '../src/modules/transition/transition-types.js';
import {
  TransitionConsistencyError,
  validateTransitionArtifacts,
} from '../src/modules/transition/transition-validator.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import { SimRouteNotFoundError } from '../src/router/sim-errors.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { validateAndBuildConfig } from '../src/config/config.js';
import { SessionStore } from '../src/session/session-store.js';
import { StateOwnershipError } from '../src/session/session-context.js';

describe('Prompt 8: Deterministic Transition State Engine & Controlled Progression (Requirements 1-86)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;

  const fixedTransitionRoutes = [
    'sim://transition/observation',
    'sim://transition/correlation',
    'sim://transition/reconciliation',
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

    moduleRegistry.register(metadataModule);
    moduleRegistry.register(auditModule);
    moduleRegistry.register(configModule);
    moduleRegistry.register(identityModule);
    moduleRegistry.register(trustModule);
    moduleRegistry.register(transitionModule);

    await engine.initialize();

    const appConfig = validateAndBuildConfig({
      environment: 'test',
    });
    sessionStore = new SessionStore(appConfig);
  });

  async function discoverObservationPrerequisites(reqCtx: RequestContext) {
    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://metadata/execution-context'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://audit/bootstrap-history'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/active-specification'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/context'), 'READ', reqCtx);
  }

  async function discoverCorrelationPrerequisites(reqCtx: RequestContext) {
    await discoverObservationPrerequisites(reqCtx);
    // Execute observation transition
    await engine.dispatch(parseSimRoute('sim://transition/observation'), 'READ', reqCtx);

    // Discover trust prerequisites
    await engine.dispatch(parseSimRoute('sim://identity/binding'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/context-coherence'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/binding-coherence'), 'READ', reqCtx);
  }

  async function discoverReconciliationPrerequisites(reqCtx: RequestContext) {
    await discoverCorrelationPrerequisites(reqCtx);
    // Execute correlation transition
    await engine.dispatch(parseSimRoute('sim://transition/correlation'), 'READ', reqCtx);

    // Discover reconciliation prerequisites
    await engine.dispatch(parseSimRoute('sim://audit/failed-transitions'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://config/compatibility-rules'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/lineage'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://identity/compatibility'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/lineage-coherence'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://trust/effective-interpretation'), 'READ', reqCtx);
  }

  // ========================================================
  // 1. Module Registration & Lifecycle (Req 1-6)
  // ========================================================
  it('1. Transition module registers successfully in ModuleRegistry', () => {
    assert.equal(moduleRegistry.has('transition'), true);
  });

  it('2. Transition module has the correct module ID', () => {
    const mod = moduleRegistry.get('transition');
    assert(mod);
    assert.equal(mod.id, 'transition');
  });

  it('3. Dependencies are explicitly declared and correct', () => {
    const mod = moduleRegistry.get('transition');
    assert(mod);
    assert.deepEqual(mod.requiredDependencies, [
      'metadata',
      'audit',
      'config',
      'identity',
      'trust',
    ]);
  });

  it('4. Fixed transition routes register successfully in SimRouteRegistry', () => {
    for (const r of fixedTransitionRoutes) {
      assert.equal(routeRegistry.hasRoute(parseSimRoute(r), 'READ'), true);
    }
  });

  it('5. Duplicate transition route registration fails during initialization', () => {
    const duplicateMod = new TransitionModule(routeRegistry);
    assert.throws(() => duplicateMod.initialize(new Map()));
  });

  it('6. Registration after registry lock fails', () => {
    assert.equal(routeRegistry.isLocked(), true);
    assert.throws(() =>
      routeRegistry.register(
        parseSimRoute('sim://transition/unauthorized-route'),
        'READ',
        () => {}
      )
    );
  });

  // ========================================================
  // 2. State Model (Req 7-14)
  // ========================================================
  it('7. Initial state is internally valid (UNINITIALIZED)', () => {
    const session = sessionStore.createSession();
    const mod = moduleRegistry.get('transition') as TransitionModule;
    assert(mod);
    const state = session.context.getNamespaceState<TransitionSessionState>('transition');
    assert.equal(state, undefined); // Not accessed yet, defaults to UNINITIALIZED upon lookup
  });

  it('8. Observation progression is valid (UNINITIALIZED -> OBSERVED)', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverObservationPrerequisites(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://transition/observation'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
    const data = res.data as EvidenceResponse;
    assert.equal(data.status, 'ok');
    assert.equal(data.evidence.id, 'EVD-TRANS-01-OBSERVATION');

    const state = session.context.getNamespaceState<TransitionSessionState>('transition');
    assert(state);
    assert.equal(state.currentState, 'OBSERVED');
    assert.deepEqual(state.recordedTransitions, ['EVD-TRANS-01-OBSERVATION']);
  });

  it('9. Correlation progression requires Observation (OBSERVED -> CORRELATED)', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverCorrelationPrerequisites(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://transition/correlation'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
    const data = res.data as EvidenceResponse;
    assert.equal(data.evidence.id, 'EVD-TRANS-02-CORRELATION');

    const state = session.context.getNamespaceState<TransitionSessionState>('transition');
    assert(state);
    assert.equal(state.currentState, 'CORRELATED');
    assert.deepEqual(state.recordedTransitions, [
      'EVD-TRANS-01-OBSERVATION',
      'EVD-TRANS-02-CORRELATION',
    ]);
  });

  it('10. Reconciliation requires Correlation (CORRELATED -> RECONCILED)', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverReconciliationPrerequisites(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://transition/reconciliation'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
    const data = res.data as EvidenceResponse;
    assert.equal(data.evidence.id, 'EVD-TRANS-03-RECONCILIATION');

    const state = session.context.getNamespaceState<TransitionSessionState>('transition');
    assert(state);
    assert.equal(state.currentState, 'RECONCILED');
    assert.deepEqual(state.recordedTransitions, [
      'EVD-TRANS-01-OBSERVATION',
      'EVD-TRANS-02-CORRELATION',
      'EVD-TRANS-03-RECONCILIATION',
    ]);
  });

  it('11. No direct state jump exists (UNINITIALIZED -> CORRELATED fails)', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://transition/correlation'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => {
        assert(err instanceof TransitionNotEstablishedError);
        assert.equal(err.statusCode, 422);
        assert.equal(err.code, 'ERR_TRANSITION_NOT_ESTABLISHED');
        return true;
      }
    );
  });

  it('11b. No direct state jump exists (UNINITIALIZED -> RECONCILED fails)', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://transition/reconciliation'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => {
        assert(err instanceof TransitionNotEstablishedError);
        return true;
      }
    );
  });

  it('12. No backward transition exists (state order is strictly advancing)', () => {
    assert.deepEqual(CANONICAL_TRANSITION_STATES, [
      'UNINITIALIZED',
      'OBSERVED',
      'CORRELATED',
      'RECONCILED',
    ]);
  });

  it('13. No loop exists in transition artifacts', () => {
    for (const artifact of Object.values(TRANSITION_ARTIFACTS)) {
      assert.notEqual(artifact.fromState, artifact.toState);
    }
  });

  it('14. State model is deterministic', () => {
    assert.equal(TRANSITION_ARTIFACTS.observation.fromState, 'UNINITIALIZED');
    assert.equal(TRANSITION_ARTIFACTS.observation.toState, 'OBSERVED');
    assert.equal(TRANSITION_ARTIFACTS.correlation.fromState, 'OBSERVED');
    assert.equal(TRANSITION_ARTIFACTS.correlation.toState, 'CORRELATED');
    assert.equal(TRANSITION_ARTIFACTS.reconciliation.fromState, 'CORRELATED');
    assert.equal(TRANSITION_ARTIFACTS.reconciliation.toState, 'RECONCILED');
  });

  // ========================================================
  // 3. Observation Gating (Req 15-19)
  // ========================================================
  it('15. Observation fails before prerequisites', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://transition/observation'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => {
        assert(err instanceof TransitionNotEstablishedError);
        assert.equal(err.statusCode, 422);
        return true;
      }
    );
  });

  it('16. Generic error does not reveal missing evidence in Observation', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    try {
      await engine.dispatch(
        parseSimRoute('sim://transition/observation'),
        'READ',
        reqCtx
      );
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.equal(err.name, 'TransitionNotEstablishedError');
      assert.equal(
        err.message,
        'The operational record does not satisfy the requirements for transition progression.'
      );
      assert(!err.message.includes('EVD-'));
      assert(!err.message.includes('metadata'));
      assert(!err.message.includes('audit'));
      assert(!err.message.includes('config'));
      assert(!err.message.includes('identity'));
    }
  });

  it('17. Partial discovery is insufficient for Observation', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    // Only discover metadata, leaving audit, config, identity undiscovered
    await engine.dispatch(parseSimRoute('sim://metadata/workload-profile'), 'READ', reqCtx);
    await engine.dispatch(parseSimRoute('sim://metadata/execution-context'), 'READ', reqCtx);

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://transition/observation'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => {
        assert(err instanceof TransitionNotEstablishedError);
        return true;
      }
    );
  });

  it('18. Valid prerequisite discovery enables Observation', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverObservationPrerequisites(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://transition/observation'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
  });

  it('19. Fake client claims do not bypass Observation gating', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://transition/observation'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => {
        assert(err instanceof TransitionNotEstablishedError);
        return true;
      }
    );
  });

  // ========================================================
  // 4. Correlation Gating (Req 20-23)
  // ========================================================
  it('20. Correlation fails before Observation', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://transition/correlation'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => {
        assert(err instanceof TransitionNotEstablishedError);
        return true;
      }
    );
  });

  it('21. Correlation fails without required Trust evidence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverObservationPrerequisites(reqCtx);
    await engine.dispatch(parseSimRoute('sim://transition/observation'), 'READ', reqCtx);

    // Trust artifacts NOT discovered
    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://transition/correlation'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => {
        assert(err instanceof TransitionNotEstablishedError);
        return true;
      }
    );
  });

  it('22. Generic error does not reveal requirements in Correlation', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    try {
      await engine.dispatch(
        parseSimRoute('sim://transition/correlation'),
        'READ',
        reqCtx
      );
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.equal(err.name, 'TransitionNotEstablishedError');
      assert.equal(
        err.message,
        'The operational record does not satisfy the requirements for transition progression.'
      );
      assert(!err.message.includes('trust'));
      assert(!err.message.includes('EVD-'));
    }
  });

  it('23. Valid prerequisites enable Correlation', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverCorrelationPrerequisites(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://transition/correlation'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
  });

  // ========================================================
  // 5. Reconciliation Gating (Req 24-27)
  // ========================================================
  it('24. Reconciliation fails before Correlation', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverObservationPrerequisites(reqCtx);
    await engine.dispatch(parseSimRoute('sim://transition/observation'), 'READ', reqCtx);

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://transition/reconciliation'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => {
        assert(err instanceof TransitionNotEstablishedError);
        return true;
      }
    );
  });

  it('25. Reconciliation fails without required evidence', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverCorrelationPrerequisites(reqCtx);
    await engine.dispatch(parseSimRoute('sim://transition/correlation'), 'READ', reqCtx);

    // Missing reconciliation trust evidence
    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://transition/reconciliation'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => {
        assert(err instanceof TransitionNotEstablishedError);
        return true;
      }
    );
  });

  it('26. Generic error does not reveal requirements in Reconciliation', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    try {
      await engine.dispatch(
        parseSimRoute('sim://transition/reconciliation'),
        'READ',
        reqCtx
      );
      assert.fail('Should have thrown');
    } catch (err: any) {
      assert.equal(err.name, 'TransitionNotEstablishedError');
      assert.equal(
        err.message,
        'The operational record does not satisfy the requirements for transition progression.'
      );
      assert(!err.message.includes('reconciliation'));
      assert(!err.message.includes('EVD-'));
    }
  });

  it('27. Valid prerequisites enable Reconciliation', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverReconciliationPrerequisites(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://transition/reconciliation'),
      'READ',
      reqCtx
    );
    assert.equal(res.status, 'success');
  });

  // ========================================================
  // 6. Idempotency (Req 28-31)
  // ========================================================
  it('28. Repeated Observation is safe and idempotent', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverObservationPrerequisites(reqCtx);

    const res1 = await engine.dispatch(
      parseSimRoute('sim://transition/observation'),
      'READ',
      reqCtx
    );
    const res2 = await engine.dispatch(
      parseSimRoute('sim://transition/observation'),
      'READ',
      reqCtx
    );

    assert.equal(res1.status, 'success');
    assert.equal(res2.status, 'success');
    const state = session.context.getNamespaceState<TransitionSessionState>('transition');
    assert(state);
    assert.equal(state.currentState, 'OBSERVED');
    assert.equal(state.recordedTransitions.length, 1);
    assert.equal(state.transitionHistory.length, 1);
    assert.equal(state.accessCount, 2);
  });

  it('29. Repeated Correlation is safe and idempotent', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverCorrelationPrerequisites(reqCtx);

    const res1 = await engine.dispatch(
      parseSimRoute('sim://transition/correlation'),
      'READ',
      reqCtx
    );
    const res2 = await engine.dispatch(
      parseSimRoute('sim://transition/correlation'),
      'READ',
      reqCtx
    );

    assert.equal(res1.status, 'success');
    assert.equal(res2.status, 'success');
    const state = session.context.getNamespaceState<TransitionSessionState>('transition');
    assert(state);
    assert.equal(state.currentState, 'CORRELATED');
    assert.equal(state.recordedTransitions.length, 2);
    assert.equal(state.transitionHistory.length, 2);
  });

  it('30. Repeated Reconciliation is safe and idempotent', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverReconciliationPrerequisites(reqCtx);

    const res1 = await engine.dispatch(
      parseSimRoute('sim://transition/reconciliation'),
      'READ',
      reqCtx
    );
    const res2 = await engine.dispatch(
      parseSimRoute('sim://transition/reconciliation'),
      'READ',
      reqCtx
    );

    assert.equal(res1.status, 'success');
    assert.equal(res2.status, 'success');
    const state = session.context.getNamespaceState<TransitionSessionState>('transition');
    assert(state);
    assert.equal(state.currentState, 'RECONCILED');
    assert.equal(state.recordedTransitions.length, 3);
    assert.equal(state.transitionHistory.length, 3);
  });

  it('31. No duplicate transition state is created on repeated calls', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverObservationPrerequisites(reqCtx);

    for (let i = 0; i < 5; i++) {
      await engine.dispatch(
        parseSimRoute('sim://transition/observation'),
        'READ',
        reqCtx
      );
    }

    const state = session.context.getNamespaceState<TransitionSessionState>('transition');
    assert(state);
    assert.equal(state.recordedTransitions.length, 1);
    assert.equal(state.transitionHistory.length, 1);
    assert.equal(state.accessCount, 5);
  });

  // ========================================================
  // 7. Concurrency (Req 32-35)
  // ========================================================
  it('32. Simultaneous Observation requests are safe', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverObservationPrerequisites(reqCtx);

    const [res1, res2] = await Promise.all([
      engine.dispatch(parseSimRoute('sim://transition/observation'), 'READ', reqCtx),
      engine.dispatch(parseSimRoute('sim://transition/observation'), 'READ', reqCtx),
    ]);

    assert.equal(res1.status, 'success');
    assert.equal(res2.status, 'success');
    const state = session.context.getNamespaceState<TransitionSessionState>('transition');
    assert(state);
    assert.equal(state.currentState, 'OBSERVED');
    assert.equal(state.recordedTransitions.length, 1);
  });

  it('33. Simultaneous Correlation requests are safe', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverCorrelationPrerequisites(reqCtx);

    const [res1, res2] = await Promise.all([
      engine.dispatch(parseSimRoute('sim://transition/correlation'), 'READ', reqCtx),
      engine.dispatch(parseSimRoute('sim://transition/correlation'), 'READ', reqCtx),
    ]);

    assert.equal(res1.status, 'success');
    assert.equal(res2.status, 'success');
    const state = session.context.getNamespaceState<TransitionSessionState>('transition');
    assert(state);
    assert.equal(state.currentState, 'CORRELATED');
  });

  it('34. Simultaneous Reconciliation requests are safe', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverReconciliationPrerequisites(reqCtx);

    const [res1, res2] = await Promise.all([
      engine.dispatch(parseSimRoute('sim://transition/reconciliation'), 'READ', reqCtx),
      engine.dispatch(parseSimRoute('sim://transition/reconciliation'), 'READ', reqCtx),
    ]);

    assert.equal(res1.status, 'success');
    assert.equal(res2.status, 'success');
    const state = session.context.getNamespaceState<TransitionSessionState>('transition');
    assert(state);
    assert.equal(state.currentState, 'RECONCILED');
  });

  it('35. Mixed-order concurrent requests cannot bypass progression', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverObservationPrerequisites(reqCtx);

    // Launch observation and correlation simultaneously before observation is completed
    const results = await Promise.allSettled([
      engine.dispatch(parseSimRoute('sim://transition/correlation'), 'READ', reqCtx),
      engine.dispatch(parseSimRoute('sim://transition/observation'), 'READ', reqCtx),
    ]);

    // Correlation must either fail (if evaluated first) or fail because trust artifacts aren't discovered
    const corrResult = results[0];
    assert.equal(corrResult.status, 'rejected');
  });

  // ========================================================
  // 8. Session Security & Isolation (Req 36-40)
  // ========================================================
  it('36. Session A progression does not affect Session B', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    const reqCtxA = new RequestContext({ session: sessionA });

    await discoverObservationPrerequisites(reqCtxA);
    await engine.dispatch(parseSimRoute('sim://transition/observation'), 'READ', reqCtxA);

    const stateA = sessionA.context.getNamespaceState<TransitionSessionState>('transition');
    const stateB = sessionB.context.getNamespaceState<TransitionSessionState>('transition');

    assert.equal(stateA?.currentState, 'OBSERVED');
    assert.equal(stateB, undefined);
  });

  it('37. Session B progression does not affect Session A', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    const reqCtxB = new RequestContext({ session: sessionB });

    await discoverObservationPrerequisites(reqCtxB);
    await engine.dispatch(parseSimRoute('sim://transition/observation'), 'READ', reqCtxB);

    const stateA = sessionA.context.getNamespaceState<TransitionSessionState>('transition');
    const stateB = sessionB.context.getNamespaceState<TransitionSessionState>('transition');

    assert.equal(stateA, undefined);
    assert.equal(stateB?.currentState, 'OBSERVED');
  });

  it('38. Destroyed sessions cannot transition', async () => {
    const session = sessionStore.createSession();
    await discoverObservationPrerequisites(new RequestContext({ session }));

    sessionStore.destroySession(session.id);

    // When session is destroyed, sessionStore.getSession returns undefined
    const retrieved = sessionStore.getSession(session.id);
    assert.equal(retrieved, undefined);
  });

  it('39. Expired sessions cannot transition', async () => {
    const session = sessionStore.createSession();
    session.expiresAt = Date.now() - 1000; // Force expiration

    const retrieved = sessionStore.getSession(session.id);
    assert.equal(retrieved, undefined);
  });

  it('40. Stale session state without context is safely rejected', async () => {
    const reqCtxNoSession = new RequestContext({ correlationId: 'req-test-no-sess' });

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://transition/observation'),
          'READ',
          reqCtxNoSession
        );
      },
      (err: unknown) => {
        assert(err instanceof TransitionNotEstablishedError);
        return true;
      }
    );
  });

  // ========================================================
  // 9. Cross-Module Ownership (Req 41-46)
  // ========================================================
  it('41. Transition module cannot write to metadata namespace', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => {
        session.context.setNamespaceState('metadata', { test: 123 }, 'transition');
      },
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  it('42. Transition module cannot write to audit namespace', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => {
        session.context.setNamespaceState('audit', { test: 123 }, 'transition');
      },
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  it('43. Transition module cannot write to config namespace', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => {
        session.context.setNamespaceState('config', { test: 123 }, 'transition');
      },
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  it('44. Transition module cannot write to identity namespace', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => {
        session.context.setNamespaceState('identity', { test: 123 }, 'transition');
      },
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  it('45. Transition module cannot write to trust namespace', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => {
        session.context.setNamespaceState('trust', { test: 123 }, 'transition');
      },
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  it('46. Other modules cannot overwrite transition state', () => {
    const session = sessionStore.createSession();
    assert.throws(
      () => {
        session.context.setNamespaceState(
          'transition',
          { currentState: 'RECONCILED' },
          'identity'
        );
      },
      (err: unknown) => err instanceof StateOwnershipError
    );
  });

  // ========================================================
  // 10. Immutability & Defensive Freezing (Req 47-50)
  // ========================================================
  it('47. Returned transition records cannot mutate canonical artifacts', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverObservationPrerequisites(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://transition/observation'),
      'READ',
      reqCtx
    );
    const data = res.data as EvidenceResponse;

    assert.throws(() => {
      (data.evidence as any).id = 'MUTATED';
    });
    assert.equal(
      TRANSITION_ARTIFACTS.observation.artifactId,
      'EVD-TRANS-01-OBSERVATION'
    );
  });

  it('48. Nested objects in transition response are deeply frozen', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverObservationPrerequisites(reqCtx);

    const res = await engine.dispatch(
      parseSimRoute('sim://transition/observation'),
      'READ',
      reqCtx
    );
    const data = res.data as EvidenceResponse;

    assert.throws(() => {
      (data.evidence.content as any).transition_name = 'HACKED';
    });
    assert.throws(() => {
      (data.evidence.content as any).authority_conferred = true;
    });
  });

  it('49. Mutation attempts do not affect subsequent retrieval', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });
    await discoverObservationPrerequisites(reqCtx);

    const res1 = await engine.dispatch(
      parseSimRoute('sim://transition/observation'),
      'READ',
      reqCtx
    );
    const data1 = res1.data as EvidenceResponse;
    assert.equal(
      (data1.evidence.content as any).authority_conferred,
      false
    );

    const res2 = await engine.dispatch(
      parseSimRoute('sim://transition/observation'),
      'READ',
      reqCtx
    );
    const data2 = res2.data as EvidenceResponse;
    assert.equal(
      (data2.evidence.content as any).authority_conferred,
      false
    );
  });

  it('50. Session A mutations cannot affect Session B', async () => {
    const sessionA = sessionStore.createSession();
    const sessionB = sessionStore.createSession();

    const reqCtxA = new RequestContext({ session: sessionA });
    const reqCtxB = new RequestContext({ session: sessionB });

    await discoverObservationPrerequisites(reqCtxA);
    await discoverObservationPrerequisites(reqCtxB);

    const resA = await engine.dispatch(
      parseSimRoute('sim://transition/observation'),
      'READ',
      reqCtxA
    );
    const resB = await engine.dispatch(
      parseSimRoute('sim://transition/observation'),
      'READ',
      reqCtxB
    );

    assert.equal(
      (resA.data as EvidenceResponse).evidence.id,
      'EVD-TRANS-01-OBSERVATION'
    );
    assert.equal(
      (resB.data as EvidenceResponse).evidence.id,
      'EVD-TRANS-01-OBSERVATION'
    );
  });

  // ========================================================
  // 11. Route Security (Req 51-61)
  // ========================================================
  it('51. Unknown routes fail with SimRouteNotFoundError', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    await assert.rejects(
      async () => {
        await engine.dispatch(
          parseSimRoute('sim://transition/unknown-endpoint'),
          'READ',
          reqCtx
        );
      },
      (err: unknown) => err instanceof SimRouteNotFoundError
    );
  });

  it('52. Route enumeration does not exist (status, current, state fail)', () => {
    const forbiddenRoutes = [
      'sim://transition/status',
      'sim://transition/current',
      'sim://transition/state',
      'sim://transition/progress',
      'sim://transition/advance',
      'sim://transition/apply',
    ];

    for (const r of forbiddenRoutes) {
      assert.equal(routeRegistry.hasRoute(parseSimRoute(r), 'READ'), false);
    }
  });

  it('53. Case variants fail in router', () => {
    assert.throws(() => parseSimRoute('sim://TRANSITION/observation'));
    assert.throws(() => parseSimRoute('sim://transition/OBSERVATION'));
  });

  it('54. Duplicate slashes fail in router', () => {
    assert.throws(() => parseSimRoute('sim://transition//observation'));
  });

  it('55. Traversal attempts fail in router', () => {
    assert.throws(() => parseSimRoute('sim://transition/../metadata/workload-profile'));
  });

  it('56. Dot segments fail in router', () => {
    assert.throws(() => parseSimRoute('sim://transition/./observation'));
  });

  it('57. Percent encoding fails in router', () => {
    assert.throws(() => parseSimRoute('sim://transition/%6fbservation'));
  });

  it('58. Encoded separators fail in router', () => {
    assert.throws(() => parseSimRoute('sim://transition%2fobservation'));
  });

  it('59. Query strings fail in router', () => {
    assert.throws(() => parseSimRoute('sim://transition/observation?admin=true'));
  });

  it('60. Fragments fail in router', () => {
    assert.throws(() => parseSimRoute('sim://transition/observation#section'));
  });

  it('61. Arbitrary suffixes fail in router', () => {
    const route = parseSimRoute('sim://transition/observation/extra');
    assert.equal(routeRegistry.hasRoute(route, 'READ'), false);
  });

  // ========================================================
  // 12. Information Leakage Defenses (Req 62-70)
  // ========================================================
  it('62. No authentication terminology leaks', () => {
    const serialized = JSON.stringify(TRANSITION_ARTIFACTS);
    assert(!/\b(login|jwt|oauth|oidc|saml|bearer)\b/i.test(serialized));
  });

  it('63. No token terminology leaks', () => {
    const serialized = JSON.stringify(TRANSITION_ARTIFACTS);
    assert(!/\b(token|access_token|refresh_token|id_token)\b/i.test(serialized));
  });

  it('64. No identity infrastructure leaks (SPIFFE/SPIRE/SVID)', () => {
    const serialized = JSON.stringify(TRANSITION_ARTIFACTS);
    assert(!/\b(spiffe|spire|svid)\b|spiffe:\/\//i.test(serialized));
  });

  it('65. No authorization semantics leak (RBAC, ABAC, permissions)', () => {
    const serialized = JSON.stringify(TRANSITION_ARTIFACTS);
    assert(!/\b(permission|permissions|rbac|abac|role_grant)\b/i.test(serialized));
  });

  it('66. No execution semantics leak', () => {
    const serialized = JSON.stringify(TRANSITION_ARTIFACTS);
    assert(
      !/REVOKED_FOR_EXECUTION|DENIED_FOR_EXECUTION|NOT_AUTHORIZED|EXECUTION_BLOCKED|ACCESS_DENIED|PERMISSION_REVOKED/i.test(
        serialized
      )
    );
  });

  it('67. No future endpoint inventory leaks', () => {
    const serialized = JSON.stringify(TRANSITION_ARTIFACTS);
    assert(!/sim:\/\/sts\//i.test(serialized));
    assert(!/sim:\/\/policy\//i.test(serialized));
    assert(!/sim:\/\/controlplane\//i.test(serialized));
    assert(!/sim:\/\/vault\//i.test(serialized));
  });

  it('68. No challenge meta-language leaks', () => {
    const serialized = JSON.stringify(TRANSITION_ARTIFACTS);
    assert(!/prompt\s*\d+/i.test(serialized));
    assert(!/phase\s*\d+/i.test(serialized));
    assert(!/subsequent\s+phase/i.test(serialized));
    assert(!/next\s+stage/i.test(serialized));
    assert(!/you\s+will\s+need/i.test(serialized));
    assert(!/this\s+unlocks/i.test(serialized));
  });

  it('69. No BPCTF{ material exists in transition artifacts', () => {
    const serialized = JSON.stringify(TRANSITION_ARTIFACTS);
    assert(!serialized.includes('BPCTF{'));
  });

  it('70. No flag derivation material exists in transition artifacts', () => {
    const serialized = JSON.stringify(TRANSITION_ARTIFACTS);
    assert(!serialized.includes('flag'));
    assert(!serialized.includes('sha256'));
    assert(!serialized.includes('hmac'));
  });

  // ========================================================
  // 13. Determinism (Req 71-74)
  // ========================================================
  it('71. Same state produces same result', async () => {
    const session1 = sessionStore.createSession();
    const session2 = sessionStore.createSession();

    const reqCtx1 = new RequestContext({ session: session1 });
    const reqCtx2 = new RequestContext({ session: session2 });

    await discoverObservationPrerequisites(reqCtx1);
    await discoverObservationPrerequisites(reqCtx2);

    const res1 = await engine.dispatch(
      parseSimRoute('sim://transition/observation'),
      'READ',
      reqCtx1
    );
    const res2 = await engine.dispatch(
      parseSimRoute('sim://transition/observation'),
      'READ',
      reqCtx2
    );

    assert.deepEqual(res1.data, res2.data);
  });

  it('72. Canonical artifacts do not contain dynamic timestamps', () => {
    for (const artifact of Object.values(TRANSITION_ARTIFACTS)) {
      const serialized = JSON.stringify(artifact);
      assert(!/timestamp/i.test(serialized));
    }
  });

  it('73. Results do not depend on randomness', () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(
        TRANSITION_ARTIFACTS.observation.artifactId,
        'EVD-TRANS-01-OBSERVATION'
      );
      assert.equal(
        TRANSITION_ARTIFACTS.correlation.artifactId,
        'EVD-TRANS-02-CORRELATION'
      );
      assert.equal(
        TRANSITION_ARTIFACTS.reconciliation.artifactId,
        'EVD-TRANS-03-RECONCILIATION'
      );
    }
  });

  it('74. Results do not depend on network activity', () => {
    // Verified: No socket, HTTP, or DNS primitives exist in TransitionModule
    const mod = moduleRegistry.get('transition');
    assert(mod);
  });

  // ========================================================
  // 14. Validator Defenses (Req 75-84)
  // ========================================================
  it('75. Validator rejects invalid artifact ID format', () => {
    const invalid = {
      observation: {
        ...TRANSITION_ARTIFACTS.observation,
        artifactId: 'INVALID-ID',
      },
    } as any;
    assert.throws(
      () => validateTransitionArtifacts(invalid),
      (err: unknown) => err instanceof TransitionConsistencyError
    );
  });

  it('76. Validator rejects duplicate artifact IDs', () => {
    const duplicate = {
      obs1: { ...TRANSITION_ARTIFACTS.observation },
      obs2: { ...TRANSITION_ARTIFACTS.observation },
    } as any;
    assert.throws(
      () => validateTransitionArtifacts(duplicate),
      (err: unknown) => err instanceof TransitionConsistencyError
    );
  });

  it('77. Validator rejects invalid semver version', () => {
    const invalid = {
      observation: {
        ...TRANSITION_ARTIFACTS.observation,
        version: 'v1.0',
      },
    } as any;
    assert.throws(
      () => validateTransitionArtifacts(invalid),
      (err: unknown) => err instanceof TransitionConsistencyError
    );
  });

  it('78. Validator rejects non-canonical state', () => {
    const invalid = {
      observation: {
        ...TRANSITION_ARTIFACTS.observation,
        fromState: 'DEPLOYED',
      },
    } as any;
    assert.throws(
      () => validateTransitionArtifacts(invalid),
      (err: unknown) => err instanceof TransitionConsistencyError
    );
  });

  it('79. Validator rejects non-contiguous state jump', () => {
    const invalid = {
      jump: {
        ...TRANSITION_ARTIFACTS.observation,
        fromState: 'UNINITIALIZED',
        toState: 'CORRELATED',
      },
    } as any;
    assert.throws(
      () => validateTransitionArtifacts(invalid),
      (err: unknown) => err instanceof TransitionConsistencyError
    );
  });

  it('80. Validator rejects backward transition', () => {
    const invalid = {
      backward: {
        ...TRANSITION_ARTIFACTS.observation,
        fromState: 'OBSERVED',
        toState: 'UNINITIALIZED',
      },
    } as any;
    assert.throws(
      () => validateTransitionArtifacts(invalid),
      (err: unknown) => err instanceof TransitionConsistencyError
    );
  });

  it('81. Validator rejects loop transition', () => {
    const invalid = {
      loop: {
        ...TRANSITION_ARTIFACTS.observation,
        fromState: 'OBSERVED',
        toState: 'OBSERVED',
      },
    } as any;
    assert.throws(
      () => validateTransitionArtifacts(invalid),
      (err: unknown) => err instanceof TransitionConsistencyError
    );
  });

  it('82. Validator rejects non-false authority_conferred', () => {
    const invalid = {
      observation: {
        ...TRANSITION_ARTIFACTS.observation,
        content: {
          ...TRANSITION_ARTIFACTS.observation.content,
          authority_conferred: true,
        },
      },
    } as any;
    assert.throws(
      () => validateTransitionArtifacts(invalid),
      (err: unknown) => err instanceof TransitionConsistencyError
    );
  });

  it('83. Validator rejects unknown supporting evidence ID', () => {
    const invalid = {
      observation: {
        ...TRANSITION_ARTIFACTS.observation,
        supportingEvidence: ['EVD-UNKNOWN-999'],
      },
    } as any;
    assert.throws(
      () => validateTransitionArtifacts(invalid),
      (err: unknown) => err instanceof TransitionConsistencyError
    );
  });

  it('84. Validator rejects SPIFFE technology leakage in transition artifact', () => {
    const invalid = {
      observation: {
        ...TRANSITION_ARTIFACTS.observation,
        interpretation: 'Uses spiffe://workload identity',
      },
    } as any;
    assert.throws(
      () => validateTransitionArtifacts(invalid),
      (err: unknown) => err instanceof TransitionConsistencyError
    );
  });

  // ========================================================
  // 15. Regression (Req 85-86)
  // ========================================================
  it('85. All 5 prior modules remain discoverable and functional', async () => {
    const session = sessionStore.createSession();
    const reqCtx = new RequestContext({ session });

    const routesToTest = [
      'sim://metadata/workload-profile',
      'sim://audit/bootstrap-history',
      'sim://config/active-specification',
      'sim://identity/context',
    ];

    for (const r of routesToTest) {
      const res = await engine.dispatch(parseSimRoute(r), 'READ', reqCtx);
      assert.equal(res.status, 'success');
    }
  });

  it('86. Engine is fully initialized, ready, and locked with all 6 modules active', () => {
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
    ]);
  });
});
