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
import { GraphModule } from '../src/modules/graph/graph-module.js';
import { IdentityModule } from '../src/modules/identity/identity-module.js';
import { InferenceModule } from '../src/modules/inference/inference-module.js';
import { MetadataModule } from '../src/modules/metadata/metadata-module.js';
import { SYNTHESIS_ARTIFACTS } from '../src/modules/synthesis/synthesis-artifacts.js';
import { SynthesisModule } from '../src/modules/synthesis/synthesis-module.js';
import {
  SynthesisNotEstablishedError,
  SynthesisSessionState,
} from '../src/modules/synthesis/synthesis-types.js';
import { KNOWN_SYNTHESIS_EVIDENCE_IDS } from '../src/modules/synthesis/index.js';
import { TransitionModule } from '../src/modules/transition/transition-module.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import { InvalidSimRouteError, SimRouteNotFoundError } from '../src/router/sim-errors.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { APPROVED_SIM_NAMESPACES } from '../src/router/sim-route.js';
import { StateOwnershipError, VALID_MODULE_NAMESPACES } from '../src/session/session-context.js';
import { SessionRecord, SessionStore } from '../src/session/session-store.js';

describe('Prompt 12: Controlled Evidence Synthesis & Multi-Perspective Reconstruction Layer (Module Tests)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;

  const canonicalRoutes = [
    'sim://synthesis/specification-perspective',
    'sim://synthesis/lineage-perspective',
    'sim://synthesis/boundary-perspective',
    'sim://synthesis/relational-perspective',
    'sim://synthesis/multi-perspective',
  ];

  function enableSpecificationPerspectivePrereqs(session: SessionRecord): void {
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
    session.context.setNamespaceState(
      'inference',
      { discoveredEvidence: ['EVD-INFER-01-SPECIFICATION'] },
      'inference'
    );
    session.context.setNamespaceState(
      'graph',
      { discoveredEvidence: ['EVD-GRAPH-03-TOPOLOGY'] },
      'graph'
    );
  }

  function enableLineagePerspectivePrereqs(session: SessionRecord): void {
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
      'trust',
      { discoveredEvidence: ['EVD-TRUST-03-LINEAGE'] },
      'trust'
    );
    session.context.setNamespaceState(
      'constraint',
      { discoveredEvidence: ['EVD-CONSTRAINT-02-CONTINUITY'] },
      'constraint'
    );
    session.context.setNamespaceState(
      'inference',
      { discoveredEvidence: ['EVD-INFER-02-LINEAGE'] },
      'inference'
    );
    session.context.setNamespaceState(
      'graph',
      { discoveredEvidence: ['EVD-GRAPH-02-CORRELATION'] },
      'graph'
    );
  }

  function enableBoundaryPerspectivePrereqs(session: SessionRecord): void {
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
      'identity',
      { discoveredEvidence: ['EVD-IDN-03-TRUST-MEMBERSHIP'] },
      'identity'
    );
    session.context.setNamespaceState(
      'constraint',
      { discoveredEvidence: ['EVD-CONSTRAINT-03-BOUNDARY'] },
      'constraint'
    );
    session.context.setNamespaceState(
      'inference',
      { discoveredEvidence: ['EVD-INFER-03-BOUNDARY'] },
      'inference'
    );
    session.context.setNamespaceState(
      'graph',
      { discoveredEvidence: ['EVD-GRAPH-01-CONTEXT'] },
      'graph'
    );
  }

  function enableRelationalPerspectivePrereqs(session: SessionRecord): void {
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
    session.context.setNamespaceState(
      'inference',
      { discoveredEvidence: ['EVD-INFER-04-RECONCILIATION'] },
      'inference'
    );
    session.context.setNamespaceState(
      'graph',
      { discoveredEvidence: ['EVD-GRAPH-04-CONVERGENCE'] },
      'graph'
    );
  }

  function enableFirstThreePerspectivesPrereqs(session: SessionRecord): void {
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
      { discoveredEvidence: ['EVD-CFG-01-ACTIVE-SPEC', 'EVD-CFG-02-BINDING', 'EVD-CFG-04-COMPAT'] },
      'config'
    );
    session.context.setNamespaceState(
      'identity',
      { discoveredEvidence: ['EVD-IDN-03-TRUST-MEMBERSHIP', 'EVD-IDN-04-LINEAGE'] },
      'identity'
    );
    session.context.setNamespaceState(
      'trust',
      { discoveredEvidence: ['EVD-TRUST-02-BINDING', 'EVD-TRUST-03-LINEAGE'] },
      'trust'
    );
    session.context.setNamespaceState(
      'constraint',
      {
        discoveredEvidence: [
          'EVD-CONSTRAINT-01-SPECIFICATION',
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
          'EVD-INFER-02-LINEAGE',
          'EVD-INFER-03-BOUNDARY',
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
        ],
      },
      'graph'
    );
  }

  function enableAllPrereqs(session: SessionRecord): void {
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
      { discoveredEvidence: ['EVD-CFG-01-ACTIVE-SPEC', 'EVD-CFG-02-BINDING', 'EVD-CFG-04-COMPAT'] },
      'config'
    );
    session.context.setNamespaceState(
      'identity',
      { discoveredEvidence: ['EVD-IDN-03-TRUST-MEMBERSHIP', 'EVD-IDN-04-LINEAGE'] },
      'identity'
    );
    session.context.setNamespaceState(
      'trust',
      { discoveredEvidence: ['EVD-TRUST-02-BINDING', 'EVD-TRUST-03-LINEAGE', 'EVD-TRUST-05-INTERPRETATION'] },
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
    session.context.setNamespaceState(
      'inference',
      {
        discoveredEvidence: [
          'EVD-INFER-01-SPECIFICATION',
          'EVD-INFER-02-LINEAGE',
          'EVD-INFER-03-BOUNDARY',
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
          'EVD-GRAPH-05-RECONSTRUCTION',
        ],
        accessCount: 5,
      },
      'graph'
    );
    session.context.setNamespaceState(
      'synthesis',
      {
        discoveredEvidence: [
          'EVD-SYNTH-01-SPECIFICATION',
          'EVD-SYNTH-02-LINEAGE',
          'EVD-SYNTH-03-BOUNDARY',
          'EVD-SYNTH-04-RELATIONAL',
        ],
        accessCount: 4,
      },
      'synthesis'
    );
  }

  beforeEach(async () => {
    const config = validateAndBuildConfig();
    sessionStore = new SessionStore(config);
    moduleRegistry = new ModuleRegistry();
    routeRegistry = new SimRouteRegistry();

    moduleRegistry.register(new MetadataModule(routeRegistry));
    moduleRegistry.register(new AuditModule(routeRegistry));
    moduleRegistry.register(new ConfigModule(routeRegistry));
    moduleRegistry.register(new IdentityModule(routeRegistry));
    moduleRegistry.register(new TrustModule(routeRegistry));
    moduleRegistry.register(new TransitionModule(routeRegistry));
    moduleRegistry.register(new ConstraintModule(routeRegistry));
    moduleRegistry.register(new InferenceModule(routeRegistry));
    moduleRegistry.register(new GraphModule(routeRegistry));
    moduleRegistry.register(new SynthesisModule(routeRegistry));

    engine = new ChallengeEngine(moduleRegistry, { routeRegistry });
    await engine.initialize();
  });

  describe('1. Architecture & Module Contract', () => {
    it('1.1 Module ID is "synthesis" and version is "1.0.0"', () => {
      const mod = moduleRegistry.get('synthesis');
      assert.ok(mod);
      assert.equal(mod.id, 'synthesis');
      assert.equal(mod.version, '1.0.0');
    });

    it('1.2 "synthesis" is registered in namespaces and module IDs', () => {
      assert.ok(APPROVED_SIM_NAMESPACES.has('synthesis'));
      assert.ok(VALID_MODULE_NAMESPACES.has('synthesis'));
    });

    it('1.3 Declares all 9 prior required dependencies', () => {
      const mod = moduleRegistry.get('synthesis')!;
      assert.deepEqual(mod.requiredDependencies, [
        'metadata',
        'audit',
        'config',
        'identity',
        'trust',
        'transition',
        'constraint',
        'inference',
        'graph',
      ]);
    });

    it('1.4 Post-bootstrap route registration is locked', () => {
      assert.throws(
        () => {
          routeRegistry.register(
            parseSimRoute('sim://synthesis/unauthorized-endpoint'),
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
          'synthesis',
          { discoveredEvidence: ['EVD-SYNTH-01-SPECIFICATION'] },
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

    it('2.2 Non-canonical routes in sim://synthesis/ namespace are rejected', async () => {
      const session = sessionStore.createSession();
      const reqCtx = new RequestContext({ session });
      const nonCanonical = [
        'sim://synthesis/status',
        'sim://synthesis/current',
        'sim://synthesis/debug',
        'sim://synthesis/explain',
        'sim://synthesis/answer',
        'sim://synthesis/solution',
        'sim://synthesis/final',
        'sim://synthesis/graph',
        'sim://synthesis/dependencies',
        'sim://synthesis/internal',
        'sim://synthesis/perspectives',
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

    it('2.3 Trailing slashes, extensions, query strings, and case variations are rejected', () => {
      assert.throws(() => parseSimRoute('sim://synthesis/SPECIFICATION-PERSPECTIVE'), InvalidSimRouteError);
      assert.throws(() => parseSimRoute('sim://synthesis/specification_perspective'), InvalidSimRouteError);
      assert.throws(() => parseSimRoute('sim://synthesis/specification-perspective/'), InvalidSimRouteError);
      assert.throws(() => parseSimRoute('sim://synthesis/specification-perspective.json'), InvalidSimRouteError);
      assert.throws(() => parseSimRoute('sim://synthesis/%2e%2e/metadata'), InvalidSimRouteError);
    });
  });

  describe('3. Canonical Artifacts & Envelope Standards', () => {
    it('3.1 Exactly 5 canonical artifacts exist with unique IDs and correct envelope', () => {
      const artifacts = Object.values(SYNTHESIS_ARTIFACTS);
      assert.equal(artifacts.length, 5);

      const ids = new Set<string>();
      for (const artifact of artifacts) {
        assert.ok(artifact.artifactId.startsWith('EVD-SYNTH-'));
        assert.ok(!ids.has(artifact.artifactId));
        ids.add(artifact.artifactId);

        assert.ok(artifact.classification.endsWith('_SYNTHESIS'));
        assert.equal(artifact.version, '1.0.0');
        assert.equal(artifact.status, 'ACTIVE');
        assert.equal(artifact.source, 'synthesis');
        assert.equal(artifact.authority_conferred, false);
        assert.ok(Object.isFrozen(artifact));
        assert.ok(Object.isFrozen(artifact.content));
      }
      assert.equal(ids.size, 5);
    });

    it('3.2 Known evidence IDs contains all 42 evidence IDs across 10 modules', () => {
      assert.equal(KNOWN_SYNTHESIS_EVIDENCE_IDS.size, 42);
      assert.ok(KNOWN_SYNTHESIS_EVIDENCE_IDS.has('EVD-META-01-ROUTER'));
      assert.ok(KNOWN_SYNTHESIS_EVIDENCE_IDS.has('EVD-AUD-01-DISPATCH'));
      assert.ok(KNOWN_SYNTHESIS_EVIDENCE_IDS.has('EVD-CFG-01-ACTIVE-SPEC'));
      assert.ok(KNOWN_SYNTHESIS_EVIDENCE_IDS.has('EVD-IDN-01-CONTEXT'));
      assert.ok(KNOWN_SYNTHESIS_EVIDENCE_IDS.has('EVD-TRUST-01-COHERENCE'));
      assert.ok(KNOWN_SYNTHESIS_EVIDENCE_IDS.has('EVD-TRANS-01-OBSERVATION'));
      assert.ok(KNOWN_SYNTHESIS_EVIDENCE_IDS.has('EVD-CONSTRAINT-01-SPECIFICATION'));
      assert.ok(KNOWN_SYNTHESIS_EVIDENCE_IDS.has('EVD-INFER-01-SPECIFICATION'));
      assert.ok(KNOWN_SYNTHESIS_EVIDENCE_IDS.has('EVD-GRAPH-01-CONTEXT'));
      assert.ok(KNOWN_SYNTHESIS_EVIDENCE_IDS.has('EVD-SYNTH-01-SPECIFICATION'));
      assert.ok(KNOWN_SYNTHESIS_EVIDENCE_IDS.has('EVD-SYNTH-05-MULTI-PERSPECTIVE'));
    });

    it('3.3 Artifact responses are deterministic across repeated dispatches', async () => {
      const session = sessionStore.createSession();
      enableAllPrereqs(session);
      const reqCtx = new RequestContext({ session });

      for (const route of canonicalRoutes) {
        const res1 = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
        const res2 = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
        assert.deepEqual(res1, res2);
      }
    });
  });

  describe('4. Discovery Gating & Non-Linear Access Model', () => {
    it('4.1 Uninitialized session accessing any synthesis route throws generic 422', async () => {
      const session = sessionStore.createSession();
      const reqCtx = new RequestContext({ session });

      for (const uri of canonicalRoutes) {
        const route = parseSimRoute(uri);
        await assert.rejects(
          async () => {
            await engine.dispatch(route, 'READ', reqCtx);
          },
          (err: any) => {
            assert.ok(err instanceof SynthesisNotEstablishedError);
            assert.equal(err.statusCode, 422);
            assert.equal(err.code, 'ERR_SYNTHESIS_CONTEXT_NOT_ESTABLISHED');
            assert.equal(
              err.message,
              'The available operational record does not establish the requested synthesis context.'
            );
            return true;
          }
        );
      }
    });

    it('4.2 Specification perspective unlocks with structural evidence', async () => {
      const session = sessionStore.createSession();
      enableSpecificationPerspectivePrereqs(session);
      const reqCtx = new RequestContext({ session });

      const route = parseSimRoute('sim://synthesis/specification-perspective');
      const res = await engine.dispatch(route, 'READ', reqCtx);

      assert.equal(res.status, 'success');
      const data = res.data as EvidenceResponse;
      assert.equal(data.status, 'ok');
      assert.equal(data.evidence.id, 'EVD-SYNTH-01-SPECIFICATION');
      assert.equal(data.evidence.classification, 'SPECIFICATION_SYNTHESIS');

      const state = session.context.getNamespaceState<SynthesisSessionState>('synthesis');
      assert.ok(state);
      assert.ok(state.discoveredEvidence.includes('EVD-SYNTH-01-SPECIFICATION'));
      assert.equal(state.accessCount, 1);
    });

    it('4.3 Lineage perspective unlocks independently without specification perspective', async () => {
      const session = sessionStore.createSession();
      enableLineagePerspectivePrereqs(session);
      const reqCtx = new RequestContext({ session });

      // Specification perspective remains locked
      const specRoute = parseSimRoute('sim://synthesis/specification-perspective');
      await assert.rejects(
        async () => {
          await engine.dispatch(specRoute, 'READ', reqCtx);
        },
        SynthesisNotEstablishedError
      );

      // Lineage perspective succeeds
      const linRoute = parseSimRoute('sim://synthesis/lineage-perspective');
      const res = await engine.dispatch(linRoute, 'READ', reqCtx);

      assert.equal(res.status, 'success');
      const data = res.data as EvidenceResponse;
      assert.equal(data.status, 'ok');
      assert.equal(data.evidence.id, 'EVD-SYNTH-02-LINEAGE');
      assert.equal(data.evidence.classification, 'LINEAGE_SYNTHESIS');
    });

    it('4.4 Boundary perspective unlocks independently without specification or lineage', async () => {
      const session = sessionStore.createSession();
      enableBoundaryPerspectivePrereqs(session);
      const reqCtx = new RequestContext({ session });

      // Specification perspective remains locked
      await assert.rejects(
        async () => {
          await engine.dispatch(parseSimRoute('sim://synthesis/specification-perspective'), 'READ', reqCtx);
        },
        SynthesisNotEstablishedError
      );

      // Boundary perspective succeeds
      const route = parseSimRoute('sim://synthesis/boundary-perspective');
      const res = await engine.dispatch(route, 'READ', reqCtx);

      assert.equal(res.status, 'success');
      const data = res.data as EvidenceResponse;
      assert.equal(data.status, 'ok');
      assert.equal(data.evidence.id, 'EVD-SYNTH-03-BOUNDARY');
      assert.equal(data.evidence.classification, 'BOUNDARY_SYNTHESIS');
    });

    it('4.5 Relative order of first 3 perspectives does not matter', async () => {
      const session = sessionStore.createSession();
      enableFirstThreePerspectivesPrereqs(session);
      const reqCtx = new RequestContext({ session });

      // Access in reverse order: boundary -> lineage -> specification
      const resBnd = await engine.dispatch(parseSimRoute('sim://synthesis/boundary-perspective'), 'READ', reqCtx);
      const resLin = await engine.dispatch(parseSimRoute('sim://synthesis/lineage-perspective'), 'READ', reqCtx);
      const resSpec = await engine.dispatch(parseSimRoute('sim://synthesis/specification-perspective'), 'READ', reqCtx);

      assert.equal(resBnd.status, 'success');
      assert.equal(resLin.status, 'success');
      assert.equal(resSpec.status, 'success');
    });

    it('4.6 Relational perspective requires cross-domain reconciliation', async () => {
      const session = sessionStore.createSession();
      enableRelationalPerspectivePrereqs(session);
      const reqCtx = new RequestContext({ session });

      const route = parseSimRoute('sim://synthesis/relational-perspective');
      const res = await engine.dispatch(route, 'READ', reqCtx);

      assert.equal(res.status, 'success');
      const data = res.data as EvidenceResponse;
      assert.equal(data.status, 'ok');
      assert.equal(data.evidence.id, 'EVD-SYNTH-04-RELATIONAL');
      assert.equal(data.evidence.classification, 'RELATIONAL_SYNTHESIS');
    });

    it('4.7 Multi-perspective requires all four prior perspectives plus inference & graph convergence', async () => {
      const session = sessionStore.createSession();
      enableAllPrereqs(session);
      const reqCtx = new RequestContext({ session });

      const route = parseSimRoute('sim://synthesis/multi-perspective');
      const res = await engine.dispatch(route, 'READ', reqCtx);

      assert.equal(res.status, 'success');
      const data = res.data as EvidenceResponse;
      assert.equal(data.status, 'ok');
      assert.equal(data.evidence.id, 'EVD-SYNTH-05-MULTI-PERSPECTIVE');
      assert.equal(data.evidence.classification, 'MULTI_PERSPECTIVE_SYNTHESIS');
    });

    it('4.8 Multi-perspective fails if any one prior synthesis perspective is missing', async () => {
      const session = sessionStore.createSession();
      enableAllPrereqs(session);

      // Remove relational perspective from synthesis state
      session.context.setNamespaceState(
        'synthesis',
        {
          discoveredEvidence: [
            'EVD-SYNTH-01-SPECIFICATION',
            'EVD-SYNTH-02-LINEAGE',
            'EVD-SYNTH-03-BOUNDARY',
          ],
        },
        'synthesis'
      );
      const reqCtx = new RequestContext({ session });

      const route = parseSimRoute('sim://synthesis/multi-perspective');
      await assert.rejects(
        async () => {
          await engine.dispatch(route, 'READ', reqCtx);
        },
        SynthesisNotEstablishedError
      );
    });
  });

  describe('5. Session Isolation, Idempotency & Immutability', () => {
    it('5.1 Two concurrent sessions maintain independent synthesis state', async () => {
      const sessionA = sessionStore.createSession();
      const sessionB = sessionStore.createSession();

      enableSpecificationPerspectivePrereqs(sessionA);
      const reqCtxA = new RequestContext({ session: sessionA });
      const reqCtxB = new RequestContext({ session: sessionB });

      const route = parseSimRoute('sim://synthesis/specification-perspective');

      const resA = await engine.dispatch(route, 'READ', reqCtxA);
      assert.equal(resA.status, 'success');

      await assert.rejects(
        async () => {
          await engine.dispatch(route, 'READ', reqCtxB);
        },
        SynthesisNotEstablishedError
      );
    });

    it('5.2 Repeated access is idempotent and does not create duplicate discoveries', async () => {
      const session = sessionStore.createSession();
      enableSpecificationPerspectivePrereqs(session);
      const reqCtx = new RequestContext({ session });

      const route = parseSimRoute('sim://synthesis/specification-perspective');
      await engine.dispatch(route, 'READ', reqCtx);
      await engine.dispatch(route, 'READ', reqCtx);

      const state = session.context.getNamespaceState<SynthesisSessionState>('synthesis')!;
      assert.equal(state.accessCount, 2);
      assert.equal(
        state.discoveredEvidence.filter((id) => id === 'EVD-SYNTH-01-SPECIFICATION').length,
        1
      );
    });

    it('5.3 Response payload is defensively frozen and caller cannot mutate server state', async () => {
      const session = sessionStore.createSession();
      enableSpecificationPerspectivePrereqs(session);
      const reqCtx = new RequestContext({ session });

      const route = parseSimRoute('sim://synthesis/specification-perspective');
      const res = await engine.dispatch(route, 'READ', reqCtx);

      const data = res.data as EvidenceResponse;
      assert.throws(() => {
        (data as any).newProperty = 'mutated';
      });
      assert.throws(() => {
        (data.evidence as any).newProperty = 'mutated';
      });
      assert.throws(() => {
        (data.evidence.content as any).newProperty = 'mutated';
      });
    });

    it('5.4 Session destruction cleans synthesis state', () => {
      const session = sessionStore.createSession();
      enableSpecificationPerspectivePrereqs(session);
      session.context.setNamespaceState(
        'synthesis',
        { discoveredEvidence: ['EVD-SYNTH-01-SPECIFICATION'] },
        'synthesis'
      );

      sessionStore.destroySession(session.id);
      const retrieved = sessionStore.getSession(session.id);
      assert.equal(retrieved, undefined);
    });
  });
});
