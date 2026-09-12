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
import { ResolutionNotEstablishedError } from '../src/modules/resolution/resolution-types.js';
import * as ResolutionIndex from '../src/modules/resolution/index.js';
import { SynthesisModule } from '../src/modules/synthesis/synthesis-module.js';
import { TransitionModule } from '../src/modules/transition/transition-module.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { SessionRecord, SessionStore } from '../src/session/session-store.js';

describe('Prompt 13: Controlled Resolution Framework Hardening & Information Leakage Prevention', () => {
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
          'EVD-SYNTH-05-MULTI-PERSPECTIVE',
        ],
        accessCount: 5,
      },
      'synthesis'
    );
  }

  function assertNoBooleansRecursively(obj: unknown, path = 'root'): void {
    if (typeof obj === 'boolean') {
      assert.fail(`Boolean oracle found at path "${path}": ${obj}`);
    }
    if (obj !== null && typeof obj === 'object') {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => assertNoBooleansRecursively(item, `${path}[${index}]`));
      } else {
        for (const [key, value] of Object.entries(obj)) {
          assertNoBooleansRecursively(value, path ? `${path}.${key}` : key);
        }
      }
    }
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

  describe('A — Boolean Oracle Prevention', () => {
    it('verifies zero boolean values exist recursively in all 5 canonical artifacts', () => {
      for (const [name, artifact] of Object.entries(RESOLUTION_ARTIFACTS)) {
        assertNoBooleansRecursively(artifact.content, `RESOLUTION_ARTIFACTS[${name}].content`);
      }
    });

    it('verifies zero boolean values in dispatched responses', async () => {
      const session = sessionStore.createSession();
      enableAllPrereqs(session);
      const reqCtx = new RequestContext({ session });

      // Access first 4 to unlock unified
      for (const route of canonicalRoutes.slice(0, 4)) {
        const dispatchRes = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
        const res = dispatchRes.data as EvidenceResponse;
        assertNoBooleansRecursively(res.evidence.content, `${route}.content`);
      }

      const unifiedDispatch = await engine.dispatch(parseSimRoute(canonicalRoutes[4]), 'READ', reqCtx);
      const unifiedRes = unifiedDispatch.data as EvidenceResponse;
      assertNoBooleansRecursively(unifiedRes.evidence.content, `${canonicalRoutes[4]}.content`);
    });

    it('rejects direct verification fields or disguised answer shortcuts', () => {
      const forbiddenFields = [
        'correct',
        'incorrect',
        'valid',
        'invalid',
        'matches',
        'consistent',
        'resolved',
        'selected',
        'accepted',
        'verified',
        'complete',
        'successful',
        'ready',
        'finalized',
      ];

      for (const [name, artifact] of Object.entries(RESOLUTION_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact.content).toLowerCase();
        for (const field of forbiddenFields) {
          assert.equal(
            serialized.includes(`"${field}"`),
            false,
            `Artifact '${name}' contains forbidden verification field: ${field}`
          );
        }
      }
    });
  });

  describe('B — Ranking & Scoring Prevention', () => {
    it('verifies absence of score, rank, weight, priority, confidence, probability, and precedence', () => {
      const forbiddenTerms = [
        'score',
        'rank',
        'ranking',
        'weight',
        'priority',
        'confidence',
        'probability',
        'likelihood',
        'precedence',
        'resolution_order',
      ];

      for (const [name, artifact] of Object.entries(RESOLUTION_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact).toLowerCase();
        for (const term of forbiddenTerms) {
          const regex = new RegExp(`\\b${term}\\b`, 'i');
          assert.equal(
            regex.test(serialized),
            false,
            `Artifact '${name}' contains prohibited ranking term: ${term}`
          );
        }
      }
    });
  });

  describe('C — Winner Prevention', () => {
    it('verifies absence of winner, winning_model, winning_hypothesis, best_model, or selected_hypothesis', () => {
      const forbiddenWinners = [
        'winner',
        'winning_model',
        'winning_hypothesis',
        'best_model',
        'best_hypothesis',
        'correct_hypothesis',
        'selected_hypothesis',
        'winning_dimension',
        'dominant_dimension',
        'highest_priority',
        'authoritative_winner',
      ];

      for (const [name, artifact] of Object.entries(RESOLUTION_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact).toLowerCase();
        for (const term of forbiddenWinners) {
          assert.equal(
            serialized.includes(term),
            false,
            `Artifact '${name}' contains prohibited winner indicator: ${term}`
          );
        }
      }
    });
  });

  describe('D — Answer & Solution Prevention', () => {
    it('verifies absence of answer, final_answer, solution, solution_path, or flag', () => {
      for (const artifact of Object.values(RESOLUTION_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);

        assert.equal(serialized.includes('BPCTF{'), false);
        assert.equal(serialized.includes('flag{'), false);
        assert.equal(/\b(the\s+answer\s+is|final\s+answer|the\s+solution\s+is|solution_path)\b/i.test(serialized), false);
        assert.equal(/\b(resolved_value|flag_value)\b/i.test(serialized), false);
      }
    });
  });

  describe('E — Structural Leakage Prevention', () => {
    it('verifies structural-context artifact alone does not determine a resolution', () => {
      const struct = RESOLUTION_ARTIFACTS['structural-context'];
      const serialized = JSON.stringify(struct);

      assert.equal(/wins|overrides|selected|authoritative/i.test(serialized), false);
      assert.equal(struct.authority_conferred, false);
    });
  });

  describe('F — Historical Leakage Prevention', () => {
    it('verifies historical-context alone does not declare winners or displace prior records', () => {
      const hist = RESOLUTION_ARTIFACTS['historical-context'];
      const serialized = JSON.stringify(hist);

      assert.equal(/always\s+wins|newer\s+wins|older\s+loses/i.test(serialized), false);
      assert.equal(hist.authority_conferred, false);
    });
  });

  describe('G — Environmental Leakage Prevention', () => {
    it('verifies environmental-context contains zero binary equivalence oracles', () => {
      const env = RESOLUTION_ARTIFACTS['environmental-context'];
      const serialized = JSON.stringify(env);

      assert.equal(/equivalent|identical|correct_zone/i.test(serialized), false);
      assert.equal(env.authority_conferred, false);
    });
  });

  describe('H — Relational Leakage Prevention', () => {
    it('verifies relational-context correlates dimensions without hierarchy or precedence', () => {
      const rel = RESOLUTION_ARTIFACTS['relational-context'];
      const serialized = JSON.stringify(rel);

      assert.equal(/dominates|takes\s+precedence|superior|hierarchy/i.test(serialized), false);
      assert.equal(rel.authority_conferred, false);
    });
  });

  describe('I — Unified Context Safety', () => {
    it('verifies unified context prepares resolution without deciding the challenge or exposing a flag', () => {
      const unified = RESOLUTION_ARTIFACTS['resolution-context'];
      const serialized = JSON.stringify(unified);

      assert.equal(serialized.includes('BPCTF{'), false);
      assert.equal(/winner|decided|challenge\s+complete|final\s+result/i.test(serialized), false);
      assert.equal(unified.authority_conferred, false);
      assert.equal(unified.resolutionDimension, 'CONTROLLED_MULTI_DOMAIN_ALIGNMENT');
    });
  });

  describe('J — Internal Model Containment', () => {
    it('does not export INTERNAL_RESOLUTION_MODEL or internal node/relation types from index', () => {
      const exports = Object.keys(ResolutionIndex);
      assert.equal(exports.includes('INTERNAL_RESOLUTION_MODEL'), false);
      assert.equal(exports.includes('validateInternalResolutionModel'), false);
      assert.equal(exports.includes('InternalResolutionNode'), false);
      assert.equal(exports.includes('InternalResolutionRelation'), false);
    });

    it('ensures internal model identifiers do not appear in serialized responses', async () => {
      const session = sessionStore.createSession();
      enableAllPrereqs(session);
      const reqCtx = new RequestContext({ session });

      for (const route of canonicalRoutes.slice(0, 4)) {
        await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      }

      for (const route of canonicalRoutes) {
        const dispatchRes = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
        const serialized = JSON.stringify(dispatchRes.data);

        assert.equal(serialized.includes('NODE-RES-'), false);
        assert.equal(serialized.includes('REL-STRUCT-TO'), false);
        assert.equal(serialized.includes('REL-HIST-TO'), false);
        assert.equal(serialized.includes('REL-ENV-TO'), false);
        assert.equal(serialized.includes('REL-REL-TO'), false);
        assert.equal(serialized.includes('INTERNAL_RESOLUTION_MODEL'), false);
      }
    });
  });

  describe('K — Serialization Safety', () => {
    it('serializes cleanly with JSON.stringify without undefined or circular leaks', () => {
      for (const artifact of Object.values(RESOLUTION_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        const parsed = JSON.parse(serialized);

        assert.ok(parsed.artifactId);
        assert.ok(parsed.content);
        assert.equal(parsed.authority_conferred, false);
      }
    });
  });

  describe('L — Generic Error Surface', () => {
    it('returns uniform 422 ERR_RESOLUTION_CONTEXT_NOT_ESTABLISHED without leaking missing prerequisites', async () => {
      const session = sessionStore.createSession();
      const reqCtx = new RequestContext({ session });

      for (const uri of canonicalRoutes) {
        await assert.rejects(
          async () => {
            await engine.dispatch(parseSimRoute(uri), 'READ', reqCtx);
          },
          (err: any) => {
            assert.equal(err instanceof ResolutionNotEstablishedError, true);
            assert.equal(err.statusCode, 422);
            assert.equal(err.code, 'ERR_RESOLUTION_CONTEXT_NOT_ESTABLISHED');
            assert.equal(
              err.message,
              'The available operational record does not establish the requested resolution context.'
            );
            // Verify no missing evidence IDs, routes, or dependency counts in error message
            assert.equal(/EVD-|sim:\/\/|missing|count|node|prereq/i.test(err.message), false);
            return true;
          }
        );
      }
    });
  });

  describe('M — Route Security', () => {
    it('strictly confines routes to exactly 5 canonical endpoints', () => {
      for (const uri of canonicalRoutes) {
        const route = parseSimRoute(uri);
        assert.equal(routeRegistry.hasRoute(route, 'READ'), true);
      }

      const forbidden = [
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
      for (const uri of forbidden) {
        const route = parseSimRoute(uri);
        assert.equal(routeRegistry.hasRoute(route, 'READ'), false);
      }
    });
  });

  describe('N — Reasoning Difficulty & Cross-Domain Necessity', () => {
    it('requires cross-domain evidence across metadata, config, identity, trust, transition, constraint, inference, graph, and synthesis', async () => {
      const session = sessionStore.createSession();
      // Partial prereqs: structural + historical only
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

      const reqCtx = new RequestContext({ session });

      // Structural succeeds
      const structRes = (await engine.dispatch(
        parseSimRoute('sim://resolution/structural-context'),
        'READ',
        reqCtx
      )).data as EvidenceResponse;
      assert.equal(structRes.evidence.id, 'EVD-RES-01-STRUCTURAL');

      // Environmental fails because metadata, binding, etc. are missing
      await assert.rejects(
        async () => {
          await engine.dispatch(parseSimRoute('sim://resolution/environmental-context'), 'READ', reqCtx);
        },
        ResolutionNotEstablishedError
      );

      // Relational fails because transition is not RECONCILED
      await assert.rejects(
        async () => {
          await engine.dispatch(parseSimRoute('sim://resolution/relational-context'), 'READ', reqCtx);
        },
        ResolutionNotEstablishedError
      );

      // Unified resolution fails because not all 4 contexts are established
      await assert.rejects(
        async () => {
          await engine.dispatch(parseSimRoute('sim://resolution/resolution-context'), 'READ', reqCtx);
        },
        ResolutionNotEstablishedError
      );
    });
  });

  describe('O — Fairness & Determinism', () => {
    it('executes identically across repeated runs without timing or random dependencies', async () => {
      const session = sessionStore.createSession();
      enableAllPrereqs(session);
      const reqCtx = new RequestContext({ session });

      for (const route of canonicalRoutes.slice(0, 4)) {
        await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      }

      for (const route of canonicalRoutes) {
        const r1 = (await engine.dispatch(parseSimRoute(route), 'READ', reqCtx)).data as EvidenceResponse;
        const r2 = (await engine.dispatch(parseSimRoute(route), 'READ', reqCtx)).data as EvidenceResponse;
        assert.deepEqual(r1, r2);
      }
    });
  });

  describe('P — Full Regression Compatibility', () => {
    it('verifies all 10 prior modules remain registered and functional', () => {
      const priorModules = [
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
      ];

      for (const modId of priorModules) {
        const mod = moduleRegistry.get(modId as any);
        assert.ok(mod, `Module ${modId} must be registered`);
        assert.equal(mod.version, '1.0.0');
      }
    });
  });
});
