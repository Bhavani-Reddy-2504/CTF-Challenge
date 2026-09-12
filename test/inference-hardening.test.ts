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
} from '../src/modules/inference/inference-types.js';
import * as InferenceIndex from '../src/modules/inference/index.js';
import { MetadataModule } from '../src/modules/metadata/metadata-module.js';
import { TransitionModule } from '../src/modules/transition/transition-module.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { SessionRecord, SessionStore } from '../src/session/session-store.js';

describe('Prompt 10: Multi-Domain Inference Engine Hardening & Leakage Prevention (Hardening)', () => {
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

  function enableAllInferenceAccess(session: SessionRecord): void {
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
  // 1. Information Leakage Prevention
  // =========================================================================
  it('1. Zero BPCTF{ flag material in any inference response', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!serialized.includes('BPCTF{'));
    }
  });

  it('2. Zero credentials, passwords, private keys, or API tokens leak', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/\b(password|private_key|secret_key|api_key|access_token|refresh_token|bearer)\b/i.test(serialized));
    }
  });

  it('3. Zero authentication mechanisms (jwt, oauth, oidc, saml) leak', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/\b(jwt|oauth|oidc|saml)\b/i.test(serialized));
    }
  });

  it('4. Zero authorization grants, roles, or permission matrices leak', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/\b(rbac|abac|grant_role|assign_permission|policy_binding)\b/i.test(serialized));
    }
  });

  it('5. Zero execution capabilities or denial semantics leak', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/\b(EXECUTION_BLOCKED|REVOKED_FOR_EXECUTION|ACCESS_DENIED|PERMISSION_REVOKED)\b/i.test(serialized));
    }
  });

  it('6. Zero real-world cloud technology names leak', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/\b(aws|amazon web services|azure|gcp|google cloud|kubernetes|k8s|docker)\b/i.test(serialized));
    }
  });

  it('7. Zero SPIFFE / SPIRE / SVID terminology leaks', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/\b(spiffe|spire|svid)\b/i.test(serialized));
    }
  });

  it('8. Zero challenge meta-language leaks', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/prompt\s*\d+|phase\s*\d+|subsequent\s+phase|next\s+stage|flag\s+location|the\s+solution\s+is/i.test(serialized));
    }
  });

  // =========================================================================
  // 2. Boolean Oracle Prevention
  // =========================================================================
  it('9. Recursively verify zero Boolean values in player-visible content', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    function assertNoBooleansRecursive(val: unknown, path: string): void {
      if (val === null || val === undefined) return;
      assert.notEqual(typeof val, 'boolean', `Found boolean at path '${path}'`);
      if (Array.isArray(val)) {
        val.forEach((item, idx) => assertNoBooleansRecursive(item, `${path}[${idx}]`));
      } else if (typeof val === 'object') {
        for (const [k, v] of Object.entries(val)) {
          assertNoBooleansRecursive(v, `${path}.${k}`);
        }
      }
    }

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const data = res.data as EvidenceResponse;
      assertNoBooleansRecursive(data.evidence.content, route);
    }
  });

  it('10. No correct or valid Boolean fields in player-visible response', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/"correct"\s*:\s*(true|false)/i.test(serialized));
      assert(!/"valid"\s*:\s*(true|false)/i.test(serialized));
      assert(!/"matches"\s*:\s*(true|false)/i.test(serialized));
      assert(!/"consistent"\s*:\s*(true|false)/i.test(serialized));
      assert(!/"selected"\s*:\s*(true|false)/i.test(serialized));
      assert(!/"resolved"\s*:\s*(true|false)/i.test(serialized));
    }
  });

  it('11. No indirect acceptance states in model responses', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/model_state\s*:\s*ACCEPTED/i.test(serialized));
      assert(!/resolution_status\s*:\s*RESOLVED/i.test(serialized));
    }
  });

  // =========================================================================
  // 3. Ranking, Scoring & Weight Defense
  // =========================================================================
  it('12. No scores, numerical weights, or rankings in player-visible artifacts', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/\b(score|scores|likelihood_score|confidence_score)\b/i.test(serialized));
      assert(!/\b(rank|ranking|model_ranking|precedence_rank)\b/i.test(serialized));
      assert(!/\b(weight|weights|interpretation_weight)\b/i.test(serialized));
      assert(!/\b(priority|priorities|semantic_priority)\b/i.test(serialized));
    }
  });

  it('13. No probability, likelihood, or percentage values in player-visible artifacts', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/\b(probability|likelihood|percentage)\b/i.test(serialized));
    }
  });

  // =========================================================================
  // 4. Resolution & Winner Leakage Defense
  // =========================================================================
  it('14. No winner, winning_hypothesis, or best_hypothesis in any artifact', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/\b(winner|winning_hypothesis|best_hypothesis|winning_model|best_model)\b/i.test(serialized));
      assert(!/\b(winner_index|correct_model_id|selection_algorithm)\b/i.test(serialized));
    }
  });

  it('15. No direct answer or solution fields exist in responses', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      assert(!/"answer"\s*:/i.test(serialized));
      assert(!/"solution"\s*:/i.test(serialized));
      assert(!/"winning_hypothesis"\s*:/i.test(serialized));
    }
  });

  // =========================================================================
  // 5. Controlled Ambiguity & Difficulty
  // =========================================================================
  it('16. No single inference artifact is sufficient to deduce full enclave state', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const res = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const serialized = JSON.stringify(res);
      // Verify no single artifact contains all 4 model dimensions
      const mentionsAll =
        serialized.includes('MODEL-SPEC-') &&
        serialized.includes('MODEL-LINEAGE-') &&
        serialized.includes('MODEL-BOUNDARY-') &&
        serialized.includes('MODEL-RECON-');
      if (route !== 'sim://inference/convergence') {
        assert(!mentionsAll, `Artifact at ${route} should not contain all dimensions.`);
      }
    }
  });

  it('17. Artifact ID ordering does not reveal correctness (01 is not preferred over 02)', () => {
    const art1 = INFERENCE_ARTIFACTS['specification-model'];
    const art2 = INFERENCE_ARTIFACTS['lineage-model'];
    assert.equal(art1.version, art2.version);
    assert.equal(art1.status, art2.status);
    assert.equal(art1.relevance, art2.relevance);
  });

  it('18. Version sorting is insufficient (all share 1.0.0)', () => {
    const versions = Object.values(INFERENCE_ARTIFACTS).map((a) => a.version);
    assert(versions.every((v) => v === '1.0.0'));
  });

  it('19. Status sorting is insufficient (all share ACTIVE)', () => {
    const statuses = Object.values(INFERENCE_ARTIFACTS).map((a) => a.status);
    assert(statuses.every((s) => s === 'ACTIVE'));
  });

  // =========================================================================
  // 6. Internal Containment & Export Surface
  // =========================================================================
  it('20. Internal evaluator, candidate resolution, or matrices are not exported in module index', () => {
    const exports = Object.keys(InferenceIndex);
    assert(!exports.includes('internalResolutionMatrix'));
    assert(!exports.includes('candidateScores'));
    assert(!exports.includes('modelRanking'));
    assert(!exports.includes('selectionAlgorithm'));
    assert(!exports.includes('winnerIndex'));
    assert(!exports.includes('correctModelId'));
  });

  it('21. JSON.stringify() of response includes only canonical evidence fields', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    const res = await engine.dispatch(parseSimRoute('sim://inference/convergence'), 'READ', reqCtx);
    const data = res.data as EvidenceResponse;

    const allowedTopLevel = new Set(['status', 'evidence']);
    for (const key of Object.keys(data)) {
      assert(allowedTopLevel.has(key));
    }

    const allowedEvidenceKeys = new Set([
      'id',
      'source',
      'classification',
      'version',
      'status',
      'correlation_references',
      'content',
    ]);
    for (const key of Object.keys(data.evidence)) {
      assert(allowedEvidenceKeys.has(key));
    }
  });

  // =========================================================================
  // 7. Error Surface Hardening
  // =========================================================================
  it('22. InferenceNotEstablishedError status is 422 and code is ERR_INFERENCE_NOT_ESTABLISHED', () => {
    const err = new InferenceNotEstablishedError();
    assert.equal(err.statusCode, 422);
    assert.equal(err.code, 'ERR_INFERENCE_NOT_ESTABLISHED');
    assert.equal(
      err.message,
      'The available operational record does not establish an inference context.'
    );
  });

  it('23. Errors do not leak missing prerequisite route names, evidence IDs, or transition states', () => {
    const err = new InferenceNotEstablishedError();
    const serialized = JSON.stringify({
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
    });

    assert(!serialized.includes('EVD-'));
    assert(!serialized.includes('sim://'));
    assert(!serialized.includes('RECONCILED'));
    assert(!serialized.includes('prerequisites'));
    assert(!serialized.includes('stack'));
  });

  // =========================================================================
  // 8. Determinism & Non-Dependence
  // =========================================================================
  it('24. Results do not depend on timestamps or system clock', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    const res1 = await engine.dispatch(parseSimRoute('sim://inference/convergence'), 'READ', reqCtx);
    const res2 = await engine.dispatch(parseSimRoute('sim://inference/convergence'), 'READ', reqCtx);

    assert.deepEqual(res1, res2);
  });

  it('25. Results do not depend on randomness (deterministic payloads)', async () => {
    const session = sessionStore.createSession();
    enableAllInferenceAccess(session);
    const reqCtx = new RequestContext({ session });

    for (const route of canonicalRoutes) {
      const resA = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      const resB = await engine.dispatch(parseSimRoute(route), 'READ', reqCtx);
      assert.deepEqual(resA, resB);
    }
  });

  // =========================================================================
  // 9. Full Engine Initialization Regression
  // =========================================================================
  it('26. ChallengeEngine initializes cleanly with all 8 modules active and locked', () => {
    assert(engine.isReady());
    assert(routeRegistry.isLocked());
    assert(moduleRegistry.isLocked());

    const activeModules = [
      'metadata',
      'audit',
      'config',
      'identity',
      'trust',
      'transition',
      'constraint',
      'inference',
    ];

    for (const modId of activeModules) {
      assert(moduleRegistry.has(modId as any));
    }
  });
});
