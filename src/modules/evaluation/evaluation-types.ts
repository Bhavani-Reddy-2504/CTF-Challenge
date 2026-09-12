import { AppError } from '../../errors/app-error.js';
import type { EvaluationArtifact } from '../../evidence/evidence-types.js';

export type { EvaluationArtifact };

/**
 * Server-side session state for tracking evaluation lifecycle and discovered readiness contexts.
 * Maintained with strict namespace isolation under the 'evaluation' namespace.
 */
export interface EvaluationSessionState {
  readonly discoveredEvidence: ReadonlySet<string>;
  readonly accessCount: number;
  readonly lastAccessedEvaluation: string | null;
  readonly submissionAttempts: number;
  readonly lastSubmissionStatus: string | null;
  /** Unix timestamp (ms) until which further submissions are blocked (exponential backoff). */
  readonly cooldownUntil: number;
  /** Unix timestamp (ms) of the last submission attempt. */
  readonly lastSubmissionTimestamp: number;
}

/**
 * Safe, generic challenge error returned when a player attempts to access
 * an evaluation route or submission boundary before satisfying required prerequisites.
 * Does not leak prerequisite checklists, route names, missing evidence IDs, or dependency topology.
 */
export class EvaluationNotEstablishedError extends AppError {
  constructor(
    message = 'The available operational record does not establish the requested evaluation context.',
    internalDetails?: unknown
  ) {
    super({
      code: 'ERR_EVALUATION_CONTEXT_NOT_ESTABLISHED',
      message,
      statusCode: 422,
      classification: 'CLIENT_INPUT',
      internalDetails,
    });
    this.name = 'EvaluationNotEstablishedError';
  }
}

export interface StructuralEvaluationContent {
  readonly evaluation_context_id: string;
  readonly evaluation_dimension: string;
  readonly evaluation_reference: string;
  readonly evaluation_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly readiness_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly evaluation_notes: string;
}

export interface HistoricalEvaluationContent {
  readonly evaluation_context_id: string;
  readonly evaluation_dimension: string;
  readonly evaluation_reference: string;
  readonly evaluation_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly readiness_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly evaluation_notes: string;
}

export interface EnvironmentalEvaluationContent {
  readonly evaluation_context_id: string;
  readonly evaluation_dimension: string;
  readonly evaluation_reference: string;
  readonly evaluation_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly readiness_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly evaluation_notes: string;
}

export interface RelationalEvaluationContent {
  readonly evaluation_context_id: string;
  readonly evaluation_dimension: string;
  readonly evaluation_reference: string;
  readonly evaluation_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly readiness_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly evaluation_notes: string;
}

export interface SubmissionEvaluationContent {
  readonly evaluation_context_id: string;
  readonly evaluation_dimension: string;
  readonly evaluation_reference: string;
  readonly evaluation_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly readiness_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly evaluation_notes: string;
}

/**
 * Controlled string outcome for final evaluation submissions.
 * Strictly avoids boolean or binary oracle semantics.
 */
export type EvaluationStatus = 'ACCEPTED' | 'NOT_ACCEPTED';

/**
 * Public result surface for final submissions.
 * Contains only a generic status without scoring, ranking, or comparison information.
 */
export interface EvaluationResult {
  readonly status: EvaluationStatus;
  readonly flag?: string;
}

/**
 * Minimal textual input shape for candidate final submissions.
 */
export interface EvaluationSubmission {
  readonly interpretation: string;
}
