import { AppError } from '../../errors/app-error.js';
import type { InferenceArtifact } from '../../evidence/evidence-types.js';

export type { InferenceArtifact };

/**
 * Server-side session state for tracking discovered inference evidence.
 * Maintained with strict namespace isolation under the 'inference' namespace.
 */
export interface InferenceSessionState {
  readonly discoveredEvidence: readonly string[];
  readonly accessCount: number;
  readonly lastAccessedInference?: string;
}

/**
 * Safe, generic challenge error returned when a player attempts to access
 * an inference route before satisfying required predecessor discovery prerequisites.
 * Does not leak prerequisite checklists, route names, or missing evidence IDs.
 */
export class InferenceNotEstablishedError extends AppError {
  constructor(
    message = 'The available operational record does not establish an inference context.',
    internalDetails?: unknown
  ) {
    super({
      code: 'ERR_INFERENCE_NOT_ESTABLISHED',
      message,
      statusCode: 422,
      classification: 'CLIENT_INPUT',
      internalDetails,
    });
    this.name = 'InferenceNotEstablishedError';
  }
}

/**
 * Descriptive candidate hypothesis structure within an inference model.
 * Does not contain Boolean correctness, rankings, scores, or winner fields.
 */
export interface CandidateHypothesis {
  readonly hypothesis_id: string;
  readonly premise: string;
  readonly interpretive_implication: string;
}

export interface SpecificationInferenceContent {
  readonly model_id: string;
  readonly governed_dimension: string;
  readonly model_reference: string;
  readonly interpretive_scope: string;
  readonly consistency_domain: string;
  readonly correlated_evidence: readonly string[];
  readonly candidate_hypotheses: readonly CandidateHypothesis[];
  readonly declarative_assertions: readonly string[];
  readonly contextual_relationships: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

export interface LineageInferenceContent {
  readonly model_id: string;
  readonly governed_dimension: string;
  readonly model_reference: string;
  readonly interpretive_scope: string;
  readonly consistency_domain: string;
  readonly correlated_evidence: readonly string[];
  readonly candidate_hypotheses: readonly CandidateHypothesis[];
  readonly declarative_assertions: readonly string[];
  readonly contextual_relationships: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

export interface BoundaryInferenceContent {
  readonly model_id: string;
  readonly governed_dimension: string;
  readonly model_reference: string;
  readonly interpretive_scope: string;
  readonly consistency_domain: string;
  readonly correlated_evidence: readonly string[];
  readonly candidate_hypotheses: readonly CandidateHypothesis[];
  readonly declarative_assertions: readonly string[];
  readonly contextual_relationships: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

export interface ReconciliationInferenceContent {
  readonly model_id: string;
  readonly governed_dimension: string;
  readonly model_reference: string;
  readonly interpretive_scope: string;
  readonly consistency_domain: string;
  readonly correlated_evidence: readonly string[];
  readonly candidate_hypotheses: readonly CandidateHypothesis[];
  readonly declarative_assertions: readonly string[];
  readonly contextual_relationships: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

export interface ConvergenceInferenceContent {
  readonly model_id: string;
  readonly governed_dimension: string;
  readonly model_reference: string;
  readonly interpretive_scope: string;
  readonly consistency_domain: string;
  readonly correlated_models: readonly string[];
  readonly evaluated_hypotheses: readonly CandidateHypothesis[];
  readonly declarative_assertions: readonly string[];
  readonly contextual_relationships: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}
