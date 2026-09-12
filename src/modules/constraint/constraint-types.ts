import { AppError } from '../../errors/app-error.js';
import type { ConstraintArtifact } from '../../evidence/evidence-types.js';

export type { ConstraintArtifact };

export interface ConstraintSessionState {
  readonly discoveredEvidence: readonly string[];
  readonly accessCount: number;
  readonly lastAccessedConstraint?: string;
}

/**
 * Safe, generic challenge error returned when a player attempts to access
 * constraint interpretations before satisfying required predecessor state progression.
 * Does not leak prerequisite checklists, transition names, or missing evidence IDs.
 */
export class ConstraintNotEstablishedError extends AppError {
  constructor(
    message = 'The operational record is insufficient to establish constraint interpretation.',
    internalDetails?: unknown
  ) {
    super({
      code: 'ERR_CONSTRAINT_NOT_ESTABLISHED',
      message,
      statusCode: 422,
      classification: 'CLIENT_INPUT',
      internalDetails,
    });
    this.name = 'ConstraintNotEstablishedError';
  }
}

export interface SpecificationConstraintContent {
  readonly constraint_type: string;
  readonly governed_subject: string;
  readonly specification_ref: string;
  readonly active_structural_boundary: string;
  readonly declarative_assertions: readonly string[];
  readonly contextual_relationships: readonly Record<string, unknown>[];
  readonly interpretation: string;
}

export interface ContinuityConstraintContent {
  readonly constraint_type: string;
  readonly governed_subject: string;
  readonly lineage_anchor_ref: string;
  readonly trace_continuity: string;
  readonly declarative_assertions: readonly string[];
  readonly contextual_relationships: readonly Record<string, unknown>[];
  readonly interpretation: string;
}

export interface BoundaryConstraintContent {
  readonly constraint_type: string;
  readonly governed_subject: string;
  readonly perimeter_anchor: string;
  readonly boundary_scope: string;
  readonly containment_mode: string;
  readonly declarative_assertions: readonly string[];
  readonly contextual_relationships: readonly Record<string, unknown>[];
  readonly interpretation: string;
}

export interface ReconciliationConstraintContent {
  readonly constraint_type: string;
  readonly governed_subject: string;
  readonly reconciliation_invariant: string;
  readonly synthesis_model: string;
  readonly declarative_assertions: readonly string[];
  readonly contextual_relationships: readonly Record<string, unknown>[];
  readonly interpretation: string;
}

export interface ContradictionDimension {
  readonly dimension: string;
  readonly interpretationRole: string;
  readonly governingPrinciple: string;
  readonly primaryEvidence: readonly string[];
  readonly apparentConflict: string;
  readonly resolutionRationale: string;
}
