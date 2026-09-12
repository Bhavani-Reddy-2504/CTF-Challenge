import { AppError } from '../../errors/app-error.js';
export type { TrustResolutionArtifact } from '../../evidence/evidence-types.js';

export interface TrustSessionState {
  readonly discoveredResolutions: readonly string[];
  readonly discoveredEvidence: readonly string[];
  readonly lastAccessedResolution?: string;
  readonly accessCount: number;
}

/**
 * Safe, generic challenge error returned when a player attempts to retrieve
 * a derived trust interpretation before discovering required supporting evidence.
 * Does not leak missing route names, prerequisite IDs, or future roadmaps.
 */
export class InsufficientEvidenceError extends AppError {
  constructor(
    message = 'The available record is insufficient to establish a deterministic trust interpretation.',
    internalDetails?: unknown
  ) {
    super({
      code: 'ERR_INSUFFICIENT_EVIDENCE_RECORD',
      message,
      statusCode: 422,
      classification: 'CLIENT_INPUT',
      internalDetails,
    });
    this.name = 'InsufficientEvidenceError';
  }
}

export interface ContextCoherenceContent {
  readonly resolution_scope: string;
  readonly consistency_state: string;
  readonly workload_reference: string;
  readonly enclave_partition: string;
  readonly logical_identity: string;
  readonly supporting_evidence: readonly string[];
  readonly coherence_determination: string;
  readonly authority_conferred: boolean;
}

export interface BindingCoherenceContent {
  readonly resolution_scope: string;
  readonly consistency_state: string;
  readonly active_specification_id: string;
  readonly identity_binding_id: string;
  readonly hardware_anchor_ref: string;
  readonly supporting_evidence: readonly string[];
  readonly verification_result: string;
  readonly authority_conferred: boolean;
}

export interface LineageCoherenceContent {
  readonly resolution_scope: string;
  readonly consistency_state: string;
  readonly lineage_trace_reference: string;
  readonly superseded_identity: string;
  readonly authoritative_identity: string;
  readonly audit_continuity: string;
  readonly supporting_evidence: readonly string[];
  readonly lineage_determination: string;
  readonly authority_conferred: boolean;
}

export interface MembershipCoherenceContent {
  readonly resolution_scope: string;
  readonly consistency_state: string;
  readonly trust_zone: string;
  readonly federation_boundary: string;
  readonly transitive_routing: string;
  readonly boundary_recognition: string;
  readonly supporting_evidence: readonly string[];
  readonly perimeter_determination: string;
  readonly authority_conferred: boolean;
}

export interface EffectiveInterpretationContent {
  readonly resolution_scope: string;
  readonly consistency_state: string;
  readonly active_identity: string;
  readonly historical_reference: string;
  readonly precedence_hierarchy: string;
  readonly compatibility_interpretation: string;
  readonly supporting_evidence: readonly string[];
  readonly resolution_principle: string;
  readonly authority_conferred: boolean;
}
