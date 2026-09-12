import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
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
import { RESOLUTION_ARTIFACTS } from '../src/modules/resolution/resolution-artifacts.js';
import { ResolutionModule } from '../src/modules/resolution/resolution-module.js';
import {
  ResolutionNotEstablishedError,
  ResolutionSessionState,
} from '../src/modules/resolution/resolution-types.js';
import { KNOWN_RESOLUTION_EVIDENCE_IDS } from '../src/modules/resolution/index.js';
import { SynthesisModule } from '../src/modules/synthesis/synthesis-module.js';
import { TransitionModule } from '../src/modules/transition/transition-module.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import { InvalidSimRouteError, SimRouteNotFoundError } from '../src/router/sim-errors.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { APPROVED_SIM_NAMESPACES } from '../src/router/sim-route.js';
import { StateOwnershipError, VALID_MODULE_NAMESPACES } from '../src/session/session-context.js';
import { SessionRecord, SessionStore } from '../src/session/session-store.js';

describe('Prompt 13: Controlled Resolution Framework & Non-Oracular Decision Preparation (Module Tests)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;

  const canonicalRoutes = [
    'sim://resolution/structural-context',
    'sim://resolution/historical-context',
    'sim://resolution/environmental-context',
    'sim://resolution/relational-context',
    'sim://resolution/resolution-context',
  ];

  function enableStructuralContextPrereqs(session: SessionRecord): void {
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
    session.context.setNamespaceState(
      'synthesis',
      { discoveredEvidence: ['EVD-SYNTH-01-SPECIFICATION'] },
      'synthesis'
    );
  }

  function enableHistoricalContextPrereqs(session: SessionRecord): void {
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
    session.context.setNamespaceState(
      'synthesis',
      { discoveredEvidence: ['EVD-SYNTH-02-LINEAGE'] },
      'synthesis'
    );
  }

  function enableEnvironmentalContextPrereqs(session: SessionRecord): void {
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
    session.context.setNamespaceState(
      'synthesis',
      { discoveredEvidence: ['EVD-SYNTH-03-BOUNDARY'] },
      'synthesis'
    );
  }

  function enableRelationalContextPrereqs(session: SessionRecord): void {
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
    session.context.setNamespaceState(
      'synthesis',
      { discoveredEvidence: ['EVD-SYNTH-04-RELATIONAL'] },
      'synthesis'
    );
  }

  function enableAllIndependentBranches(session: SessionRecord): void {
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
      { discoveredEvidence: ['EVD-CFG-01-ACTIVE-SPEC', 'EVD-CFG-02-BINDING'] },
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
  }

  function enableAllPrereqs(session: SessionRecord): void {
    enableAllIndependentBranches(session);

    // Add relational prerequisites
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
      {
        discoveredEvidence: [
          'EVD-TRUST-02-BINDING',
          'EVD-TRUST-03-LINEAGE',
          'EVD-TRUST-05-INTERPRETATION',
        ],
      },
      'trust'
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
          'EVD-SYNTH-05-MULTI-PERSPECTIVE',
        ],
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
    moduleRegistry.register(new ResolutionModule(routeRegistry));

    engine = new ChallengeEngine(moduleRegistry, { routeRegistry });
    await engine.initialize();
  });

  afterEach(() => {
    sessionStore.shutdown();
  });

  describe('1. Module Architecture & Contract', () => {
    it('declares correct id, version, and 10 required dependencies', () => {
      const module = new ResolutionModule(routeRegistry);
      assert.equal(module.id, 'resolution');
      assert.equal(module.version, '1.0.0');
      assert.deepEqual(module.requiredDependencies, [
        'metadata',
        'audit',
        'config',
        'identity',
        'trust',
        'transition',
        'constraint',
        'inference',
        'graph',
        'synthesis',
      ]);
    });

    it('is registered in APPROVED_SIM_NAMESPACES and VALID_MODULE_NAMESPACES', () => {
      assert.equal(APPROVED_SIM_NAMESPACES.has('resolution'), true);
      assert.equal(VALID_MODULE_NAMESPACES.has('resolution'), true);
    });

    it('enforces StateOwnershipError on unauthorized namespace write', () => {
      const session = sessionStore.createSession();
      assert.throws(
        () => {
          session.context.setNamespaceState(
            'resolution',
            { discoveredEvidence: new Set(['EVD-RES-01-STRUCTURAL']), accessCount: 1, lastAccessedResolution: null },
            'audit'
          );
        },
        StateOwnershipError
      );
    });
  });

  describe('2. Canonical Routes & Artifacts Count', () => {
    it('registers exactly 5 canonical resolution routes in routeRegistry', () => {
      for (const uri of canonicalRoutes) {
        const route = parseSimRoute(uri);
        assert.ok(routeRegistry.hasRoute(route, 'READ'), `Route missing: ${uri}`);
      }
    });

    it('exposes exactly 5 canonical artifacts in RESOLUTION_ARTIFACTS', () => {
      const keys = Object.keys(RESOLUTION_ARTIFACTS);
      assert.equal(keys.length, 5);
      assert.deepEqual(
        keys.sort(),
        [
          'structural-context',
          'historical-context',
          'environmental-context',
          'relational-context',
          'resolution-context',
        ].sort()
      );
    });

    it('maps to the exact canonical artifact IDs', () => {
      assert.equal(RESOLUTION_ARTIFACTS['structural-context'].artifactId, 'EVD-RES-01-STRUCTURAL');
      assert.equal(RESOLUTION_ARTIFACTS['historical-context'].artifactId, 'EVD-RES-02-HISTORICAL');
      assert.equal(RESOLUTION_ARTIFACTS['environmental-context'].artifactId, 'EVD-RES-03-ENVIRONMENTAL');
      assert.equal(RESOLUTION_ARTIFACTS['relational-context'].artifactId, 'EVD-RES-04-RELATIONAL');
      assert.equal(RESOLUTION_ARTIFACTS['resolution-context'].artifactId, 'EVD-RES-05-CONTEXT');
    });
  });

  describe('3. Non-Canonical Route Rejection', () => {
    it('rejects debug, answer, solution, final, flag, result, verify routes', async () => {
      const session = sessionStore.createSession();
      const forbiddenUris = [
        'sim://resolution/debug',
        'sim://resolution/explain',
        'sim://resolution/matrix',
        'sim://resolution/answer',
        'sim://resolution/solution',
        'sim://resolution/final',
        'sim://resolution/flag',
        'sim://resolution/result',
        'sim://resolution/verify',
      ];

      for (const uri of forbiddenUris) {
        const reqContext = new RequestContext({
          correlationId: 'req-corr-rej',
          session,
        });

        await assert.rejects(
          async () => {
            const route = parseSimRoute(uri);
            await engine.dispatch(route, 'READ', reqContext);
          },
          SimRouteNotFoundError
        );
      }
    });

    it('rejects trailing slashes, extensions, query params, case variants, and path traversal', () => {
      const malformed = [
        'sim://resolution/structural-context/',
        'sim://resolution/structural-context.json',
        'sim://resolution/structural-context?debug=true',
        'sim://resolution/STRUCTURAL-CONTEXT',
        'sim://resolution/Structural-Context',
        'sim://resolution/../resolution/structural-context',
        'sim://resolution/%2e%2e/resolution-context',
      ];

      for (const uri of malformed) {
        assert.throws(() => parseSimRoute(uri), InvalidSimRouteError);
      }
    });
  });

  describe('4. Non-Linear Gating & Independent Analytical Branches', () => {
    it('throws ResolutionNotEstablishedError (422) if structural prerequisites are missing', async () => {
      const session = sessionStore.createSession();
      const reqContext = new RequestContext({
        correlationId: 'req-gate-struct-fail',
        session,
      });
      const route = parseSimRoute('sim://resolution/structural-context');

      await assert.rejects(
        async () => {
          await engine.dispatch(route, 'READ', reqContext);
        },
        (err: unknown) => {
          assert(err instanceof ResolutionNotEstablishedError);
          assert.equal(err.statusCode, 422);
          assert.equal(err.code, 'ERR_RESOLUTION_CONTEXT_NOT_ESTABLISHED');
          assert.equal(
            err.message,
            'The available operational record does not establish the requested resolution context.'
          );
          return true;
        }
      );
    });

    it('allows structural-context access when structural evidence is satisfied', async () => {
      const session = sessionStore.createSession();
      enableStructuralContextPrereqs(session);

      const reqContext = new RequestContext({
        correlationId: 'req-gate-struct-pass',
        session,
      });
      const route = parseSimRoute('sim://resolution/structural-context');
      const res = (await engine.dispatch(route, 'READ', reqContext)).data as EvidenceResponse;

      assert.equal(res.status, 'ok');
      assert.equal(res.evidence.id, 'EVD-RES-01-STRUCTURAL');
      assert.equal(res.evidence.classification, 'STRUCTURAL_RESOLUTION_CONTEXT');
    });

    it('allows historical-context access independently when historical evidence is satisfied', async () => {
      const session = sessionStore.createSession();
      enableHistoricalContextPrereqs(session);

      const reqContext = new RequestContext({
        correlationId: 'req-gate-hist-pass',
        session,
      });
      const route = parseSimRoute('sim://resolution/historical-context');
      const res = (await engine.dispatch(route, 'READ', reqContext)).data as EvidenceResponse;

      assert.equal(res.status, 'ok');
      assert.equal(res.evidence.id, 'EVD-RES-02-HISTORICAL');
      assert.equal(res.evidence.classification, 'HISTORICAL_RESOLUTION_CONTEXT');
    });

    it('allows environmental-context access independently when environmental evidence is satisfied', async () => {
      const session = sessionStore.createSession();
      enableEnvironmentalContextPrereqs(session);

      const reqContext = new RequestContext({
        correlationId: 'req-gate-env-pass',
        session,
      });
      const route = parseSimRoute('sim://resolution/environmental-context');
      const res = (await engine.dispatch(route, 'READ', reqContext)).data as EvidenceResponse;

      assert.equal(res.status, 'ok');
      assert.equal(res.evidence.id, 'EVD-RES-03-ENVIRONMENTAL');
      assert.equal(res.evidence.classification, 'ENVIRONMENTAL_RESOLUTION_CONTEXT');
    });

    it('verifies Structural, Historical, and Environmental branches are completely independent', async () => {
      // Historical enabled, structural not enabled -> historical succeeds, structural fails
      const session = sessionStore.createSession();
      enableHistoricalContextPrereqs(session);

      const reqHist = new RequestContext({ correlationId: 'req-h', session });
      const histRes = (await engine.dispatch(
        parseSimRoute('sim://resolution/historical-context'),
        'READ',
        reqHist
      )).data as EvidenceResponse;
      assert.equal(histRes.evidence.id, 'EVD-RES-02-HISTORICAL');

      const reqStruct = new RequestContext({ correlationId: 'req-s', session });
      await assert.rejects(
        async () => {
          await engine.dispatch(parseSimRoute('sim://resolution/structural-context'), 'READ', reqStruct);
        },
        ResolutionNotEstablishedError
      );
    });

    it('rejects relational-context until cross-domain reconciliation is established', async () => {
      const session = sessionStore.createSession();
      enableAllIndependentBranches(session);

      const reqContext = new RequestContext({ correlationId: 'req-rel-fail', session });
      await assert.rejects(
        async () => {
          await engine.dispatch(parseSimRoute('sim://resolution/relational-context'), 'READ', reqContext);
        },
        ResolutionNotEstablishedError
      );
    });

    it('allows relational-context when cross-domain reconciliation is established', async () => {
      const session = sessionStore.createSession();
      enableRelationalContextPrereqs(session);

      const reqContext = new RequestContext({ correlationId: 'req-rel-pass', session });
      const res = (await engine.dispatch(
        parseSimRoute('sim://resolution/relational-context'),
        'READ',
        reqContext
      )).data as EvidenceResponse;

      assert.equal(res.status, 'ok');
      assert.equal(res.evidence.id, 'EVD-RES-04-RELATIONAL');
      assert.equal(res.evidence.classification, 'RELATIONAL_RESOLUTION_CONTEXT');
    });

    it('rejects resolution-context until all 4 resolution contexts and convergence artifacts are discovered', async () => {
      const session = sessionStore.createSession();
      enableAllPrereqs(session);

      const reqContext = new RequestContext({ correlationId: 'req-unified-fail', session });
      await assert.rejects(
        async () => {
          await engine.dispatch(parseSimRoute('sim://resolution/resolution-context'), 'READ', reqContext);
        },
        ResolutionNotEstablishedError
      );

      // Now discover the 4 resolution contexts
      await engine.dispatch(parseSimRoute('sim://resolution/structural-context'), 'READ', reqContext);
      await engine.dispatch(parseSimRoute('sim://resolution/historical-context'), 'READ', reqContext);
      await engine.dispatch(parseSimRoute('sim://resolution/environmental-context'), 'READ', reqContext);
      await engine.dispatch(parseSimRoute('sim://resolution/relational-context'), 'READ', reqContext);

      // Now resolution-context succeeds!
      const unifiedRes = (await engine.dispatch(
        parseSimRoute('sim://resolution/resolution-context'),
        'READ',
        reqContext
      )).data as EvidenceResponse;

      assert.equal(unifiedRes.status, 'ok');
      assert.equal(unifiedRes.evidence.id, 'EVD-RES-05-CONTEXT');
      assert.equal(unifiedRes.evidence.classification, 'MULTI_DOMAIN_RESOLUTION_CONTEXT');
    });
  });

  describe('5. Session Isolation, State Tracking & Idempotency', () => {
    it('isolates resolution discovery between sessions', async () => {
      const sessionA = sessionStore.createSession();
      const sessionB = sessionStore.createSession();

      enableStructuralContextPrereqs(sessionA);

      const reqA = new RequestContext({ correlationId: 'req-a', session: sessionA });
      await engine.dispatch(parseSimRoute('sim://resolution/structural-context'), 'READ', reqA);

      const stateA = sessionA.context.getNamespaceState<ResolutionSessionState>('resolution');
      const stateB = sessionB.context.getNamespaceState<ResolutionSessionState>('resolution');

      assert.equal(stateA?.discoveredEvidence instanceof Set, true);
      assert.equal((stateA?.discoveredEvidence as Set<string>).has('EVD-RES-01-STRUCTURAL'), true);
      assert.equal(stateB, undefined);
    });

    it('is idempotent on repeated access to the same route', async () => {
      const session = sessionStore.createSession();
      enableStructuralContextPrereqs(session);

      const reqContext = new RequestContext({ correlationId: 'req-idem', session });
      const route = parseSimRoute('sim://resolution/structural-context');

      const res1 = (await engine.dispatch(route, 'READ', reqContext)).data as EvidenceResponse;
      const res2 = (await engine.dispatch(route, 'READ', reqContext)).data as EvidenceResponse;

      assert.deepEqual(res1, res2);

      const state = session.context.getNamespaceState<ResolutionSessionState>('resolution');
      assert.equal((state?.discoveredEvidence as Set<string>).size, 1);
      assert.equal(state?.accessCount, 2);
      assert.equal(state?.lastAccessedResolution, 'EVD-RES-01-STRUCTURAL');
    });
  });

  describe('6. Immutability & Determinism', () => {
    it('guarantees response objects are deeply frozen', async () => {
      const session = sessionStore.createSession();
      enableStructuralContextPrereqs(session);

      const reqContext = new RequestContext({ correlationId: 'req-freeze', session });
      const dispatchResult = await engine.dispatch(
        parseSimRoute('sim://resolution/structural-context'),
        'READ',
        reqContext
      );
      const res = dispatchResult.data as EvidenceResponse;

      assert.equal(Object.isFrozen(res), true);
      assert.equal(Object.isFrozen(res.evidence), true);
      assert.equal(Object.isFrozen(res.evidence.content), true);

      assert.throws(() => {
        (res.evidence as any).id = 'MUTATED';
      });
      assert.throws(() => {
        (res.evidence.content as any).resolution_dimension = 'MUTATED';
      });
    });

    it('produces identical responses across multiple invocations under same state', async () => {
      const session = sessionStore.createSession();
      enableAllPrereqs(session);

      const req1 = new RequestContext({ correlationId: 'req-det-1', session });
      const req2 = new RequestContext({ correlationId: 'req-det-2', session });

      const res1 = await engine.dispatch(parseSimRoute('sim://resolution/structural-context'), 'READ', req1);
      const res2 = await engine.dispatch(parseSimRoute('sim://resolution/structural-context'), 'READ', req2);

      assert.deepEqual(res1.data, res2.data);
    });
  });

  describe('7. Universe Integrity', () => {
    it('contains all 47 evidence IDs in KNOWN_RESOLUTION_EVIDENCE_IDS', () => {
      assert.equal(KNOWN_RESOLUTION_EVIDENCE_IDS.size, 47);
      assert.equal(KNOWN_RESOLUTION_EVIDENCE_IDS.has('EVD-RES-01-STRUCTURAL'), true);
      assert.equal(KNOWN_RESOLUTION_EVIDENCE_IDS.has('EVD-RES-02-HISTORICAL'), true);
      assert.equal(KNOWN_RESOLUTION_EVIDENCE_IDS.has('EVD-RES-03-ENVIRONMENTAL'), true);
      assert.equal(KNOWN_RESOLUTION_EVIDENCE_IDS.has('EVD-RES-04-RELATIONAL'), true);
      assert.equal(KNOWN_RESOLUTION_EVIDENCE_IDS.has('EVD-RES-05-CONTEXT'), true);
    });
  });
});
