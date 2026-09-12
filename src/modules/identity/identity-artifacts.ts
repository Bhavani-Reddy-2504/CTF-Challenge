import { IdentityArtifact } from '../../evidence/evidence-types.js';

export interface IdentityContextContent {
  readonly logical_identity_id: string;
  readonly identity_class: string;
  readonly workload_association: string;
  readonly enclave_partition_ref: string;
  readonly trust_domain_identifier: string;
  readonly resolution_state: string;
  readonly effective_authority_granted: boolean;
}

export interface IdentityBindingContent {
  readonly binding_id: string;
  readonly bound_workload: string;
  readonly enclave_partition: string;
  readonly integrity_anchor_ref: string;
  readonly binding_verification: string;
  readonly effective_binding_status: string;
  readonly governance_note: string;
}

export interface TrustMembershipContent {
  readonly membership_id: string;
  readonly primary_trust_zone: string;
  readonly federation_boundary_ref: string;
  readonly transitive_trust_status: string;
  readonly membership_scope: string;
  readonly authority_conferred: boolean;
  readonly boundary_principle: string;
}

export interface LineageRecordContent {
  readonly lineage_id: string;
  readonly current_active_identity: string;
  readonly predecessor_identity: string;
  readonly historical_deployment_ref: string;
  readonly lineage_continuity_status: string;
  readonly succession_record: string;
}

export interface CompatibilityIdentityContent {
  readonly compatibility_id: string;
  readonly compatibility_mode: string;
  readonly declared_identity_ref: string;
  readonly compatibility_interpretation: string;
  readonly active_specification_precedence: boolean;
  readonly resolution_principle: string;
  readonly preserved_lineage_trace: string;
}

export const IDENTITY_ARTIFACTS: Record<string, IdentityArtifact> = Object.freeze({
  'context': Object.freeze({
    artifactId: 'EVD-IDN-01-CONTEXT',
    evidenceId: 'EVD-IDN-01-CONTEXT',
    source: 'identity' as const,
    classification: 'IDENTITY_CONTEXT' as const,
    status: 'ACTIVE' as const,
    relevance: 'PRIMARY_PATH' as const,
    correlationReferences: Object.freeze([
      'wrk-hyperion-telemetry-edge',
      'edge-telemetry-enclave',
      'hyperion://identity/telemetry/collector-v2',
    ]),
    content: Object.freeze({
      logical_identity_id: 'hyperion://identity/telemetry/collector-v2',
      identity_class: 'enclave-workload-service-account',
      workload_association: 'wrk-hyperion-telemetry-edge',
      enclave_partition_ref: 'edge-telemetry-enclave',
      trust_domain_identifier: 'hyperion.internal',
      resolution_state: 'RESOLVED_ACTIVE',
      effective_authority_granted: false,
    }),
  }),

  'binding': Object.freeze({
    artifactId: 'EVD-IDN-02-BINDING',
    evidenceId: 'EVD-IDN-02-BINDING',
    source: 'identity' as const,
    classification: 'IDENTITY_BINDING' as const,
    status: 'ACTIVE' as const,
    relevance: 'PRIMARY_PATH' as const,
    correlationReferences: Object.freeze([
      'wrk-hyperion-telemetry-edge',
      'enclave-integrity-anchor-889f',
      'edge-telemetry-enclave',
    ]),
    content: Object.freeze({
      binding_id: 'bind-identity-enclave-active',
      bound_workload: 'wrk-hyperion-telemetry-edge',
      enclave_partition: 'edge-telemetry-enclave',
      integrity_anchor_ref: 'enclave-integrity-anchor-889f',
      binding_verification: 'anchor-consistent',
      effective_binding_status: 'VALIDATED',
      governance_note:
        'Identity binding establishes execution provenance; does not confer administrative or cross-boundary authority.',
    }),
  }),

  'trust-membership': Object.freeze({
    artifactId: 'EVD-IDN-03-TRUST-MEMBERSHIP',
    evidenceId: 'EVD-IDN-03-TRUST-MEMBERSHIP',
    source: 'identity' as const,
    classification: 'TRUST_DOMAIN_MEMBERSHIP' as const,
    status: 'ACTIVE' as const,
    relevance: 'PRIMARY_PATH' as const,
    correlationReferences: Object.freeze([
      'trust-zone-alpha',
      'strata://federation.stage-build.internal',
      'edge-telemetry-enclave',
    ]),
    content: Object.freeze({
      membership_id: 'trust-membership-edge-alpha',
      primary_trust_zone: 'trust-zone-alpha',
      federation_boundary_ref: 'strata://federation.stage-build.internal',
      transitive_trust_status: 'DISABLED',
      membership_scope: 'enclave-perimeter-recognition',
      authority_conferred: false,
      boundary_principle:
        'Trust membership establishes boundary recognition; execution authority requires explicit downstream governance verification.',
    }),
  }),

  'lineage': Object.freeze({
    artifactId: 'EVD-IDN-04-LINEAGE',
    evidenceId: 'EVD-IDN-04-LINEAGE',
    source: 'identity' as const,
    classification: 'LINEAGE_RECORD' as const,
    status: 'ACTIVE' as const,
    relevance: 'CORRELATION_CONTEXT' as const,
    correlationReferences: Object.freeze([
      'REF-CORR-99201-B',
      'hyperion://identity/telemetry/collector-v1',
      'hyperion://identity/telemetry/collector-v2',
    ]),
    content: Object.freeze({
      lineage_id: 'lineage-identity-succession-01',
      current_active_identity: 'hyperion://identity/telemetry/collector-v2',
      predecessor_identity: 'hyperion://identity/telemetry/collector-v1',
      historical_deployment_ref: 'REF-CORR-99201-B',
      lineage_continuity_status: 'CONFIRMED_CONTINUOUS',
      succession_record:
        'Service account v1 was superseded during deployment rollout; lineage record preserved for provenance verification.',
    }),
  }),

  'compatibility': Object.freeze({
    artifactId: 'EVD-IDN-05-COMPAT',
    evidenceId: 'EVD-IDN-05-COMPAT',
    source: 'identity' as const,
    classification: 'COMPATIBILITY_IDENTITY' as const,
    status: 'COMPATIBILITY' as const,
    relevance: 'CORRELATION_CONTEXT' as const,
    correlationReferences: Object.freeze([
      'REF-CORR-99201-B',
      'hyperion://identity/telemetry/collector-v1',
      'wrk-hyperion-telemetry-edge',
    ]),
    content: Object.freeze({
      compatibility_id: 'compat-identity-interpretation-01',
      compatibility_mode: 'strata-legacy-v1-fallback',
      declared_identity_ref: 'hyperion://identity/telemetry/collector-v1',
      compatibility_interpretation: 'HISTORICAL_ONLY',
      active_specification_precedence: true,
      resolution_principle:
        'A declared historical identity reference preserves lineage significance but does not constitute the active identity definition; active specification takes precedence.',
      preserved_lineage_trace: 'REF-CORR-99201-B',
    }),
  }),
});
