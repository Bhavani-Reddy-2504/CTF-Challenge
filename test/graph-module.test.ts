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
import { GRAPH_ARTIFACTS } from '../src/modules/graph/graph-artifacts.js';
import { GraphModule } from '../src/modules/graph/graph-module.js';
import {
  GraphNotEstablishedError,
  GraphSessionState,
} from '../src/modules/graph/graph-types.js';
import { KNOWN_GRAPH_EVIDENCE_IDS } from '../src/modules/graph/index.js';
import { IdentityModule } from '../src/modules/identity/identity-module.js';
import { InferenceModule } from '../src/modules/inference/inference-module.js';
import { MetadataModule } from '../src/modules/metadata/metadata-module.js';
import { TransitionModule } from '../src/modules/transition/transition-module.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import { InvalidSimRouteError, SimRouteNotFoundError } from '../src/router/sim-errors.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { APPROVED_SIM_NAMESPACES } from '../src/router/sim-route.js';
import { StateOwnershipError, VALID_MODULE_NAMESPACES } from '../src/session/session-context.js';
import { SessionRecord, SessionStore } from '../src/session/session-store.js';

describe('Prompt 11: Evidence Graph & Non-Linear Correlation Layer (Module Tests)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;

  const canonicalRoutes = [
    'sim://graph/context-fragment',
    'sim://graph/correlation-fragment',
    'sim://graph/topology-fragment',
    'sim://graph/convergence-fragment',
    'sim://graph/reconstruction-fragment',
  ];

  function enableContextFragmentPrereqs(session: SessionRecord): void {
    session.context.setNamespaceState(
      'metadata',
      { discoveredEvidence: ['EVD-META-02-CONTEXT'] },
      'metadata'
    );
    session.context.setNamespaceState(
      'config',
      { discoveredEvidence: ['EVD-CFG-02-BINDING'] },
      'config'
    );
    session.context.setNamespaceState(
      'constraint',
      { discoveredEvidence: ['EVD-CONSTRAINT-03-BOUNDARY'] },
      'constraint'
    );
  }

  function enableCorrelationFragmentPrereqs(session: SessionRecord): void {
    session.context.setNamespaceState(
      'audit',
      { discoveredEvidence: ['EVD-AUD-03-FAILS'] },
      'audit'
    );
    session.context.setNamespaceState(
      'identity',
      { discoveredEvidence: ['EVD-IDN-04-LINEAGE'] },
      'identity'
    );
    session.context.setNamespaceState(
      'trust',
      { discoveredEvidence: ['EVD-TRUST-03-LINEAGE'] },
      'trust'
    );
    session.context.setNamespaceState(
      'constraint',
      { discoveredEvidence: ['EVD-CONSTRAINT-02-CONTINUITY'] },
      'constraint'
    );
  }

  function enableTopologyFragmentPrereqs(session: SessionRecord): void {
    enableContextFragmentPrereqs(session);
    session.context.setNamespaceState(
      'config',
      { discoveredEvidence: ['EVD-CFG-01-ACTIVE-SPEC', 'EVD-CFG-02-BINDING'] },
      'config'
    );
    session.context.setNamespaceState(
      'inference',
      { discoveredEvidence: ['EVD-INFER-01-SPECIFICATION'] },
      'inference'
    );
    session.context.setNamespaceState(
      'graph',
      { discoveredEvidence: ['EVD-GRAPH-01-CONTEXT'], accessCount: 1 },
      'graph'
    );
  }

  function enableConvergenceFragmentPrereqs(session: SessionRecord): void {
    enableCorrelationFragmentPrereqs(session);
    session.context.setNamespaceState(
      'transition',
      {
        currentState: 'RECONCILED',
        recordedTransitions: ['EVD-TRANS-03-RECONCILIATION'],
      },
      'transition'
    );
    session.context.setNamespaceState(
      'inference',
      { discoveredEvidence: ['EVD-INFER-04-RECONCILIATION'] },
      'inference'
    );
    session.context.setNamespaceState(
      'graph',
      { discoveredEvidence: ['EVD-GRAPH-02-CORRELATION'], accessCount: 1 },
      'graph'
    );
  }

  function enableReconstructionFragmentPrereqs(session: SessionRecord): void {
    enableTopologyFragmentPrereqs(session);
    enableConvergenceFragmentPrereqs(session);
    session.context.setNamespaceState(
      'constraint',
      {
        discoveredEvidence: [
          'EVD-CONSTRAINT-02-CONTINUITY',
          'EVD-CONSTRAINT-03-BOUNDARY',
        ],
      },
      'constraint'
    );
    session.context.setNamespaceState(
      'inference',
      {
        discoveredEvidence: [
          'EVD-INFER-01-SPECIFICATION',
          'EVD-INFER-04-RECONCILIATION',
          'EVD-INFER-05-CONVERGENCE',
        ],
      },
      'inference'
    );
    session.context.setNamespaceState(
      'graph',
      {
        discoveredEvidence: [
          'EVD-GRAPH-01-CONTEXT',
          'EVD-GRAPH-02-CORRELATION',
          'EVD-GRAPH-03-TOPOLOGY',
          'EVD-GRAPH-04-CONVERGENCE',
        ],
        accessCount: 4,
      },
      'graph'
    );
  }

  beforeEach(async () => {
    const config = validateAndBuildConfig();
    sessionStore = new SessionStore(config);
    moduleRegistry = new ModuleRegistry();
    routeRegistry = new SimRouteRegistry();

    const metadataModule = new MetadataModule(routeRegistry);
    const auditModule = new AuditModule(routeRegistry);
    const configModule = new ConfigModule(routeRegistry);
    const identityModule = new IdentityModule(routeRegistry);
    const trustModule = new TrustModule(routeRegistry);
    const transitionModule = new TransitionModule(routeRegistry);
    const constraintModule = new ConstraintModule(routeRegistry);
    const inferenceModule = new InferenceModule(routeRegistry);
    const graphModule = new GraphModule(routeRegistry);

    moduleRegistry.register(metadataModule);
    moduleRegistry.register(auditModule);
    moduleRegistry.register(configModule);
    moduleRegistry.register(identityModule);
    moduleRegistry.register(trustModule);
    moduleRegistry.register(transitionModule);
    moduleRegistry.register(constraintModule);
    moduleRegistry.register(inferenceModule);
    moduleRegistry.register(graphModule);

    engine = new ChallengeEngine(moduleRegistry, { routeRegistry });
    await engine.initialize();
  });

  describe('1. Architecture & Module Contract', () => {
    it('1.1 Module ID is "graph" and version is "1.0.0"', () => {
      const mod = moduleRegistry.get('graph');
      assert.ok(mod);
      assert.equal(mod.id, 'graph');
      assert.equal(mod.version, '1.0.0');
    });

    it('1.2 "graph" is present in approved namespaces and module IDs', () => {
      assert.ok(APPROVED_SIM_NAMESPACES.has('graph'));
      assert.ok(VALID_MODULE_NAMESPACES.has('graph'));
    });

    it('1.3 Declares all 8 prior required dependencies', () => {
      const mod = moduleRegistry.get('graph')!;
      assert.deepEqual(mod.requiredDependencies, [
        'metadata',
        'audit',
        'config',
        'identity',
        'trust',
        'transition',
        'constraint',
        'inference',
      ]);
    });

    it('1.4 Post-bootstrap route registration is locked', () => {
      assert.throws(
        () => {
          routeRegistry.register(
            parseSimRoute('sim://graph/unauthorized-endpoint'),
            'READ',
            () => ({ status: 'ok', data: {} } as any)
          );
        },
        (err: any) => err.code === 'SIM_DISPATCH_REJECTED' || /locked/i.test(err.message)
      );
    });

    it('1.5 Session state ownership is strictly enforced', () => {
      const session = sessionStore.createSession();
      assert.throws(() => {
        session.context.setNamespaceState(
          'graph',
          { discoveredEvidence: ['EVD-GRAPH-01-CONTEXT'] },
          'metadata' as any
        );
      }, StateOwnershipError);
    });
  });

  describe('2. Canonical Symbolic Routes & Rejection', () => {
    it('2.1 All 5 canonical routes are registered in route registry', () => {
      for (const uri of canonicalRoutes) {
        const route = parseSimRoute(uri);
        assert.ok(routeRegistry.hasRoute(route, 'READ'), `Route missing: ${uri}`);
      }
    });

    it('2.2 Non-canonical routes in sim://graph/ namespace are rejected', async () => {
      const session = sessionStore.createSession();
      const reqCtx = new RequestContext({ session });
      const nonCanonical = [
        'sim://graph/nodes',
        'sim://graph/edges',
        'sim://graph/adjacency',
        'sim://graph/graph',
        'sim://graph/topology',
        'sim://graph/traversal',
        'sim://graph/context-fragment/extra',
        'sim://graph/reconstruction',
        'sim://graph/fragments',
      ];

      for (const uri of nonCanonical) {
        const route = parseSimRoute(uri);
        await assert.rejects(
          async () => {
            await engine.dispatch(route, 'READ', reqCtx);
          },
          (err: any) => err instanceof SimRouteNotFoundError || err.statusCode === 404
        );
      }
    });

    it('2.3 Case mutations, encoded characters, and trailing slashes are rejected', () => {
      assert.throws(() => parseSimRoute('sim://graph/CONTEXT-FRAGMENT'), InvalidSimRouteError);
      assert.throws(() => parseSimRoute('sim://graph/context_fragment'), InvalidSimRouteError);
      assert.throws(() => parseSimRoute('sim://graph/context-fragment/'), InvalidSimRouteError);
      assert.throws(() => parseSimRoute('sim://graph/context%2Dfragment'), InvalidSimRouteError);
    });
  });

  describe('3. Canonical Artifacts & Envelope Standards', () => {
    it('3.1 All 5 artifacts adhere to EvidenceResponse format and are immutable', () => {
      for (const artifact of Object.values(GRAPH_ARTIFACTS)) {
        assert.ok(artifact.artifactId.startsWith('EVD-GRAPH-'));
        assert.ok(artifact.classification.startsWith('GRAPH_'));
        assert.equal(artifact.version, '1.0.0');
        assert.equal(artifact.status, 'ACTIVE');
        assert.equal(artifact.source, 'graph');
        assert.ok(Object.isFrozen(artifact));
        assert.ok(Object.isFrozen(artifact.content));
      }
    });

    it('3.2 Known evidence IDs contains all 37 evidence IDs across 9 modules', () => {
      assert.equal(KNOWN_GRAPH_EVIDENCE_IDS.size, 37);
      assert.ok(KNOWN_GRAPH_EVIDENCE_IDS.has('EVD-META-01-ROUTER'));
      assert.ok(KNOWN_GRAPH_EVIDENCE_IDS.has('EVD-AUD-01-DISPATCH'));
      assert.ok(KNOWN_GRAPH_EVIDENCE_IDS.has('EVD-CFG-01-ACTIVE-SPEC'));
      assert.ok(KNOWN_GRAPH_EVIDENCE_IDS.has('EVD-IDN-01-CONTEXT'));
      assert.ok(KNOWN_GRAPH_EVIDENCE_IDS.has('EVD-TRUST-01-COHERENCE'));
      assert.ok(KNOWN_GRAPH_EVIDENCE_IDS.has('EVD-TRANS-01-OBSERVATION'));
      assert.ok(KNOWN_GRAPH_EVIDENCE_IDS.has('EVD-CONSTRAINT-01-SPECIFICATION'));
      assert.ok(KNOWN_GRAPH_EVIDENCE_IDS.has('EVD-INFER-01-SPECIFICATION'));
      assert.ok(KNOWN_GRAPH_EVIDENCE_IDS.has('EVD-GRAPH-01-CONTEXT'));
      assert.ok(KNOWN_GRAPH_EVIDENCE_IDS.has('EVD-GRAPH-05-RECONSTRUCTION'));
    });

    it('3.3 Artifact responses are deterministic across repeated dispatches', async () => {
      const session = sessionStore.createSession();
      enableReconstructionFragmentPrereqs(session);
      const reqCtx = new RequestContext({ session });

      for (const route of canonicalRoutes) {
        const res1 = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
        const res2 = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
        assert.deepEqual(res1, res2);
      }
    });
  });

  describe('4. Non-Linear DAG Discovery Gating', () => {
    it('4.1 Uninitialized session accessing any graph route throws GraphNotEstablishedError (422)', async () => {
      const session = sessionStore.createSession();
      const reqCtx = new RequestContext({ session });

      for (const uri of canonicalRoutes) {
        const route = parseSimRoute(uri);
        await assert.rejects(
          async () => {
            await engine.dispatch(route, 'READ', reqCtx);
          },
          (err: any) => {
            assert.ok(err instanceof GraphNotEstablishedError);
            assert.equal(err.statusCode, 422);
            assert.equal(err.code, 'ERR_GRAPH_CONTEXT_NOT_ESTABLISHED');
            return true;
          }
        );
      }
    });

    it('4.2 Branch 1: context-fragment unlocks with correct prerequisites', async () => {
      const session = sessionStore.createSession();
      enableContextFragmentPrereqs(session);
      const reqCtx = new RequestContext({ session });

      const route = parseSimRoute('sim://graph/context-fragment');
      const res = await engine.dispatch(route, 'READ', reqCtx);

      assert.equal(res.status, 'success');
      const data = res.data as EvidenceResponse;
      assert.equal(data.status, 'ok');
      assert.equal(data.evidence.id, 'EVD-GRAPH-01-CONTEXT');
      assert.equal(data.evidence.classification, 'GRAPH_CONTEXT_FRAGMENT');

      // Check session state update
      const state = session.context.getNamespaceState<GraphSessionState>('graph');
      assert.ok(state);
      assert.ok(state.discoveredEvidence.includes('EVD-GRAPH-01-CONTEXT'));
      assert.equal(state.accessCount, 1);
    });

    it('4.3 Branch 2: correlation-fragment unlocks independently without Branch 1', async () => {
      const session = sessionStore.createSession();
      enableCorrelationFragmentPrereqs(session);
      const reqCtx = new RequestContext({ session });

      // Context fragment must still be locked
      const contextRoute = parseSimRoute('sim://graph/context-fragment');
      await assert.rejects(
        async () => {
          await engine.dispatch(contextRoute, 'READ', reqCtx);
        },
        GraphNotEstablishedError
      );

      // Correlation fragment succeeds
      const corrRoute = parseSimRoute('sim://graph/correlation-fragment');
      const res = await engine.dispatch(corrRoute, 'READ', reqCtx);

      assert.equal(res.status, 'success');
      const data = res.data as EvidenceResponse;
      assert.equal(data.status, 'ok');
      assert.equal(data.evidence.id, 'EVD-GRAPH-02-CORRELATION');
      assert.equal(data.evidence.classification, 'GRAPH_CORRELATION_FRAGMENT');

      const state = session.context.getNamespaceState<GraphSessionState>('graph');
      assert.ok(state);
      assert.ok(state.discoveredEvidence.includes('EVD-GRAPH-02-CORRELATION'));
    });

    it('4.4 Branch 1 Step 2: topology-fragment requires active spec, infer spec, and graph context-fragment', async () => {
      const session = sessionStore.createSession();
      enableTopologyFragmentPrereqs(session);
      const reqCtx = new RequestContext({ session });

      const route = parseSimRoute('sim://graph/topology-fragment');
      const res = await engine.dispatch(route, 'READ', reqCtx);

      assert.equal(res.status, 'success');
      const data = res.data as EvidenceResponse;
      assert.equal(data.status, 'ok');
      assert.equal(data.evidence.id, 'EVD-GRAPH-03-TOPOLOGY');
      assert.equal(data.evidence.classification, 'GRAPH_TOPOLOGY_FRAGMENT');
    });

    it('4.5 Branch 2 Step 2: convergence-fragment requires reconciled transition, infer recon, and graph correlation-fragment', async () => {
      const session = sessionStore.createSession();
      enableConvergenceFragmentPrereqs(session);
      const reqCtx = new RequestContext({ session });

      const route = parseSimRoute('sim://graph/convergence-fragment');
      const res = await engine.dispatch(route, 'READ', reqCtx);

      assert.equal(res.status, 'success');
      const data = res.data as EvidenceResponse;
      assert.equal(data.status, 'ok');
      assert.equal(data.evidence.id, 'EVD-GRAPH-04-CONVERGENCE');
      assert.equal(data.evidence.classification, 'GRAPH_CONVERGENCE_FRAGMENT');
    });

    it('4.6 Reconstruction: requires topology-fragment, convergence-fragment, and inference convergence', async () => {
      const session = sessionStore.createSession();
      enableReconstructionFragmentPrereqs(session);
      const reqCtx = new RequestContext({ session });

      const route = parseSimRoute('sim://graph/reconstruction-fragment');
      const res = await engine.dispatch(route, 'READ', reqCtx);

      assert.equal(res.status, 'success');
      const data = res.data as EvidenceResponse;
      assert.equal(data.status, 'ok');
      assert.equal(data.evidence.id, 'EVD-GRAPH-05-RECONSTRUCTION');
      assert.equal(data.evidence.classification, 'GRAPH_RECONSTRUCTION_FRAGMENT');
    });

    it('4.7 Reconstruction fails if either branch is missing', async () => {
      const session = sessionStore.createSession();
      // Enable Branch 1 completely, but omit Branch 2
      enableTopologyFragmentPrereqs(session);
      session.context.setNamespaceState(
        'inference',
        { discoveredEvidence: ['EVD-INFER-05-CONVERGENCE'] },
        'inference'
      );
      session.context.setNamespaceState(
        'graph',
        { discoveredEvidence: ['EVD-GRAPH-01-CONTEXT', 'EVD-GRAPH-03-TOPOLOGY'] },
        'graph'
      );
      const reqCtx = new RequestContext({ session });

      const route = parseSimRoute('sim://graph/reconstruction-fragment');
      await assert.rejects(
        async () => {
          await engine.dispatch(route, 'READ', reqCtx);
        },
        GraphNotEstablishedError
      );
    });
  });

  describe('5. Session Isolation & Immutability', () => {
    it('5.1 Two concurrent sessions maintain independent graph discovery states', async () => {
      const sessionA = sessionStore.createSession();
      const sessionB = sessionStore.createSession();

      enableContextFragmentPrereqs(sessionA);
      const reqCtxA = new RequestContext({ session: sessionA });
      const reqCtxB = new RequestContext({ session: sessionB });

      const route = parseSimRoute('sim://graph/context-fragment');

      // sessionA succeeds
      const resA = await engine.dispatch(route, 'READ', reqCtxA);
      assert.equal(resA.status, 'success');

      // sessionB fails
      await assert.rejects(
        async () => {
          await engine.dispatch(route, 'READ', reqCtxB);
        },
        GraphNotEstablishedError
      );
    });

    it('5.2 Response payload cannot be mutated by caller', async () => {
      const session = sessionStore.createSession();
      enableContextFragmentPrereqs(session);
      const reqCtx = new RequestContext({ session });

      const route = parseSimRoute('sim://graph/context-fragment');
      const res = await engine.dispatch(route, 'READ', reqCtx);

      const data = res.data as EvidenceResponse;
      assert.throws(() => {
        (data as any).newProperty = 'test';
      });
      assert.throws(() => {
        (data.evidence as any).newProperty = 'test';
      });
      assert.throws(() => {
        (data.evidence.content as any).newProperty = 'test';
      });
    });
  });
});
