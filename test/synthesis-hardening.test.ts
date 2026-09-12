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
import { SynthesisNotEstablishedError } from '../src/modules/synthesis/synthesis-types.js';
import * as SynthesisIndex from '../src/modules/synthesis/index.js';
import { TransitionModule } from '../src/modules/transition/transition-module.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import { InvalidSimRouteError, SimRouteNotFoundError } from '../src/router/sim-errors.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { SessionRecord, SessionStore } from '../src/session/session-store.js';

describe('Prompt 12: Controlled Evidence Synthesis Hardening & Information Leakage Prevention', () => {
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

    engine = new ChallengeEngine(moduleRegistry, { routeRegistry });
    await engine.initialize();
  });

  describe('A. Boolean Oracle Prevention', () => {
    it('1. Zero boolean values exist recursively in all synthesis artifacts content', () => {
      for (const artifact of Object.values(SYNTHESIS_ARTIFACTS)) {
        assertNoBooleansRecursively(artifact.content);
      }
    });

    it('2-6. No correct, valid, matches, resolved, or selected fields exist in content', () => {
      const forbidden = ['correct', 'valid', 'matches', 'resolved', 'selected'];
      for (const artifact of Object.values(SYNTHESIS_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact.content);
        for (const word of forbidden) {
          assert.ok(!serialized.includes(`"${word}"`), `Forbidden field "${word}" in content`);
        }
      }
    });
  });

  describe('B. Answer & Solution Oracle Prevention', () => {
    it('7-12. No answer, final_answer, solution, winner, winning_model, or correct_hypothesis fields exist', () => {
      const forbidden = [
        'answer',
        'final_answer',
        'solution',
        'winner',
        'winning_model',
        'winning_hypothesis',
        'correct_hypothesis',
      ];
      for (const artifact of Object.values(SYNTHESIS_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        for (const word of forbidden) {
          assert.ok(!serialized.includes(`"${word}"`), `Forbidden answer/winner field "${word}" found`);
          assert.ok(!new RegExp(`\\b${word}\\b`, 'i').test(serialized), `Forbidden answer/winner token "${word}" found`);
        }
      }
    });
  });

  describe('C. Ranking & Scoring Prevention', () => {
    it('13-19. No score, rank, priority, weight, confidence, probability, or likelihood fields exist', () => {
      const forbidden = [
        'score',
        'rank',
        'ranking',
        'priority',
        'weight',
        'confidence',
        'probability',
        'likelihood',
      ];
      for (const artifact of Object.values(SYNTHESIS_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        for (const word of forbidden) {
          assert.ok(!serialized.includes(`"${word}"`), `Forbidden ranking/scoring field "${word}" found`);
        }
      }
    });
  });

  describe('D. Dependency & Graph Topology Leakage Prevention', () => {
    it('20-26. No dependency_count, prerequisite_count, adjacency, critical_path, or graph topology fields', () => {
      const forbidden = [
        'dependency_count',
        'prerequisite_count',
        'dependency_graph',
        'adjacency',
        'parents',
        'children',
        'neighbors',
        'path',
        'critical_path',
        'root',
        'leaf',
        'depth',
        'level',
      ];
      for (const artifact of Object.values(SYNTHESIS_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        for (const word of forbidden) {
          assert.ok(!serialized.includes(`"${word}"`), `Forbidden topology field "${word}" found`);
        }
      }
    });
  });

  describe('E. Synthesis Internal Model Containment', () => {
    it('27-30. Internal model structures are not exported, serialized, or exposed via object spreading', () => {
      const exportedKeys = Object.keys(SynthesisIndex);
      assert.ok(!exportedKeys.includes('INTERNAL_SYNTHESIS_MODEL'));
      assert.ok(!exportedKeys.includes('validateInternalSynthesisModel'));
      assert.ok(!exportedKeys.includes('InternalSynthesisPerspective'));
      assert.ok(!exportedKeys.includes('InternalSynthesisLink'));
      assert.ok(!exportedKeys.includes('InternalSynthesisDefinition'));

      for (const artifact of Object.values(SYNTHESIS_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        assert.ok(!serialized.includes('INTERNAL_SYNTHESIS_MODEL'));
        assert.ok(!serialized.includes('LINK-'));
        const spread = { ...artifact };
        assert.ok(!('perspectives' in spread));
        assert.ok(!('links' in spread));
      }
    });
  });

  describe('F. Error Hardening', () => {
    it('31-37. Premature requests return uniform 422 without leaking missing IDs, routes, or topology', async () => {
      const session = sessionStore.createSession();
      const reqCtx = new RequestContext({ session });
      const genericMsg = 'The available operational record does not establish the requested synthesis context.';

      for (const route of canonicalRoutes) {
        try {
          await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
          assert.fail('Expected rejection');
        } catch (err: any) {
          assert.ok(err instanceof SynthesisNotEstablishedError);
          assert.equal(err.statusCode, 422);
          assert.equal(err.code, 'ERR_SYNTHESIS_CONTEXT_NOT_ESTABLISHED');
          assert.equal(err.message, genericMsg);
          assert.ok(!err.message.includes('EVD-'));
          assert.ok(!err.message.includes('sim://'));
          assert.ok(!err.message.includes('prerequisite'));
          assert.ok(!err.message.includes('missing'));
          assert.ok(!err.message.includes('topology'));
        }
      }
    });
  });

  describe('G. Route Security', () => {
    it('38-46. Exactly 5 canonical routes exist and non-canonical/traversal/case variants are rejected', async () => {
      const session = sessionStore.createSession();
      const reqCtx = new RequestContext({ session });

      const invalidRoutes = [
        'sim://synthesis/debug',
        'sim://synthesis/answer',
        'sim://synthesis/solution',
        'sim://synthesis/graph',
        'sim://synthesis/dependencies',
      ];

      for (const uri of invalidRoutes) {
        await assert.rejects(
          async () => {
            await engine.dispatch(parseSimRoute(uri), 'READ', reqCtx);
          },
          (err: any) => err instanceof SimRouteNotFoundError || err.statusCode === 404
        );
      }

      assert.throws(() => parseSimRoute('sim://synthesis/SPECIFICATION-PERSPECTIVE'), InvalidSimRouteError);
      assert.throws(() => parseSimRoute('sim://synthesis/specification-perspective.json'), InvalidSimRouteError);
      assert.throws(() => parseSimRoute('sim://synthesis/specification-perspective?debug=true'), InvalidSimRouteError);
      assert.throws(() => parseSimRoute('sim://synthesis/../metadata'), InvalidSimRouteError);
      assert.throws(() => parseSimRoute('sim://synthesis/%2e%2e/metadata'), InvalidSimRouteError);
    });
  });

  describe('H. Serialization Safety & Defensive Cloning', () => {
    it('47-50. JSON serialization is safe and nested response mutation does not alter canonical artifacts', async () => {
      const session = sessionStore.createSession();
      enableAllPrereqs(session);
      const reqCtx = new RequestContext({ session });

      const res = await engine.dispatch(parseSimRoute('sim://synthesis/specification-perspective'), 'READ', reqCtx);
      const data = res.data as EvidenceResponse;

      // Deep clone / defensive freezing prevents modification
      assert.throws(() => {
        (data.evidence.content as any).newField = 'pollute';
      });

      // Canonical artifact remains unchanged
      const canonical = SYNTHESIS_ARTIFACTS['specification-perspective'];
      assert.equal((canonical.content as any).newField, undefined);
    });
  });

  describe('I. Information & Technology Leakage Defense', () => {
    it('51-62. Zero flags, secrets, credentials, tokens, cloud tech, SPIFFE, or roadmap language', () => {
      for (const artifact of Object.values(SYNTHESIS_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        // Flags
        assert.ok(!serialized.includes('BPCTF{'));
        assert.ok(!serialized.includes('flag{'));
        // Secrets / credentials
        assert.ok(!/BEGIN\s+(RSA|EC|PRIVATE)\s+KEY/i.test(serialized));
        assert.ok(!/bearer\s+[a-z0-9_.-]{10,}/i.test(serialized));
        assert.ok(!/\b(api_key|client_secret|private_key|password)\b/i.test(serialized));
        // Auth tokens
        assert.ok(!/\b(jwt|oauth|oidc|saml)\b/i.test(serialized));
        // Cloud tech
        assert.ok(!/\b(aws|azure|gcp|kubernetes|docker|k8s)\b/i.test(serialized));
        // SPIFFE
        assert.ok(!/\b(spiffe|spire|svid)\b/i.test(serialized));
        // Roadmap / challenge meta-language
        assert.ok(!/prompt\s*\d+/i.test(serialized));
        assert.ok(!/phase\s*\d+/i.test(serialized));
        assert.ok(!/next\s+stage/i.test(serialized));
        assert.ok(!/future\s+stage/i.test(serialized));
        assert.ok(!/subsequent\s+phase/i.test(serialized));
        assert.ok(!/correct\s+answer/i.test(serialized));
        assert.ok(!/final\s+answer/i.test(serialized));
        assert.ok(!/solution\s+path/i.test(serialized));
        assert.ok(!/prompt\s*13|phase\s*13|future\s+module|next\s+module/i.test(serialized));
      }
    });
  });

  describe('J. Reasoning Fairness & Cross-Domain Synthesis', () => {
    it('63-70. No single perspective resolves the challenge and multi-perspective produces no winner', () => {
      const spec = SYNTHESIS_ARTIFACTS['specification-perspective'];
      const lin = SYNTHESIS_ARTIFACTS['lineage-perspective'];
      const bnd = SYNTHESIS_ARTIFACTS['boundary-perspective'];
      const rel = SYNTHESIS_ARTIFACTS['relational-perspective'];
      const multi = SYNTHESIS_ARTIFACTS['multi-perspective'];

      // Distinct perspectives
      assert.notEqual(spec.content.perspective_dimension, lin.content.perspective_dimension);
      assert.notEqual(lin.content.perspective_dimension, bnd.content.perspective_dimension);
      assert.notEqual(bnd.content.perspective_dimension, rel.content.perspective_dimension);
      assert.notEqual(rel.content.perspective_dimension, multi.content.perspective_dimension);

      // Multi-perspective references all 4 prior perspectives
      assert.ok(multi.correlatedEvidence.includes('EVD-SYNTH-01-SPECIFICATION'));
      assert.ok(multi.correlatedEvidence.includes('EVD-SYNTH-02-LINEAGE'));
      assert.ok(multi.correlatedEvidence.includes('EVD-SYNTH-03-BOUNDARY'));
      assert.ok(multi.correlatedEvidence.includes('EVD-SYNTH-04-RELATIONAL'));

      // Neutral coexistence, no winner
      const serializedMulti = JSON.stringify(multi);
      assert.ok(!/\b(winner|winning|selected|correct|solution|final_answer)\b/i.test(serializedMulti));
    });
  });

  describe('K. Determinism & Stability', () => {
    it('71-75. Independent valid sessions receive identical responses without timestamps/randomness', async () => {
      const session1 = sessionStore.createSession();
      const session2 = sessionStore.createSession();
      enableAllPrereqs(session1);
      enableAllPrereqs(session2);

      const reqCtx1 = new RequestContext({ session: session1 });
      const reqCtx2 = new RequestContext({ session: session2 });

      for (const route of canonicalRoutes) {
        const res1 = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx1);
        const res2 = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx2);
        assert.deepEqual(res1.data, res2.data);
      }
    });
  });

  describe('L. Full Regression & Module Integrity', () => {
    it('76-80. All 9 predecessor modules remain functional and registry locking is preserved', () => {
      const expectedModules = [
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

      for (const modId of expectedModules) {
        const mod = moduleRegistry.get(modId as any);
        assert.ok(mod, `Module ${modId} must be registered`);
        assert.equal(mod.version, '1.0.0');
      }

      assert.ok(moduleRegistry.isLocked());
      assert.ok(routeRegistry.isLocked());
      assert.ok(engine.isReady());
    });
  });
});
