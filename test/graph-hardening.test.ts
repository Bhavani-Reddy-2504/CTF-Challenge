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
import { GraphNotEstablishedError } from '../src/modules/graph/graph-types.js';
import * as GraphIndex from '../src/modules/graph/index.js';
import { IdentityModule } from '../src/modules/identity/identity-module.js';
import { InferenceModule } from '../src/modules/inference/inference-module.js';
import { MetadataModule } from '../src/modules/metadata/metadata-module.js';
import { TransitionModule } from '../src/modules/transition/transition-module.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { SessionRecord, SessionStore } from '../src/session/session-store.js';

describe('Prompt 11: Evidence Graph Hardening & Information Leakage Prevention', () => {
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

  function enableAllPrerequisites(session: SessionRecord): void {
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
      { discoveredEvidence: ['EVD-IDN-04-LINEAGE'] },
      'identity'
    );
    session.context.setNamespaceState(
      'trust',
      { discoveredEvidence: ['EVD-TRUST-03-LINEAGE'] },
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

  function assertNoBooleansRecursively(obj: unknown, path = ''): void {
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

    engine = new ChallengeEngine(moduleRegistry, { routeRegistry });
    await engine.initialize();
  });

  describe('1. Information Leakage & Credential Defense', () => {
    it('1.1 Zero BPCTF{ flag material or flag derivation tokens', () => {
      for (const [key, artifact] of Object.entries(GRAPH_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        assert.ok(!serialized.includes('BPCTF{'), `BPCTF{ found in ${key}`);
        assert.ok(!serialized.includes('flag{'), `flag{ found in ${key}`);
      }
    });

    it('1.2 Zero real secrets, private keys, passwords, or authentication credentials', () => {
      for (const artifact of Object.values(GRAPH_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        assert.ok(!/BEGIN\s+(RSA|EC|PRIVATE)\s+KEY/i.test(serialized));
        assert.ok(!/bearer\s+[a-z0-9_.-]{10,}/i.test(serialized));
        assert.ok(!/api_key|client_secret|private_key/i.test(serialized));
      }
    });

    it('1.3 Zero real cloud primitives (AWS, Azure, GCP, Kubernetes, Docker)', () => {
      for (const [key, artifact] of Object.entries(GRAPH_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        assert.ok(!/\b(aws|azure|gcp|kubernetes|docker|k8s)\b/i.test(serialized), `Cloud tech found in ${key}`);
      }
    });

    it('1.4 Zero SPIFFE / SPIRE / SVID terminology', () => {
      for (const [key, artifact] of Object.entries(GRAPH_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        assert.ok(!/\b(spiffe|spire|svid)\b/i.test(serialized), `SPIFFE leaked in ${key}`);
      }
    });

    it('1.5 Zero auth / token terminology (JWT, OAuth, SAML, OIDC)', () => {
      for (const [key, artifact] of Object.entries(GRAPH_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        assert.ok(!/\b(jwt|oauth|oidc|saml)\b/i.test(serialized), `Auth token leaked in ${key}`);
      }
    });

    it('1.6 Zero challenge meta-language or instructional phrasing', () => {
      for (const [key, artifact] of Object.entries(GRAPH_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        assert.ok(!/prompt\s*\d+/i.test(serialized), `Prompt leaked in ${key}`);
        assert.ok(!/phase\s*\d+/i.test(serialized), `Phase leaked in ${key}`);
        assert.ok(!/subsequent\s+phase/i.test(serialized), `Subsequent phase leaked in ${key}`);
        assert.ok(!/next\s+stage/i.test(serialized), `Next stage leaked in ${key}`);
        assert.ok(!/the\s+solution\s+is/i.test(serialized), `Solution leaked in ${key}`);
        assert.ok(!/correct\s+answer/i.test(serialized), `Answer leaked in ${key}`);
      }
    });

    it('1.7 Zero forward-looking roadmap references (Prompt 12 / Phase 12)', () => {
      for (const [key, artifact] of Object.entries(GRAPH_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        assert.ok(!/prompt\s*12|phase\s*12|future\s+module|next\s+module/i.test(serialized), `Roadmap leaked in ${key}`);
      }
    });
  });

  describe('2. Graph Oracle & Topology Defense', () => {
    it('2.1 Zero graph structural metadata fields in player-visible artifacts', () => {
      for (const [key, artifact] of Object.entries(GRAPH_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        const forbiddenFields = [
          'node_count',
          'edge_count',
          'adjacency',
          'degree',
          'neighbors',
          'shortest_path',
          'critical_path',
          'longest_path',
          'topological_order',
          'traversal_order',
          'solution_path',
          'correct_path',
        ];
        for (const field of forbiddenFields) {
          assert.ok(!serialized.includes(`"${field}"`), `Forbidden graph field "${field}" in ${key}`);
        }
      }
    });

    it('2.2 Zero boolean oracles recursively in content of all 5 canonical artifacts', () => {
      for (const [key, artifact] of Object.entries(GRAPH_ARTIFACTS)) {
        assertNoBooleansRecursively(artifact.content, `${key}.content`);
      }
    });

    it('2.3 Zero boolean oracles in dispatched response evidence.content', async () => {
      const session = sessionStore.createSession();
      enableAllPrerequisites(session);
      const reqCtx = new RequestContext({ session });

      for (const route of canonicalRoutes) {
        const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
        const data = res.data as EvidenceResponse;
        assertNoBooleansRecursively(data.evidence.content, `${route}.evidence.content`);
      }
    });
  });

  describe('3. Ranking, Score, Winner, and Answer Defense', () => {
    it('3.1 No winner or answer indicators in any artifact', () => {
      for (const [key, artifact] of Object.entries(GRAPH_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        assert.ok(!/\b(winner|winning_hypothesis|best_hypothesis|correct_hypothesis)\b/i.test(serialized), `Winner leaked in ${key}`);
      }
    });

    it('3.2 Zero scores, weights, priorities, confidence metrics, or probabilities', () => {
      for (const [key, artifact] of Object.entries(GRAPH_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        assert.ok(!/\b(score|weight|priority|confidence_score|likelihood_score)\b/i.test(serialized), `Score leaked in ${key}`);
      }
    });
  });

  describe('4. Generic 422 Error Surface & Prerequisite Shielding', () => {
    it('4.1 Premature access returns generic 422 with identical message across all routes', async () => {
      const session = sessionStore.createSession();
      const reqCtx = new RequestContext({ session });
      const expectedMessage = 'The available operational record does not establish the requested correlation context.';

      for (const route of canonicalRoutes) {
        await assert.rejects(
          async () => {
            await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
          },
          (err: any) => {
            assert.ok(err instanceof GraphNotEstablishedError);
            assert.equal(err.statusCode, 422);
            assert.equal(err.code, 'ERR_GRAPH_CONTEXT_NOT_ESTABLISHED');
            assert.equal(err.message, expectedMessage);
            return true;
          }
        );
      }
    });

    it('4.2 Error message does NOT leak missing prerequisite evidence IDs or route names', async () => {
      const session = sessionStore.createSession();
      const reqCtx = new RequestContext({ session });

      for (const route of canonicalRoutes) {
        try {
          await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
          assert.fail('Expected rejection');
        } catch (err: any) {
          assert.ok(!err.message.includes('EVD-'));
          assert.ok(!err.message.includes('sim://'));
          assert.ok(!err.message.includes('prerequisite'));
          assert.ok(!err.message.includes('missing'));
          assert.ok(!err.message.includes('graph'));
        }
      }
    });
  });

  describe('5. Serialization Safety & Internal Containment', () => {
    it('5.1 Artifacts serialize cleanly to JSON with no circular references', () => {
      for (const artifact of Object.values(GRAPH_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        const parsed = JSON.parse(serialized);
        assert.equal(parsed.artifactId, artifact.artifactId);
        assert.equal(parsed.classification, artifact.classification);
        assert.equal(parsed.version, artifact.version);
      }
    });

    it('5.2 Internal graph structures and models are NOT exported by src/modules/graph/index.ts', () => {
      const exportedKeys = Object.keys(GraphIndex);
      assert.ok(!exportedKeys.includes('INTERNAL_GRAPH'), 'INTERNAL_GRAPH must not be exported');
      assert.ok(!exportedKeys.includes('validateInternalGraph'), 'validateInternalGraph must not be exported');
      assert.ok(!exportedKeys.includes('InternalGraphNode'), 'InternalGraphNode must not be exported');
      assert.ok(!exportedKeys.includes('InternalGraphEdge'), 'InternalGraphEdge must not be exported');
      assert.ok(!exportedKeys.includes('InternalGraphDefinition'), 'InternalGraphDefinition must not be exported');

      // Check required public exports are present
      assert.ok(exportedKeys.includes('GraphModule'));
      assert.ok(exportedKeys.includes('GRAPH_ARTIFACTS'));
      assert.ok(exportedKeys.includes('GraphNotEstablishedError'));
      assert.ok(exportedKeys.includes('GraphConsistencyError'));
      assert.ok(exportedKeys.includes('validateGraphArtifacts'));
      assert.ok(exportedKeys.includes('KNOWN_GRAPH_EVIDENCE_IDS'));
    });
  });

  describe('6. Reasoning Difficulty & Cross-Domain Synthesis', () => {
    it('6.1 Single artifact insufficiency: no single fragment reveals full correlation topology', () => {
      const contextFrag = GRAPH_ARTIFACTS['context-fragment'];
      const corrFrag = GRAPH_ARTIFACTS['correlation-fragment'];
      const topFrag = GRAPH_ARTIFACTS['topology-fragment'];
      const convFrag = GRAPH_ARTIFACTS['convergence-fragment'];
      const reconFrag = GRAPH_ARTIFACTS['reconstruction-fragment'];

      // Each fragment has distinct contextual scopes and relational assertions
      assert.notEqual(contextFrag.content.contextual_scope, corrFrag.content.contextual_scope);
      assert.notEqual(topFrag.content.contextual_scope, convFrag.content.contextual_scope);
      assert.notEqual(reconFrag.content.contextual_scope, topFrag.content.contextual_scope);

      // Reconstruction requires references from earlier fragments
      assert.ok(reconFrag.content.associated_records.includes('EVD-GRAPH-03-TOPOLOGY'));
      assert.ok(reconFrag.content.associated_records.includes('EVD-GRAPH-04-CONVERGENCE'));
    });

    it('6.2 Full chain requires all 9 challenge modules for non-linear correlation', () => {
      const allCorrelated = new Set<string>();
      for (const artifact of Object.values(GRAPH_ARTIFACTS)) {
        for (const ref of artifact.correlatedEvidence) {
          allCorrelated.add(ref);
        }
      }

      // Check that evidence across multiple modules is referenced
      assert.ok(Array.from(allCorrelated).some((id) => id.startsWith('EVD-META-')));
      assert.ok(Array.from(allCorrelated).some((id) => id.startsWith('EVD-CFG-')));
      assert.ok(Array.from(allCorrelated).some((id) => id.startsWith('EVD-AUD-')));
      assert.ok(Array.from(allCorrelated).some((id) => id.startsWith('EVD-IDN-')));
      assert.ok(Array.from(allCorrelated).some((id) => id.startsWith('EVD-TRUST-')));
      assert.ok(Array.from(allCorrelated).some((id) => id.startsWith('EVD-TRANS-')));
      assert.ok(Array.from(allCorrelated).some((id) => id.startsWith('EVD-CONSTRAINT-')));
      assert.ok(Array.from(allCorrelated).some((id) => id.startsWith('EVD-INFER-')));
      assert.ok(Array.from(allCorrelated).some((id) => id.startsWith('EVD-GRAPH-')));
    });
  });
});
