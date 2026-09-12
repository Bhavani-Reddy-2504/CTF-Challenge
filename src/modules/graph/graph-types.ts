import { AppError } from '../../errors/app-error.js';
import type { GraphArtifact } from '../../evidence/evidence-types.js';

export type { GraphArtifact };

/**
 * Server-side session state for tracking discovered graph correlation fragments.
 * Maintained with strict namespace isolation under the 'graph' namespace.
 */
export interface GraphSessionState {
  readonly discoveredEvidence: readonly string[];
  readonly accessCount: number;
  readonly lastAccessedGraphArtifact?: string;
}

/**
 * Safe, generic challenge error returned when a player attempts to access
 * a graph route before satisfying required non-linear discovery prerequisites.
 * Does not leak prerequisite checklists, route names, missing evidence IDs, or graph structure.
 */
export class GraphNotEstablishedError extends AppError {
  constructor(
    message = 'The available operational record does not establish the requested correlation context.',
    internalDetails?: unknown
  ) {
    super({
      code: 'ERR_GRAPH_CONTEXT_NOT_ESTABLISHED',
      message,
      statusCode: 422,
      classification: 'CLIENT_INPUT',
      internalDetails,
    });
    this.name = 'GraphNotEstablishedError';
  }
}

export interface ContextFragmentContent {
  readonly fragment_id: string;
  readonly correlation_dimension: string;
  readonly fragment_reference: string;
  readonly contextual_scope: string;
  readonly associated_records: readonly string[];
  readonly relational_assertions: readonly string[];
  readonly contextual_associations: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

export interface CorrelationFragmentContent {
  readonly fragment_id: string;
  readonly correlation_dimension: string;
  readonly fragment_reference: string;
  readonly contextual_scope: string;
  readonly associated_records: readonly string[];
  readonly relational_assertions: readonly string[];
  readonly contextual_associations: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

export interface TopologyFragmentContent {
  readonly fragment_id: string;
  readonly correlation_dimension: string;
  readonly fragment_reference: string;
  readonly contextual_scope: string;
  readonly associated_records: readonly string[];
  readonly relational_assertions: readonly string[];
  readonly contextual_associations: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

export interface ConvergenceFragmentContent {
  readonly fragment_id: string;
  readonly correlation_dimension: string;
  readonly fragment_reference: string;
  readonly contextual_scope: string;
  readonly associated_records: readonly string[];
  readonly relational_assertions: readonly string[];
  readonly contextual_associations: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

export interface ReconstructionFragmentContent {
  readonly fragment_id: string;
  readonly correlation_dimension: string;
  readonly fragment_reference: string;
  readonly contextual_scope: string;
  readonly associated_records: readonly string[];
  readonly relational_assertions: readonly string[];
  readonly contextual_associations: readonly Record<string, unknown>[];
  readonly synthesis_notes: string;
}

/**
 * Internal-only graph model structures.
 * Never serialized, never player-visible, never exposed in public barrel exports.
 */
export interface InternalGraphNode {
  readonly nodeId: string;
  readonly evidenceRef: string;
  readonly domain: string;
  readonly description: string;
}

export interface InternalGraphEdge {
  readonly edgeId: string;
  readonly sourceNode: string;
  readonly targetNode: string;
  readonly relationType: string;
  readonly conceptualMeaning: string;
}

export interface InternalGraphDefinition {
  readonly nodes: readonly InternalGraphNode[];
  readonly edges: readonly InternalGraphEdge[];
}
