import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { EvaluationModule } from '../../src/modules/evaluation/evaluation-module.js';
import { SimRouteRegistry } from '../../src/router/sim-registry.js';
import { RequestContext } from '../../src/context/request-context.js';
import { SessionRecord } from '../../src/session/session-store.js';
import { ChallengeSessionContext } from '../../src/session/session-context.js';
import { sanitizeConfigForInspection, validateProductionFlags } from '../../src/config/environment-validator.js';
import { ConfigValidationError } from '../../src/config/config.js';
import { ConfigurationError } from '../../src/errors/app-error.js';

describe('Prompt 18 — Security Suite 4: Flag Environment & Server-Only Containment', () => {
  let evalModule: EvaluationModule;
  let mockContext: RequestContext;

  beforeEach(() => {
    delete process.env.ENCLAVE_FLAG;
    delete process.env.CHALLENGE_FLAG;

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
      id: 'mock_session_flag_env_testing_1234567890123456',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      expiresAt: Date.now() + 60000,
      destroyed: false,
      context: sessionContext,
    };

    mockContext = new RequestContext({
      correlationId: 'test_flag_env_corr',
      session: mockSession,
    });
  });

  it('1. Production flag strictly comes from the server environment', async () => {
    process.env.ENCLAVE_FLAG = 'MOCK_FLAG{VERIFIED_FROM_SERVER_ENV_ONLY}';

    const result = await evalModule.submitFinalInterpretation(mockContext, {
      interpretation: 'HYPERION ENCLAVE FABRIC RECONCILED UNDER HARDWARE INTEGRITY ANCHOR 889F',
    });

    assert.equal(result.status, 'ACCEPTED');
    assert.equal(result.flag, 'MOCK_FLAG{VERIFIED_FROM_SERVER_ENV_ONLY}');
  });

  it('2. Zero fallback flag exists: missing ENCLAVE_FLAG fails safely with ConfigurationError', async () => {
    delete process.env.ENCLAVE_FLAG;
    delete process.env.CHALLENGE_FLAG;

    await assert.rejects(
      () => {
        return evalModule.submitFinalInterpretation(mockContext, {
          interpretation: 'HYPERION ENCLAVE FABRIC RECONCILED UNDER HARDWARE INTEGRITY ANCHOR 889F',
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ConfigurationError);
        assert.equal(err.message, 'Required server configuration is unavailable.');
        return true;
      }
    );
  });

  it('3. Server refuses production mode startup when ENCLAVE_FLAG is absent', () => {
    delete process.env.ENCLAVE_FLAG;
    delete process.env.CHALLENGE_FLAG;

    assert.throws(
      () => validateProductionFlags('production'),
      ConfigValidationError
    );
  });

  it('4. Flag is never serialized into diagnostic inspection configs', () => {
    const dirtyConfig = {
      enclave_flag: 'MOCK_FLAG{LEAKED_FLAG}',
      system_flag: 'FLAG{SECRET}',
      production_mode: true,
    };

    const clean = sanitizeConfigForInspection(dirtyConfig);
    assert.equal(clean.enclave_flag, undefined);
    assert.equal(clean.system_flag, undefined);
    assert.equal(clean.production_mode, true);
  });

  it('5. Flag is never stored in session state before or after evaluation', async () => {
    process.env.ENCLAVE_FLAG = 'MOCK_FLAG{SESSION_ISOLATION_TEST_FLAG}';

    await evalModule.submitFinalInterpretation(mockContext, {
      interpretation: 'HYPERION ENCLAVE FABRIC RECONCILED UNDER HARDWARE INTEGRITY ANCHOR 889F',
    });

    const session = mockContext.session?.context;
    const namespaces = session?.getActiveNamespaces() ?? [];
    for (const ns of namespaces) {
      const state = session?.getNamespaceState(ns);
      const serialized = JSON.stringify(state);
      assert(!serialized.includes('MOCK_FLAG{SESSION_ISOLATION_TEST_FLAG}'), `Namespace ${ns} state must never store the flag`);
    }
  });
});
