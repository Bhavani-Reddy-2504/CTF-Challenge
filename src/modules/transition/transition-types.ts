import { AppError } from '../../errors/app-error.js';
import type { TransitionArtifact, TransitionState } from '../../evidence/evidence-types.js';

export type { TransitionArtifact, TransitionState };

export const CANONICAL_TRANSITION_STATES: readonly TransitionState[] = Object.freeze([
  'UNINITIALIZED',
  'OBSERVED',
  'CORRELATED',
  'RECONCILED',
]);

export interface TransitionHistoryEntry {
  readonly transitionId: string;
  readonly fromState: TransitionState;
  readonly toState: TransitionState;
  readonly timestamp: string;
}

export interface TransitionSessionState {
  readonly currentState: TransitionState;
  readonly recordedTransitions: readonly string[];
  readonly discoveredEvidence: readonly string[];
  readonly transitionHistory: readonly TransitionHistoryEntry[];
  readonly accessCount: number;
  readonly lastTransitionId?: string;
}

/**
 * Safe, generic challenge error returned when a player attempts a transition
 * before satisfying required prerequisites or attempting invalid direct state jumps.
 * Does not leak missing evidence IDs, internal state names, or future roadmaps.
 */
export class TransitionNotEstablishedError extends AppError {
  constructor(
    message = 'The operational record does not satisfy the requirements for transition progression.',
    internalDetails?: unknown
  ) {
    super({
      code: 'ERR_TRANSITION_NOT_ESTABLISHED',
      message,
      statusCode: 422,
      classification: 'CLIENT_INPUT',
      internalDetails,
    });
    this.name = 'TransitionNotEstablishedError';
  }
}

export interface ObservationTransitionContent {
  readonly transition_name: string;
  readonly prior_state: TransitionState;
  readonly effective_state: TransitionState;
  readonly observation_scope: string;
  readonly consistency_state: string;
  readonly supporting_evidence: readonly string[];
  readonly transition_determination: string;
  readonly authority_conferred: boolean;
}

export interface CorrelationTransitionContent {
  readonly transition_name: string;
  readonly prior_state: TransitionState;
  readonly effective_state: TransitionState;
  readonly correlation_scope: string;
  readonly consistency_state: string;
  readonly supporting_evidence: readonly string[];
  readonly transition_determination: string;
  readonly authority_conferred: boolean;
}

export interface ReconciliationTransitionContent {
  readonly transition_name: string;
  readonly prior_state: TransitionState;
  readonly effective_state: TransitionState;
  readonly reconciliation_scope: string;
  readonly consistency_state: string;
  readonly supporting_evidence: readonly string[];
  readonly transition_determination: string;
  readonly authority_conferred: boolean;
}
