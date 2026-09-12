import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { EvaluationModule } from '../../src/modules/evaluation/evaluation-module.js';
import { SimRouteRegistry } from '../../src/router/sim-registry.js';
import { RequestContext } from '../../src/context/request-context.js';
import { SessionRecord } from '../../src/session/session-store.js';
import { ChallengeSessionContext } from '../../src/session/session-context.js';

describe('Prompt 18 — Security Suite 8: Evaluation Oracle Resistance', () => {
  let evalModule: EvaluationModule;
  let mockContext: RequestContext;

  beforeEach(() => {
    process.env.ENCLAVE_FLAG = 'MOCK_FLAG{ORACLE_RESISTANCE_TEST_FLAG}';

    const registry = new SimRouteRegistry();
    evalModule = new EvaluationModule(registry);
    evalModule.initialize(new Map());

    const sessionContext = new ChallengeSessionContext();
    sessionContext.setNamespaceState('evaluation', {
      discoveredEvidence: new Set(['EVD-EVAL-05-SUBMISSION-CONTEXT']),
      accessCount: 1,
      lastAccessedEvaluation: 'EVD-EVAL-05-SUBMISSION-CONTEXT',
      submissionAttempts: 0,
      lastSubmissionStatus: null,
    }, 'evaluation');

    const mockSession: SessionRecord = {
      id: 'mock_session_oracle_test_1234567890123456',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      expiresAt: Date.now() + 60000,
      destroyed: false,
      context: sessionContext,
    };

    mockContext = new RequestContext({
      correlationId: 'test_oracle_corr',
      session: mockSession,
    });
  });

  const candidates = [
    { label: 'Empty candidate', value: '' },
    { label: 'Whitespace candidate', value: '     ' },
    { label: 'Random candidate', value: 'TOTALLY RANDOM GUESS 12345' },
    { label: 'Partial candidate', value: 'HYPERION ENCLAVE' },
    { label: 'Almost correct candidate', value: 'HYPERION ENCLAVE FABRIC RECONCILED UNDER HARDWARE INTEGRITY ANCHOR 889E' },
    { label: 'Special characters', value: '!@#$%^&*()_+' },
    { label: 'Prefix-only candidate', value: 'HYPERION ENCLAVE FABRIC RECONCILED' },
    { label: 'Suffix-only candidate', value: 'UNDER HARDWARE INTEGRITY ANCHOR 889F' },
  ];

  for (const c of candidates) {
    it(`Rejection produces semantically identical NOT_ACCEPTED for: ${c.label}`, async () => {
      const result = await evalModule.submitFinalInterpretation(mockContext, {
        interpretation: c.value,
      });

      // Status must be exactly NOT_ACCEPTED
      assert.equal(result.status, 'NOT_ACCEPTED');

      // Zero extra metadata
      const resObj = result as unknown as Record<string, unknown>;
      assert.equal(resObj.flag, undefined, 'Unaccepted submission must not leak flag');
      assert.equal(resObj.score, undefined, 'Must not return score');
      assert.equal(resObj.hint, undefined, 'Must not return hint');
      assert.equal(resObj.confidence, undefined, 'Must not return confidence');
      assert.equal(resObj.distance, undefined, 'Must not return distance');
      assert.equal(resObj.partial, undefined, 'Must not return partial correctness');
      assert.equal(resObj.matchedChars, undefined, 'Must not return matched character count');
      assert.equal(Object.keys(result).length, 1, 'Only "status" property must exist in response');
    });
  }
});
