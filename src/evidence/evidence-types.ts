import { SimNamespace } from '../router/sim-route.js';

export type EvidenceClassification =
  | 'ENVIRONMENT_TOPOLOGY'
  | 'WORKLOAD_SPECIFICATION'
  | 'TRUST_RELATIONSHIP'
  | 'AUDIT_TRAIL'
  | 'HISTORICAL_EVENT'
  | 'CONFIGURATION_SPECIFICATION'
  | 'BINDING_PROFILE'
  | 'COMPATIBILITY_RULE'
  | 'INTEGRITY_CONSTRAINT'
  | 'IDENTITY_CONTEXT'
  | 'IDENTITY_BINDING'
  | 'TRUST_DOMAIN_MEMBERSHIP'
  | 'LINEAGE_RECORD'
  | 'COMPATIBILITY_IDENTITY'
  | 'TRUST_COHERENCE_RESOLUTION'
  | 'BINDING_COHERENCE_RESOLUTION'
  | 'LINEAGE_COHERENCE_RESOLUTION'
  | 'TRUST_CONTEXT_RESOLUTION'
  | 'EFFECTIVE_INTERPRETATION_RESOLUTION'
  | 'OBSERVATION_TRANSITION'
  | 'CORRELATION_TRANSITION'
  | 'RECONCILIATION_TRANSITION'
  | 'SPECIFICATION_CONSTRAINT'
  | 'CONTINUITY_CONSTRAINT'
  | 'BOUNDARY_CONSTRAINT'
  | 'RECONCILIATION_CONSTRAINT'
  | 'SPECIFICATION_INFERENCE_MODEL'
  | 'LINEAGE_INFERENCE_MODEL'
  | 'BOUNDARY_INFERENCE_MODEL'
  | 'RECONCILIATION_INFERENCE_MODEL'
  | 'CONVERGENCE_INFERENCE_MODEL'
  | 'GRAPH_CONTEXT_FRAGMENT'
  | 'GRAPH_CORRELATION_FRAGMENT'
  | 'GRAPH_TOPOLOGY_FRAGMENT'
  | 'GRAPH_CONVERGENCE_FRAGMENT'
  | 'GRAPH_RECONSTRUCTION_FRAGMENT'
  | 'SPECIFICATION_SYNTHESIS'
  | 'LINEAGE_SYNTHESIS'
  | 'BOUNDARY_SYNTHESIS'
  | 'RELATIONAL_SYNTHESIS'
  | 'MULTI_PERSPECTIVE_SYNTHESIS'
  | 'STRUCTURAL_RESOLUTION_CONTEXT'
  | 'HISTORICAL_RESOLUTION_CONTEXT'
  | 'ENVIRONMENTAL_RESOLUTION_CONTEXT'
  | 'RELATIONAL_RESOLUTION_CONTEXT'
  | 'MULTI_DOMAIN_RESOLUTION_CONTEXT'
  | 'STRUCTURAL_EVALUATION_READINESS'
  | 'HISTORICAL_EVALUATION_READINESS'
  | 'ENVIRONMENTAL_EVALUATION_READINESS'
  | 'RELATIONAL_EVALUATION_READINESS'
  | 'CONTROLLED_SUBMISSION_CONTEXT';

export type EvidenceRelevance =
  | 'PRIMARY_PATH'
  | 'CORRELATION_CONTEXT'
  | 'CHRONOLOGY_ANCHOR';

export type ConfigurationStatus = 'ACTIVE' | 'COMPATIBILITY' | 'DEPRECATED';

/**
 * Strongly typed evidence artifact representing a discovery in the simulated environment.
 */
export interface EvidenceArtifact<T = Record<string, unknown>> {
  readonly evidenceId: string;
  readonly source: SimNamespace;
  readonly classification: EvidenceClassification;
  readonly relevance: EvidenceRelevance;
  readonly correlationReferences: readonly string[];
  readonly content: Readonly<T>;
}

/**
 * Strongly typed configuration artifact extending the evidence model
 * with versioning, explicit status, and artifactId.
 */
export interface ConfigurationArtifact<T = Record<string, unknown>>
  extends EvidenceArtifact<T> {
  readonly artifactId: string;
  readonly source: 'config';
  readonly version: string;
  readonly status: ConfigurationStatus;
}

/**
 * Strongly typed identity artifact extending the evidence model
 * with explicit status and artifactId.
 */
export interface IdentityArtifact<T = Record<string, unknown>>
  extends EvidenceArtifact<T> {
  readonly artifactId: string;
  readonly source: 'identity';
  readonly status: ConfigurationStatus;
}

/**
 * Strongly typed trust resolution artifact extending the evidence model
 * with resolution scope, consistency state, supporting evidence, and prerequisites.
 */
export interface TrustResolutionArtifact<T = Record<string, unknown>>
  extends EvidenceArtifact<T> {
  readonly artifactId: string;
  readonly source: 'trust';
  readonly version: string;
  readonly status: ConfigurationStatus;
  readonly resolutionScope: string;
  readonly consistencyState: string;
  readonly supportingEvidence: readonly string[];
  readonly requiredPrerequisites: readonly string[];
}

export type TransitionState = 'UNINITIALIZED' | 'OBSERVED' | 'CORRELATED' | 'RECONCILED';

/**
 * Strongly typed transition artifact extending the evidence model
 * with directed state transitions, consistency state, and interpretation.
 */
export interface TransitionArtifact<T = Record<string, unknown>>
  extends EvidenceArtifact<T> {
  readonly artifactId: string;
  readonly source: 'transition';
  readonly version: string;
  readonly fromState: TransitionState;
  readonly toState: TransitionState;
  readonly consistencyState: string;
  readonly supportingEvidence: readonly string[];
  readonly interpretation: string;
}

/**
 * Strongly typed constraint artifact extending the evidence model
 * with subject, assertions, relationships, and interpretation.
 */
export interface ConstraintArtifact<T = Record<string, unknown>>
  extends EvidenceArtifact<T> {
  readonly artifactId: string;
  readonly source: 'constraint';
  readonly version: string;
  readonly status: ConfigurationStatus;
  readonly subject: string;
  readonly assertions: readonly string[];
  readonly relationships: readonly Record<string, unknown>[];
  readonly interpretation: string;
}

/**
 * Strongly typed inference artifact extending the evidence model
 * with candidate models, correlated evidence, interpretive scope, and synthesis notes.
 */
export interface InferenceArtifact<T = Record<string, unknown>>
  extends EvidenceArtifact<T> {
  readonly artifactId: string;
  readonly source: 'inference';
  readonly version: string;
  readonly status: ConfigurationStatus;
  readonly modelReference: string;
  readonly interpretiveScope: string;
  readonly consistencyDomain: string;
  readonly correlatedEvidence: readonly string[];
  readonly synthesisNotes: string;
}

/**
 * Strongly typed graph artifact extending the evidence model
 * with fragment references, correlation dimensions, contextual scope, and synthesis notes.
 */
export interface GraphArtifact<T = Record<string, unknown>>
  extends EvidenceArtifact<T> {
  readonly artifactId: string;
  readonly source: 'graph';
  readonly version: string;
  readonly status: ConfigurationStatus;
  readonly fragmentReference: string;
  readonly correlationDimension: string;
  readonly contextualScope: string;
  readonly correlatedEvidence: readonly string[];
  readonly synthesisNotes: string;
}

/**
 * Strongly typed synthesis artifact extending the evidence model
 * with perspective references, perspective dimensions, synthesis scope, and synthesis notes.
 */
export interface SynthesisArtifact<T = Record<string, unknown>>
  extends EvidenceArtifact<T> {
  readonly artifactId: string;
  readonly source: 'synthesis';
  readonly version: string;
  readonly status: ConfigurationStatus;
  readonly authority_conferred: false;
  readonly perspectiveReference: string;
  readonly perspectiveDimension: string;
  readonly synthesisScope: string;
  readonly correlatedEvidence: readonly string[];
  readonly synthesisNotes: string;
}

/**
 * Strongly typed resolution artifact extending the evidence model
 * with resolution reference, dimension, scope, correlated evidence, and notes.
 */
export interface ResolutionArtifact<T = Record<string, unknown>>
  extends EvidenceArtifact<T> {
  readonly artifactId: string;
  readonly source: 'resolution';
  readonly version: string;
  readonly status: ConfigurationStatus;
  readonly authority_conferred: false;
  readonly resolutionReference: string;
  readonly resolutionDimension: string;
  readonly resolutionScope: string;
  readonly correlatedEvidence: readonly string[];
  readonly resolutionNotes: string;
}

/**
 * Strongly typed evaluation artifact extending the evidence model
 * with evaluation reference, dimension, scope, correlated evidence, and notes.
 */
export interface EvaluationArtifact<T = Record<string, unknown>>
  extends EvidenceArtifact<T> {
  readonly artifactId: string;
  readonly source: 'evaluation';
  readonly version: string;
  readonly status: ConfigurationStatus;
  readonly authority_conferred: false;
  readonly evaluationReference: string;
  readonly evaluationDimension: string;
  readonly evaluationScope: string;
  readonly correlatedEvidence: readonly string[];
  readonly evaluationNotes: string;
}

/**
 * Standard public response shape for evidence retrieval.
 * Strips internal framework metadata while preserving challenge clues.
 */
export interface EvidenceResponse<T = Record<string, unknown>> {
  readonly status: 'ok';
  readonly evidence: {
    readonly id: string;
    readonly source: string;
    readonly classification: string;
    readonly version?: string;
    readonly status?: string;
    readonly correlation_references?: readonly string[];
    readonly content: T;
  };
}

/**
 * Deep freezes an object recursively to guarantee immutability.
 */
export function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

/**
 * Recursively creates a deep clone of a value.
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }
  const copy: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    copy[k] = deepClone(v);
  }
  return copy as T;
}

/**
 * Creates a sanitized, public evidence response object.
 * Returns a deeply frozen defensive copy to prevent shared state mutation.
 */
export function formatEvidenceResponse<T extends Record<string, unknown>>(
  artifact:
    | EvidenceArtifact<T>
    | ConfigurationArtifact<T>
    | IdentityArtifact<T>
    | TrustResolutionArtifact<T>
    | TransitionArtifact<T>
    | ConstraintArtifact<T>
    | InferenceArtifact<T>
    | GraphArtifact<T>
    | SynthesisArtifact<T>
    | ResolutionArtifact<T>
    | EvaluationArtifact<T>
): EvidenceResponse<T> {
  const version =
    'version' in artifact && typeof artifact.version === 'string'
      ? artifact.version
      : undefined;
  const status =
    'status' in artifact && typeof artifact.status === 'string'
      ? artifact.status
      : undefined;

  const clonedContent = deepClone(artifact.content);

  return Object.freeze({
    status: 'ok' as const,
    evidence: Object.freeze({
      id: artifact.evidenceId,
      source: artifact.source,
      classification: artifact.classification,
      ...(version ? { version } : {}),
      ...(status ? { status } : {}),
      ...(artifact.correlationReferences.length > 0
        ? { correlation_references: Object.freeze([...artifact.correlationReferences]) }
        : {}),
      content: deepFreeze(clonedContent),
    }),
  });
}

