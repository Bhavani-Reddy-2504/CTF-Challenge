import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { ApplicationInstance, bootstrapApplication } from '../../src/bootstrap.js';
import { EvaluationModule } from '../../src/modules/evaluation/evaluation-module.js';
import { SimRouteRegistry } from '../../src/router/sim-registry.js';
import { RequestContext } from '../../src/context/request-context.js';
import { SessionRecord } from '../../src/session/session-store.js';
import { ChallengeSessionContext } from '../../src/session/session-context.js';

describe('Category 9: Evaluation Security & Oracle Resistance', () => {
  let app: ApplicationInstance;
  let baseUrl: string;
  let sessionCookie: string;

  before(async () => {
    app = await bootstrapApplication({
      environment: 'test',
      port: 0,
      cookieSecure: false,
    });
    await app.server.start();
    const port = app.server.getPort();
    baseUrl = `http://127.0.0.1:${port}`;

    // Initialize an active test session
    const initRes = await fetch(`${baseUrl}/api/v1/session/init`, { method: 'POST' });
    sessionCookie = initRes.headers.get('set-cookie') ?? '';
  });

  beforeEach(() => {
    app.server.rateLimiter.reset();
  });

  after(async () => {
    await app.shutdown();
  });

  it('1. Ungated evaluation attempts produce uniform 422 error without leaking prerequisites', async () => {
    const res = await fetch(`${baseUrl}/api/v1/evaluation/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ interpretation: 'SOME CANDIDATE GUESS' }),
    });

    assert.equal(res.status, 422);
    const data = await res.json();
    assert.equal(data.code, 'ERR_EVALUATION_CONTEXT_NOT_ESTABLISHED');

    const serialized = JSON.stringify(data);
    assert(!serialized.includes('EVD-'), 'Response must not leak prerequisite evidence IDs');
    assert(!serialized.includes('prerequisite'), 'Response must not leak prerequisite terminology');
    assert(!serialized.includes('resolution'), 'Response must not leak module dependencies');
  });

  describe('Black-Box Evaluation Oracle Resistance (Mock Established Context)', () => {
    let evalModule: EvaluationModule;
    let mockContext: RequestContext;
    let sessionContext: ChallengeSessionContext;

    before(() => {
      const registry = new SimRouteRegistry();
      evalModule = new EvaluationModule(registry);
      evalModule.initialize(new Map());

      sessionContext = new ChallengeSessionContext();
      // Establish required submission context evidence
      sessionContext.setNamespaceState('evaluation', {
        discoveredEvidence: new Set(['EVD-EVAL-05-SUBMISSION-CONTEXT']),
        accessCount: 1,
        lastAccessedEvaluation: 'EVD-EVAL-05-SUBMISSION-CONTEXT',
        submissionAttempts: 0,
        lastSubmissionStatus: null,
        cooldownUntil: 0,
        lastSubmissionTimestamp: 0,
      }, 'evaluation');

      const mockSession: SessionRecord = {
        id: 'mock_session_id_for_black_box_testing_12345678',
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        expiresAt: Date.now() + 60000,
        destroyed: false,
        context: sessionContext,
      };

      mockContext = new RequestContext({
        correlationId: 'test_blackbox_corr',
        session: mockSession,
      });
    });

    // Reset cooldown after each test so exponential backoff from one test
    // does not block the next iteration (tests share a session by design)
    afterEach(() => {
      const st = sessionContext.getNamespaceState<Record<string, unknown>>('evaluation');
      if (st) {
        sessionContext.setNamespaceState('evaluation', { ...st, cooldownUntil: 0, submissionAttempts: 0 }, 'evaluation');
      }
    });

    const invalidInputs = [
      { label: 'Random invalid submission', value: 'RANDOM GUESS FABRIC NOT REAL' },
      { label: 'Empty string submission', value: '' },
      { label: 'Whitespace submission', value: '     ' },
      { label: 'Partial guess', value: 'HYPERION ENCLAVE' },
      { label: 'Different casing', value: 'hyperion enclave fabric reconciled' },
      { label: 'Special characters', value: '!@#$%^&*()_+' },
      { label: 'Structured guess', value: 'FLAG{TEST_GUESS}' },
      { label: 'Numbers only', value: '1234567890 889F' },
    ];

    for (const item of invalidInputs) {
      it(`Uniform failure for: ${item.label}`, async () => {
        const result = await evalModule.submitFinalInterpretation(mockContext, {
          interpretation: item.value,
        });

        // 1. Must produce exactly uniform status
        assert.equal(result.status, 'NOT_ACCEPTED');

        // 2. Oracle resistance: zero scores, rankings, distances, or flags
        const resObj = result as unknown as Record<string, unknown>;
        assert.equal(resObj.flag, undefined, 'Unsuccessful evaluation must not leak flag');
        assert.equal(resObj.score, undefined, 'No score property must exist');
        assert.equal(resObj.similarity, undefined, 'No similarity property must exist');
        assert.equal(resObj.distance, undefined, 'No distance property must exist');
        assert.equal(resObj.correct_chars, undefined, 'No character match info must exist');
        assert.equal(resObj.expected, undefined, 'No expected value must exist');
        assert.equal(resObj.hint, undefined, 'No hints must exist');
      });
    }

    it('Rejects oversized submissions with BadRequestError', async () => {
      const hugeString = 'A'.repeat(5000);
      await assert.rejects(
        () => evalModule.submitFinalInterpretation(mockContext, { interpretation: hugeString }),
        /Submission exceeds maximum allowed length/
      );
    });

    it('Rejects malformed submission shapes with BadRequestError', async () => {
      const badShapes = [
        null,
        undefined,
        {},
        { wrong_field: 'value' },
        { interpretation: 123 },
        { interpretation: null },
        { interpretation: [] },
      ];

      for (const shape of badShapes) {
        await assert.rejects(
          () => evalModule.submitFinalInterpretation(mockContext, shape),
          /Invalid submission format/
        );
      }
    });
  });
});
