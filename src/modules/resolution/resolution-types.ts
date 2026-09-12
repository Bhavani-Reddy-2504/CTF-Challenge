import { AppError } from '../../errors/app-error.js';
import type { ResolutionArtifact } from '../../evidence/evidence-types.js';

export type { ResolutionArtifact };

/**
 * Server-side session state for tracking discovered resolution contexts.
 * Maintained with strict namespace isolation under the 'resolution' namespace.
 */
export interface ResolutionSessionState {
  readonly discoveredEvidence: ReadonlySet<string>;
  readonly accessCount: number;
  readonly lastAccessedResolution: string | null;
}

/**
 * Safe, generic challenge error returned when a player attempts to access
 * a resolution route before satisfying required discovery prerequisites.
 * Does not leak prerequisite checklists, route names, missing evidence IDs, or dependency topology.
 */
export class ResolutionNotEstablishedError extends AppError {
  constructor(
    message = 'The available operational record does not establish the requested resolution context.',
    internalDetails?: unknown
  ) {
    super({
      code: 'ERR_RESOLUTION_CONTEXT_NOT_ESTABLISHED',
      message,
      statusCode: 422,
      classification: 'CLIENT_INPUT',
      internalDetails,
    });
    this.name = 'ResolutionNotEstablishedError';
  }
}

export interface StructuralResolutionContent {
  readonly resolution_context_id: string;
  readonly resolution_dimension: string;
  readonly resolution_reference: string;
  readonly resolution_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly resolution_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly resolution_notes: string;
}

export interface HistoricalResolutionContent {
  readonly resolution_context_id: string;
  readonly resolution_dimension: string;
  readonly resolution_reference: string;
  readonly resolution_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly resolution_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly resolution_notes: string;
}

export interface EnvironmentalResolutionContent {
  readonly resolution_context_id: string;
  readonly resolution_dimension: string;
  readonly resolution_reference: string;
  readonly resolution_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly resolution_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly resolution_notes: string;
}

export interface RelationalResolutionContent {
  readonly resolution_context_id: string;
  readonly resolution_dimension: string;
  readonly resolution_reference: string;
  readonly resolution_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly resolution_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly resolution_notes: string;
}

export interface MultiDomainResolutionContent {
  readonly resolution_context_id: string;
  readonly resolution_dimension: string;
  readonly resolution_reference: string;
  readonly resolution_scope: string;
  readonly correlated_dimensions: readonly string[];
  readonly resolution_aspects: readonly string[];
  readonly contextual_observations: readonly Record<string, unknown>[];
  readonly resolution_notes: string;
}

/**
 * Internal-only resolution model structures.
 * Never serialized, never player-visible, never exposed in public barrel exports.
 */
export interface InternalResolutionNode {
  readonly nodeId: string;
  readonly evidenceRef: string;
  readonly dimension: string;
  readonly description: string;
}

export interface InternalResolutionRelation {
  readonly relationId: string;
  readonly sourceNode: string;
  readonly targetNode: string;
  readonly relationType: string;
  readonly contextualDescription: string;
}

export interface InternalResolutionDefinition {
  readonly nodes: readonly InternalResolutionNode[];
  readonly relations: readonly InternalResolutionRelation[];
}
