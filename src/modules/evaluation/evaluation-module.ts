import { createHash, timingSafeEqual } from 'node:crypto';
import { RequestContext } from '../../context/request-context.js';
import { IChallengeModule, ModuleId } from '../../engine/module-contract.js';
import { BadRequestError, ConfigurationError, RateLimitExceededError } from '../../errors/app-error.js';
import { formatEvidenceResponse } from '../../evidence/evidence-types.js';
import { SimHandlerContext } from '../../router/sim-handler.js';
import { parseSimRoute } from '../../router/sim-parser.js';
import { SimRouteRegistry } from '../../router/sim-registry.js';
import { GraphSessionState } from '../graph/graph-types.js';
import { InferenceSessionState } from '../inference/inference-types.js';
import { ResolutionSessionState } from '../resolution/resolution-types.js';
import { SynthesisSessionState } from '../synthesis/synthesis-types.js';
import { TransitionSessionState } from '../transition/transition-types.js';
import { EVALUATION_ARTIFACTS } from './evaluation-artifacts.js';
import {
  EvaluationNotEstablishedError,
  EvaluationResult,
  EvaluationSessionState,
  EvaluationStatus,
} from './evaluation-types.js';
import { validateEvaluationArtifacts } from './evaluation-validator.js';

function hasEvidence(discovered: unknown, id: string): boolean {
  if (!discovered) return false;
  if (discovered instanceof Set) return discovered.has(id);
  if (Array.isArray(discovered)) return discovered.includes(id);
  return false;
}

/**
 * Cryptographic SHA-256 preimages for verified enclave interpretations.
 * One-way hashed to prevent source code, decompilation, and LLM leakage.
 */
const CANONICAL_INTERPRETATION_HASHES: ReadonlySet<string> = new Set<string>([
  '8dffab8c9cdc19062e7167ba76a405bb1fc0bd3748fb643f9fa31846b5f44f66',
  '0a553039094c7af9a35d3d71ae02b9b186c3bf39ea7cad9efe84ef1de98ab901',
  '2f76d07eff418a2231deaf2767be6173f05dadaa29b544db7b311225c4278c2b',
  '2d98c4059cb0cee6c627d58d60e8538747ba18fbb5f938442cb9fa28817516da',
]);

/**
 * Resolves the canonical CTF flag strictly from the trusted server environment.
 * Refuses to operate if no flag is provided in the server environment.
 * Contains zero fallback flags, zero flag prefixes, and zero obfuscation arrays.
 */
function deriveEnclaveFlag(): string {
  const flag = process.env.ENCLAVE_FLAG || process.env.CHALLENGE_FLAG;
  if (typeof flag !== 'string' || flag.trim().length === 0) {
    throw new ConfigurationError('Required server configuration is unavailable.');
  }
  return flag.trim();
}

/**
 * EvaluationModule implements the Controlled Final Evaluation &
 * Server-Side Submission Verification Layer.
 *
 * Provides a black-box verification boundary that receives and evaluates
 * candidate final submissions without leaking expected answers, partial matches,
 * scores, or flags.
 */
export class EvaluationModule implements IChallengeModule {
  public readonly id: ModuleId = 'evaluation';
  public readonly version = '1.0.0';
  public readonly requiredDependencies: readonly ModuleId[] = Object.freeze([
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
    'resolution',
  ]);
  private readonly routeRegistry: SimRouteRegistry;

  constructor(routeRegistry: SimRouteRegistry) {
    this.routeRegistry = routeRegistry;
  }

  public initialize(_dependencies: ReadonlyMap<ModuleId, IChallengeModule>): void {
    // 1. Validate canonical artifacts and anti-leakage constraints
    validateEvaluationArtifacts(EVALUATION_ARTIFACTS);

    // 2. Register exactly five canonical symbolic routes
    for (const [segment, artifact] of Object.entries(EVALUATION_ARTIFACTS)) {
      const route = parseSimRoute(`sim://evaluation/${segment}`);

      this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
        if (!context.sessionContext) {
          throw new EvaluationNotEstablishedError();
        }

        const session = context.sessionContext;

        // Server-side discovery gating
        switch (segment) {
          case 'structural-readiness': {
            const res = session.getNamespaceState<ResolutionSessionState>('resolution');
            const synth = session.getNamespaceState<SynthesisSessionState>('synthesis');
            const graph = session.getNamespaceState<GraphSessionState>('graph');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');

            if (
              !hasEvidence(res?.discoveredEvidence, 'EVD-RES-01-STRUCTURAL') ||
              !hasEvidence(synth?.discoveredEvidence, 'EVD-SYNTH-01-SPECIFICATION') ||
              !hasEvidence(graph?.discoveredEvidence, 'EVD-GRAPH-03-TOPOLOGY') ||
              !hasEvidence(infer?.discoveredEvidence, 'EVD-INFER-01-SPECIFICATION')
            ) {
              throw new EvaluationNotEstablishedError();
            }
            break;
          }

          case 'historical-readiness': {
            const res = session.getNamespaceState<ResolutionSessionState>('resolution');
            const synth = session.getNamespaceState<SynthesisSessionState>('synthesis');
            const graph = session.getNamespaceState<GraphSessionState>('graph');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');

            if (
              !hasEvidence(res?.discoveredEvidence, 'EVD-RES-02-HISTORICAL') ||
              !hasEvidence(synth?.discoveredEvidence, 'EVD-SYNTH-02-LINEAGE') ||
              !hasEvidence(graph?.discoveredEvidence, 'EVD-GRAPH-02-CORRELATION') ||
              !hasEvidence(infer?.discoveredEvidence, 'EVD-INFER-02-LINEAGE')
            ) {
              throw new EvaluationNotEstablishedError();
            }
            break;
          }

          case 'environmental-readiness': {
            const res = session.getNamespaceState<ResolutionSessionState>('resolution');
            const synth = session.getNamespaceState<SynthesisSessionState>('synthesis');
            const graph = session.getNamespaceState<GraphSessionState>('graph');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');

            if (
              !hasEvidence(res?.discoveredEvidence, 'EVD-RES-03-ENVIRONMENTAL') ||
              !hasEvidence(synth?.discoveredEvidence, 'EVD-SYNTH-03-BOUNDARY') ||
              !hasEvidence(graph?.discoveredEvidence, 'EVD-GRAPH-01-CONTEXT') ||
              !hasEvidence(infer?.discoveredEvidence, 'EVD-INFER-03-BOUNDARY')
            ) {
              throw new EvaluationNotEstablishedError();
            }
            break;
          }

          case 'relational-readiness': {
            const res = session.getNamespaceState<ResolutionSessionState>('resolution');
            const synth = session.getNamespaceState<SynthesisSessionState>('synthesis');
            const graph = session.getNamespaceState<GraphSessionState>('graph');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');
            const trans = session.getNamespaceState<TransitionSessionState>('transition');

            if (
              !hasEvidence(res?.discoveredEvidence, 'EVD-RES-04-RELATIONAL') ||
              !hasEvidence(synth?.discoveredEvidence, 'EVD-SYNTH-04-RELATIONAL') ||
              !hasEvidence(graph?.discoveredEvidence, 'EVD-GRAPH-04-CONVERGENCE') ||
              !hasEvidence(infer?.discoveredEvidence, 'EVD-INFER-04-RECONCILIATION') ||
              trans?.currentState !== 'RECONCILED' ||
              !trans?.recordedTransitions?.includes('EVD-TRANS-03-RECONCILIATION')
            ) {
              throw new EvaluationNotEstablishedError();
            }
            break;
          }

          case 'submission-context': {
            const evalState = session.getNamespaceState<EvaluationSessionState>('evaluation');
            const res = session.getNamespaceState<ResolutionSessionState>('resolution');
            const synth = session.getNamespaceState<SynthesisSessionState>('synthesis');
            const graph = session.getNamespaceState<GraphSessionState>('graph');
            const infer = session.getNamespaceState<InferenceSessionState>('inference');

            if (
              !hasEvidence(evalState?.discoveredEvidence, 'EVD-EVAL-01-STRUCTURAL') ||
              !hasEvidence(evalState?.discoveredEvidence, 'EVD-EVAL-02-HISTORICAL') ||
              !hasEvidence(evalState?.discoveredEvidence, 'EVD-EVAL-03-ENVIRONMENTAL') ||
              !hasEvidence(evalState?.discoveredEvidence, 'EVD-EVAL-04-RELATIONAL') ||
              !hasEvidence(res?.discoveredEvidence, 'EVD-RES-05-CONTEXT') ||
              !hasEvidence(synth?.discoveredEvidence, 'EVD-SYNTH-05-MULTI-PERSPECTIVE') ||
              !hasEvidence(graph?.discoveredEvidence, 'EVD-GRAPH-05-RECONSTRUCTION') ||
              !hasEvidence(infer?.discoveredEvidence, 'EVD-INFER-05-CONVERGENCE')
            ) {
              throw new EvaluationNotEstablishedError();
            }
            break;
          }

          default:
            throw new EvaluationNotEstablishedError();
        }

        // Record discovery in session context under 'evaluation' namespace
        const currentEvaluationState =
          session.getNamespaceState<EvaluationSessionState>('evaluation');

        const prevSet =
          currentEvaluationState?.discoveredEvidence instanceof Set
            ? currentEvaluationState.discoveredEvidence
            : new Set(currentEvaluationState?.discoveredEvidence ?? []);

        const updatedDiscovered = new Set([...prevSet, artifact.artifactId]);

        session.setNamespaceState<EvaluationSessionState>(
          'evaluation',
          {
            discoveredEvidence: Object.freeze(updatedDiscovered),
            accessCount: (currentEvaluationState?.accessCount ?? 0) + 1,
            lastAccessedEvaluation: artifact.artifactId,
            submissionAttempts: currentEvaluationState?.submissionAttempts ?? 0,
            lastSubmissionStatus: currentEvaluationState?.lastSubmissionStatus ?? null,
            cooldownUntil: currentEvaluationState?.cooldownUntil ?? 0,
            lastSubmissionTimestamp: currentEvaluationState?.lastSubmissionTimestamp ?? 0,
          },
          'evaluation'
        );

        return formatEvidenceResponse(artifact);
      });
    }
  }

  /**
   * Evaluates a player's final candidate interpretation against server-controlled conditions.
   * Operates as a black-box boundary:
   * - Requires EVD-EVAL-05-SUBMISSION-CONTEXT in the session.
   * - Validates minimal textual input shape.
   * - Normalizes whitespace and casing deterministically.
   * - Never leaks partial correctness, scores, or expected values.
   *
   * Security hardening:
   * - Exponential backoff per session (1s→2s→4s→8s→16s cap) on wrong answers.
   * - Constant-time 50ms minimum response delay to defeat timing side-channel attacks.
   * - timingSafeEqual used for hash comparison to eliminate branch-timing leaks.
   */
  public async submitFinalInterpretation(
    context: RequestContext,
    submission: unknown
  ): Promise<EvaluationResult> {
    // Constant-time floor: all evaluation responses take at least 50ms
    // Prevents timing attacks that measure whether hash comparison was fast (no match) or slow (match)
    const responseStart = Date.now();
    const MINIMUM_RESPONSE_MS = 50;

    const enforceMinDelay = (): Promise<void> => {
      const elapsed = Date.now() - responseStart;
      const remaining = MINIMUM_RESPONSE_MS - elapsed;
      if (remaining > 0) {
        return new Promise((resolve) => setTimeout(resolve, remaining));
      }
      return Promise.resolve();
    };

    if (!context.hasSession() || !context.session) {
      await enforceMinDelay();
      throw new EvaluationNotEstablishedError();
    }

    const session = context.session.context;
    const currentEvaluationState =
      session.getNamespaceState<EvaluationSessionState>('evaluation');

    // 1. Verify EVD-EVAL-05-SUBMISSION-CONTEXT is established
    if (
      !hasEvidence(
        currentEvaluationState?.discoveredEvidence,
        'EVD-EVAL-05-SUBMISSION-CONTEXT'
      )
    ) {
      await enforceMinDelay();
      throw new EvaluationNotEstablishedError();
    }

    // 2. Exponential backoff enforcement
    // Wrong submissions force increasingly long cooldowns: 1s, 2s, 4s, 8s, 16s (cap)
    // Stored server-side in session — cannot be bypassed by the player
    const now = Date.now();
    const cooldownUntil = currentEvaluationState?.cooldownUntil ?? 0;
    if (now < cooldownUntil) {
      const waitSeconds = Math.ceil((cooldownUntil - now) / 1000);
      await enforceMinDelay();
      throw new RateLimitExceededError(
        `Submission cooldown active. Please wait ${waitSeconds} second(s) before retrying.`
      );
    }

    // 3. Validate input shape
    if (
      typeof submission !== 'object' ||
      submission === null ||
      !('interpretation' in submission) ||
      typeof (submission as { interpretation: unknown }).interpretation !== 'string'
    ) {
      await enforceMinDelay();
      throw new BadRequestError('Invalid submission format.');
    }

    const rawInterpretation = (submission as { interpretation: string }).interpretation;
    if (rawInterpretation.length > 4096) {
      await enforceMinDelay();
      throw new BadRequestError('Submission exceeds maximum allowed length.');
    }

    // 4. Deterministic normalization
    const normalized = rawInterpretation.trim().replace(/\s+/g, ' ').toUpperCase();

    // 5. Server-side private one-way hash evaluation using timing-safe comparison
    let status: EvaluationStatus = 'NOT_ACCEPTED';
    if (normalized.length > 0) {
      const submissionHash = createHash('sha256').update(normalized).digest('hex');
      // Use timingSafeEqual to prevent branch-timing oracle from leaking partial hash matches
      for (const canonicalHash of CANONICAL_INTERPRETATION_HASHES) {
        const canonBuf = Buffer.from(canonicalHash, 'utf8');
        const subBuf = Buffer.from(submissionHash, 'utf8');
        if (canonBuf.length === subBuf.length && timingSafeEqual(canonBuf, subBuf)) {
          status = 'ACCEPTED';
          break;
        }
      }
    }

    // 6. Compute next cooldown using exponential backoff (only on wrong submissions)
    const attempts = (currentEvaluationState?.submissionAttempts ?? 0) + 1;
    let nextCooldownUntil = 0;
    if (status === 'NOT_ACCEPTED') {
      // Backoff schedule: 1s, 2s, 4s, 8s, 16s (capped)
      const backoffSeconds = Math.min(Math.pow(2, attempts - 1), 16);
      nextCooldownUntil = now + backoffSeconds * 1000;
    }

    // 7. Update session state under 'evaluation' namespace
    const prevSet =
      currentEvaluationState?.discoveredEvidence instanceof Set
        ? currentEvaluationState.discoveredEvidence
        : new Set(currentEvaluationState?.discoveredEvidence ?? []);

    session.setNamespaceState<EvaluationSessionState>(
      'evaluation',
      {
        discoveredEvidence: Object.freeze(prevSet),
        accessCount: currentEvaluationState?.accessCount ?? 0,
        lastAccessedEvaluation: currentEvaluationState?.lastAccessedEvaluation ?? null,
        submissionAttempts: attempts,
        lastSubmissionStatus: status,
        cooldownUntil: nextCooldownUntil,
        lastSubmissionTimestamp: now,
      },
      'evaluation'
    );

    await enforceMinDelay();

    if (status === 'ACCEPTED') {
      return Object.freeze({ status, flag: deriveEnclaveFlag() });
    }
    return Object.freeze({ status });
  }
}
