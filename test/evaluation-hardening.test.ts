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
import { EVALUATION_ARTIFACTS } from '../src/modules/evaluation/evaluation-artifacts.js';
import { EvaluationModule } from '../src/modules/evaluation/evaluation-module.js';
import { assertNoBooleansRecursively } from '../src/modules/evaluation/evaluation-validator.js';
import * as EvaluationModuleExports from '../src/modules/evaluation/index.js';
import { GraphModule } from '../src/modules/graph/graph-module.js';
import { IdentityModule } from '../src/modules/identity/identity-module.js';
import { InferenceModule } from '../src/modules/inference/inference-module.js';
import { MetadataModule } from '../src/modules/metadata/metadata-module.js';
import { ResolutionModule } from '../src/modules/resolution/resolution-module.js';
import { SynthesisModule } from '../src/modules/synthesis/synthesis-module.js';
import { TransitionModule } from '../src/modules/transition/transition-module.js';
import { TrustModule } from '../src/modules/trust/trust-module.js';
import { parseSimRoute } from '../src/router/sim-parser.js';
import { SimRouteRegistry } from '../src/router/sim-registry.js';
import { SessionRecord, SessionStore } from '../src/session/session-store.js';

describe('Prompt 14: Evaluation & Submission Hardening (Information Leakage & Oracle Defense)', () => {
  let moduleRegistry: ModuleRegistry;
  let routeRegistry: SimRouteRegistry;
  let engine: ChallengeEngine;
  let sessionStore: SessionStore;

  function enableSubmissionPrerequisites(session: SessionRecord): void {
    session.context.setNamespaceState(
      'evaluation',
      {
        discoveredEvidence: new Set([
          'EVD-EVAL-01-STRUCTURAL',
          'EVD-EVAL-02-HISTORICAL',
          'EVD-EVAL-03-ENVIRONMENTAL',
          'EVD-EVAL-04-RELATIONAL',
        ]),
        accessCount: 4,
        lastAccessedEvaluation: 'EVD-EVAL-04-RELATIONAL',
        submissionAttempts: 0,
        lastSubmissionStatus: null,
        cooldownUntil: 0,
        lastSubmissionTimestamp: 0,
      },
      'evaluation'
    );
    session.context.setNamespaceState(
      'resolution',
      {
        discoveredEvidence: new Set([
          'EVD-RES-01-STRUCTURAL',
          'EVD-RES-02-HISTORICAL',
          'EVD-RES-03-ENVIRONMENTAL',
          'EVD-RES-04-RELATIONAL',
          'EVD-RES-05-CONTEXT',
        ]),
      },
      'resolution'
    );
    session.context.setNamespaceState(
      'synthesis',
      {
        discoveredEvidence: new Set([
          'EVD-SYNTH-01-SPECIFICATION',
          'EVD-SYNTH-02-LINEAGE',
          'EVD-SYNTH-03-BOUNDARY',
          'EVD-SYNTH-04-RELATIONAL',
          'EVD-SYNTH-05-MULTI-PERSPECTIVE',
        ]),
      },
      'synthesis'
    );
    session.context.setNamespaceState(
      'graph',
      {
        discoveredEvidence: new Set([
          'EVD-GRAPH-01-CONTEXT',
          'EVD-GRAPH-02-CORRELATION',
          'EVD-GRAPH-03-TOPOLOGY',
          'EVD-GRAPH-04-CONVERGENCE',
          'EVD-GRAPH-05-RECONSTRUCTION',
        ]),
      },
      'graph'
    );
    session.context.setNamespaceState(
      'inference',
      {
        discoveredEvidence: new Set([
          'EVD-INFER-01-SPECIFICATION',
          'EVD-INFER-02-LINEAGE',
          'EVD-INFER-03-BOUNDARY',
          'EVD-INFER-04-RECONCILIATION',
          'EVD-INFER-05-CONVERGENCE',
        ]),
      },
      'inference'
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
    moduleRegistry.register(new EvaluationModule(routeRegistry));

    engine = new ChallengeEngine(moduleRegistry, { routeRegistry });
    await engine.initialize();
  });

  afterEach(() => {
    sessionStore.shutdown();
  });

  describe('A. Zero Information Leakage & Secret Material', () => {
    it('1. Artifacts and responses contain zero flag patterns or credentials', async () => {
      const forbiddenPatterns = [
        /BREACH\{/i,
        /BPCTF\{/i,
        /flag\{/i,
        /FLAG\{/i,
        /ctf\{/i,
        /\bpassword\b/i,
        /\bprivate_key\b/i,
        /\bsecret_key\b/i,
        /\bapi_key\b/i,
        /\bbearer\b/i,
      ];

      for (const [, artifact] of Object.entries(EVALUATION_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        for (const pat of forbiddenPatterns) {
          assert.ok(
            !pat.test(serialized),
            `Leakage detected for pattern ${pat} in artifact ${artifact.artifactId}`
          );
        }
      }
    });

    it('2. Player-visible evidence contains zero cloud or container technology terms', () => {
      const techPatterns = [
        /\baws\b/i,
        /\bazure\b/i,
        /\bgcp\b/i,
        /\bkubernetes\b/i,
        /\bk8s\b/i,
        /\bdocker\b/i,
        /\bec2\b/i,
        /\bs3\b/i,
        /\bspiffe\b/i,
        /\bspire\b/i,
        /\bsvid\b/i,
      ];

      for (const [, artifact] of Object.entries(EVALUATION_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        for (const pat of techPatterns) {
          assert.ok(
            !pat.test(serialized),
            `Cloud/container leakage ${pat} in artifact ${artifact.artifactId}`
          );
        }
      }
    });
  });

  describe('B. Expected Answer & Evaluator Secrecy', () => {
    it('3. Public exports from evaluation index do not leak evaluator or expected values', () => {
      const exportedKeys = Object.keys(EvaluationModuleExports);
      const forbiddenExportKeywords = [
        'EXPECTED',
        'CANONICAL_INTERPRETATION',
        'ACCEPTANCE',
        'RULE',
        'EVALUATOR_MODEL',
        'CONDITION',
      ];

      for (const key of exportedKeys) {
        for (const kw of forbiddenExportKeywords) {
          assert.ok(
            !key.toUpperCase().includes(kw),
            `Exported key '${key}' leaks private internal evaluator semantics`
          );
        }
      }
    });

    it('4. No single artifact explicitly provides the final accepted interpretation', () => {
      for (const [, artifact] of Object.entries(EVALUATION_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact.content);
        const target = Buffer.from('TUlTU0lOR19TQU1QTEVfQkFTRTY0X1NUUklOR19OT1RfVEhFX1JFQUxfQU5TV0VS', 'base64').toString('utf8');
        assert.ok(
          !serialized.includes(target),
          `Artifact ${artifact.artifactId} contains the complete literal accepted interpretation`
        );
      }
    });
  });

  describe('C. Boolean Oracle Defense', () => {
    it('5. Artifact content recursively contains zero boolean values', () => {
      for (const [key, artifact] of Object.entries(EVALUATION_ARTIFACTS)) {
        assertNoBooleansRecursively(artifact.content, `EVALUATION_ARTIFACTS[${key}].content`);
      }
    });

    it('6. Evidence responses recursively contain zero boolean values', async () => {
      const session = sessionStore.createSession();
      enableSubmissionPrerequisites(session);
      const context = new RequestContext({ session });

      const route = parseSimRoute('sim://evaluation/submission-context');
      const res = await engine.dispatch(route, 'READ', context);
      const payload = res.data as EvidenceResponse;

      assertNoBooleansRecursively(payload, 'EvidenceResponse');
    });

    it('7. EvaluationResult responses contain zero boolean values', async () => {
      const session = sessionStore.createSession();
      enableSubmissionPrerequisites(session);
      const context = new RequestContext({ session });

      const route = parseSimRoute('sim://evaluation/submission-context');
      await engine.dispatch(route, 'READ', context);

      const result = await engine.submitFinalInterpretation(context, { interpretation: 'sample guess' });
      assertNoBooleansRecursively(result, 'EvaluationResult');
    });
  });

  describe('D. Partial-Match & Scoring Defense', () => {
    it('8. Zero scoring, ranking, or confidence terms in artifact content or responses', () => {
      const forbiddenScoringTerms = [
        /\bscore\b/i,
        /\bscores\b/i,
        /\bscoring\b/i,
        /\bpercentage\b/i,
        /\bweight\b/i,
        /\bpriority\b/i,
        /\brank\b/i,
        /\branking\b/i,
        /\bconfidence\b/i,
        /\bprobability\b/i,
        /\blikelihood\b/i,
      ];

      for (const [, artifact] of Object.entries(EVALUATION_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact.content);
        for (const term of forbiddenScoringTerms) {
          assert.ok(
            !term.test(serialized),
            `Scoring term ${term} leaked in artifact content ${artifact.artifactId}`
          );
        }
      }
    });

    it('9. Zero partial-match or differential feedback across various invalid inputs', async () => {
      const session = sessionStore.createSession();
      enableSubmissionPrerequisites(session);
      const context = new RequestContext({ session });

      const route = parseSimRoute('sim://evaluation/submission-context');
      await engine.dispatch(route, 'READ', context);

      const variedInputs = [
        'random junk candidate string',
        'hyperion enclave fabric partial',
        'hyperion enclave fabric reconciled wrong hardware',
        '     ',
        'completely different terminology',
        'almost valid candidate with typo',
      ];

      // Submit sequentially, resetting backoff between each to test oracle resistance in isolation
      for (const text of variedInputs) {
        const resp = await engine.submitFinalInterpretation(context, { interpretation: text });
        assert.deepEqual(resp, { status: 'NOT_ACCEPTED' });
        assert.equal(Object.keys(resp).length, 1);
        // Reset cooldown so backoff from this wrong answer doesn't block the next test case
        const st = session.context.getNamespaceState<Record<string, unknown>>('evaluation');
        if (st) session.context.setNamespaceState('evaluation', { ...st, cooldownUntil: 0, submissionAttempts: 0 }, 'evaluation');
      }
    });
  });

  describe('E. Winner, Solution & Answer Terms Defense', () => {
    it('10. Artifacts do not declare winners, final solutions, or solution paths', () => {
      const forbiddenWinnerTerms = [
        /\bwinner\b/i,
        /\bwinning\b/i,
        /\bchampion\b/i,
        /\bexpected_answer\b/i,
        /\bcorrect_answer\b/i,
        /\bfinal_answer\b/i,
        /\bsolution_path\b/i,
        /\bfinal_solution\b/i,
      ];

      for (const [, artifact] of Object.entries(EVALUATION_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        for (const term of forbiddenWinnerTerms) {
          assert.ok(
            !term.test(serialized),
            `Winner/solution term ${term} leaked in artifact ${artifact.artifactId}`
          );
        }
      }
    });
  });

  describe('F. No Future Roadmap or Prompt Leakage', () => {
    it('11. Zero Prompt 15 or phase roadmap references exist', () => {
      const roadmapPatterns = [
        /\bprompt\s*15\b/i,
        /\bphase\s*15\b/i,
        /\bstage\s*15\b/i,
        /\broadmap\b/i,
        /\bupcoming\b/i,
        /\bnext\s*module\b/i,
      ];

      for (const [, artifact] of Object.entries(EVALUATION_ARTIFACTS)) {
        const serialized = JSON.stringify(artifact);
        for (const pat of roadmapPatterns) {
          assert.ok(
            !pat.test(serialized),
            `Roadmap leakage ${pat} in artifact ${artifact.artifactId}`
          );
        }
      }
    });
  });

  describe('G. Serialization & Determinism', () => {
    it('12. JSON serialization produces clean output without internal symbols or getters', () => {
      for (const [, artifact] of Object.entries(EVALUATION_ARTIFACTS)) {
        const parsed = JSON.parse(JSON.stringify(artifact));
        assert.equal(parsed.source, 'evaluation');
        assert.equal(parsed.authority_conferred, false);
        assert.equal(parsed.status, 'ACTIVE');
        assert.ok(parsed.content);
      }
    });

    it('13. Repeated evaluations and route accesses are perfectly deterministic', async () => {
      const session = sessionStore.createSession();
      enableSubmissionPrerequisites(session);
      const context = new RequestContext({ session });

      const route = parseSimRoute('sim://evaluation/submission-context');
      const res1 = await engine.dispatch(route, 'READ', context);
      const res2 = await engine.dispatch(route, 'READ', context);

      assert.deepEqual(res1.data, res2.data);

      const eval1 = await engine.submitFinalInterpretation(context, { interpretation: 'test candidate' });
      // Reset cooldown between calls so backoff doesn't block second call
      const evalState = session.context.getNamespaceState<{ discoveredEvidence: ReadonlySet<string>; accessCount: number; lastAccessedEvaluation: string | null; submissionAttempts: number; lastSubmissionStatus: string | null; cooldownUntil: number; lastSubmissionTimestamp: number }>('evaluation');
      if (evalState) {
        session.context.setNamespaceState('evaluation', { ...evalState, cooldownUntil: 0 }, 'evaluation');
      }
      const eval2 = await engine.submitFinalInterpretation(context, { interpretation: 'test candidate' });
      assert.deepEqual(eval1, eval2);
    });
  });

  describe('H. Fairness Guarantees', () => {
    it('14. Submission readiness does not imply correctness', async () => {
      const session = sessionStore.createSession();
      enableSubmissionPrerequisites(session);
      const context = new RequestContext({ session });

      const route = parseSimRoute('sim://evaluation/submission-context');
      const res = await engine.dispatch(route, 'READ', context);
      assert.equal(res.status, 'success');

      // Being ready to submit does NOT automatically accept invalid or incomplete guesses
      const testResult = await engine.submitFinalInterpretation(context, { interpretation: 'arbitrary attempt' });
      assert.equal(testResult.status, 'NOT_ACCEPTED');
    });
  });
});
