import { AppError } from '../../errors/app-error.js';
import type { SynthesisArtifact } from '../../evidence/evidence-types.js';

export type { SynthesisArtifact };

/**
 * Server-side session state for tracking discovered synthesis perspectives.
 * Maintained with strict namespace isolation under the 'synthesis' namespace.
 */
export interface SynthesisSessionState {
  readonly discoveredEvidence: readonly string[];
  readonly accessCount: number;
  readonly lastAccessedSynthesis?: string;
}

/**
 * Safe, generic challenge error returned when a player attempts to access
 * a synthesis route before satisfying required discovery prerequisites.
 * Does not leak prerequisite checklists, route names, missing evidence IDs, or dependency topology.
 */
export class SynthesisNotEstablishedError extends AppError {
  constructor(
    message = 'The available operational record does not establish the requested synthesis context.',
    internalDetails?: unknown
  ) {
    super({
      code: 'ERR_SYNTHESIS_CONTEXT_NOT_ESTABLISHED',
      message,
      statusCode: 422,
      classification: 'CLIENT_INPUT',
      internalDetails,
    });
    this.name = 'SynthesisNotEstablishedError';
  }
}

export interface SpecificationSynthesisContent {
  readonly perspective_id: string;
  readonly perspective_dimension: string;
  readonly perspective_reference: string;
  readonly synthesis_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly synthesized_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

export interface LineageSynthesisContent {
  readonly perspective_id: string;
  readonly perspective_dimension: string;
  readonly perspective_reference: string;
  readonly synthesis_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly synthesized_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

export interface BoundarySynthesisContent {
  readonly perspective_id: string;
  readonly perspective_dimension: string;
  readonly perspective_reference: string;
  readonly synthesis_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly synthesized_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

export interface RelationalSynthesisContent {
  readonly perspective_id: string;
  readonly perspective_dimension: string;
  readonly perspective_reference: string;
  readonly synthesis_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly synthesized_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

export interface MultiPerspectiveSynthesisContent {
  readonly perspective_id: string;
  readonly perspective_dimension: string;
  readonly perspective_reference: string;
  readonly synthesis_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly synthesized_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

/**
 * Internal-only synthesis model structures.
 * Never serialized, never player-visible, never exposed in public barrel exports.
 */
export interface InternalSynthesisPerspective {
  readonly perspectiveId: string;
  readonly evidenceRef: string;
  readonly dimension: string;
  readonly description: string;
}

export interface InternalSynthesisLink {
  readonly linkId: string;
  readonly sourcePerspective: string;
  readonly targetPerspective: string;
  readonly synthesisNature: string;
  readonly conceptualContext: string;
}

export interface InternalSynthesisDefinition {
  readonly perspectives: readonly InternalSynthesisPerspective[];
  readonly links: readonly InternalSynthesisLink[];
}
