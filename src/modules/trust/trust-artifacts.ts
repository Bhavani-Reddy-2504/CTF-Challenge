import type { TrustResolutionArtifact } from './trust-types.js';

export const TRUST_ARTIFACTS: Record<string, TrustResolutionArtifact> = Object.freeze({
  'context-coherence': Object.freeze({
    artifactId: 'EVD-TRUST-01-CONTEXT',
    evidenceId: 'EVD-TRUST-01-CONTEXT',
    source: 'trust' as const,
    classification: 'TRUST_COHERENCE_RESOLUTION' as const,
    version: '1.0.0',
    status: 'ACTIVE' as const,
    relevance: 'PRIMARY_PATH' as const,
    resolutionScope: 'workload-enclave-identity-coherence',
    consistencyState: 'COHERENT',
    correlationReferences: Object.freeze([
      'wrk-hyperion-telemetry-edge',
      'edge-telemetry-enclave',
      'hyperion://identity/telemetry/collector-v2',
    ]),
    supportingEvidence: Object.freeze([
      'EVD-META-01-PROFILE',
      'EVD-META-02-CONTEXT',
      'EVD-IDN-01-CONTEXT',
    ]),
    requiredPrerequisites: Object.freeze([
      'EVD-META-01-PROFILE',
      'EVD-META-02-CONTEXT',
      'EVD-IDN-01-CONTEXT',
    ]),
    content: Object.freeze({
      resolution_scope: 'workload-enclave-identity-coherence',
      consistency_state: 'COHERENT',
      workload_reference: 'wrk-hyperion-telemetry-edge',
      enclave_partition: 'edge-telemetry-enclave',
      logical_identity: 'hyperion://identity/telemetry/collector-v2',
      supporting_evidence: Object.freeze([
        'EVD-META-01-PROFILE',
        'EVD-META-02-CONTEXT',
        'EVD-IDN-01-CONTEXT',
      ]),
      coherence_determination:
        'Workload profile, isolated hypervisor partition topology, and resolved active identity context form a coherent operational baseline.',
      authority_conferred: false,
    }),
  }),

  'binding-coherence': Object.freeze({
    artifactId: 'EVD-TRUST-02-BINDING',
    evidenceId: 'EVD-TRUST-02-BINDING',
    source: 'trust' as const,
    classification: 'BINDING_COHERENCE_RESOLUTION' as const,
    version: '1.0.0',
    status: 'ACTIVE' as const,
    relevance: 'PRIMARY_PATH' as const,
    resolutionScope: 'specification-identity-binding-coherence',
    consistencyState: 'RESOLVED_CONSISTENT',
    correlationReferences: Object.freeze([
      'wrk-hyperion-telemetry-edge',
      'enclave-integrity-anchor-889f',
      'edge-telemetry-enclave',
    ]),
    supportingEvidence: Object.freeze([
      'EVD-CFG-01-ACTIVE-SPEC',
      'EVD-IDN-02-BINDING',
    ]),
    requiredPrerequisites: Object.freeze([
      'EVD-CFG-01-ACTIVE-SPEC',
      'EVD-IDN-02-BINDING',
    ]),
    content: Object.freeze({
      resolution_scope: 'specification-identity-binding-coherence',
      consistency_state: 'RESOLVED_CONSISTENT',
      active_specification_id: 'spec-edge-telemetry-active',
      identity_binding_id: 'bind-identity-enclave-active',
      hardware_anchor_ref: 'enclave-integrity-anchor-889f',
      supporting_evidence: Object.freeze([
        'EVD-CFG-01-ACTIVE-SPEC',
        'EVD-IDN-02-BINDING',
      ]),
      verification_result:
        'Active specification principal requirements align with verified enclave hardware anchor binding.',
      authority_conferred: false,
    }),
  }),

  'lineage-coherence': Object.freeze({
    artifactId: 'EVD-TRUST-03-LINEAGE',
    evidenceId: 'EVD-TRUST-03-LINEAGE',
    source: 'trust' as const,
    classification: 'LINEAGE_COHERENCE_RESOLUTION' as const,
    version: '1.0.0',
    status: 'ACTIVE' as const,
    relevance: 'PRIMARY_PATH' as const,
    resolutionScope: 'historical-succession-and-lineage-continuity',
    consistencyState: 'RESOLVED_CONSISTENT',
    correlationReferences: Object.freeze([
      'REF-CORR-99201-B',
      'hyperion://identity/telemetry/collector-v1',
      'hyperion://identity/telemetry/collector-v2',
    ]),
    supportingEvidence: Object.freeze([
      'EVD-AUD-03-FAILS',
      'EVD-CFG-04-COMPAT',
      'EVD-IDN-04-LINEAGE',
    ]),
    requiredPrerequisites: Object.freeze([
      'EVD-AUD-03-FAILS',
      'EVD-CFG-04-COMPAT',
      'EVD-IDN-04-LINEAGE',
    ]),
    content: Object.freeze({
      resolution_scope: 'historical-succession-and-lineage-continuity',
      consistency_state: 'RESOLVED_CONSISTENT',
      lineage_trace_reference: 'REF-CORR-99201-B',
      superseded_identity: 'hyperion://identity/telemetry/collector-v1',
      authoritative_identity: 'hyperion://identity/telemetry/collector-v2',
      audit_continuity: 'CONFIRMED_CONTINUOUS',
      supporting_evidence: Object.freeze([
        'EVD-AUD-03-FAILS',
        'EVD-CFG-04-COMPAT',
        'EVD-IDN-04-LINEAGE',
      ]),
      lineage_determination:
        'Deprecation records, compatibility rules, and identity succession attest to unbroken lineage under deployment correlation REF-CORR-99201-B.',
      authority_conferred: false,
    }),
  }),

  'context-membership': Object.freeze({
    artifactId: 'EVD-TRUST-04-MEMBERSHIP',
    evidenceId: 'EVD-TRUST-04-MEMBERSHIP',
    source: 'trust' as const,
    classification: 'TRUST_CONTEXT_RESOLUTION' as const,
    version: '1.0.0',
    status: 'ACTIVE' as const,
    relevance: 'PRIMARY_PATH' as const,
    resolutionScope: 'trust-zone-perimeter-recognition',
    consistencyState: 'BOUNDARY_VERIFIED',
    correlationReferences: Object.freeze([
      'trust-zone-alpha',
      'strata://federation.stage-build.internal',
      'edge-telemetry-enclave',
    ]),
    supportingEvidence: Object.freeze([
      'EVD-META-02-CONTEXT',
      'EVD-CFG-02-BINDING',
      'EVD-IDN-03-TRUST-MEMBERSHIP',
    ]),
    requiredPrerequisites: Object.freeze([
      'EVD-META-02-CONTEXT',
      'EVD-CFG-02-BINDING',
      'EVD-IDN-03-TRUST-MEMBERSHIP',
    ]),
    content: Object.freeze({
      resolution_scope: 'trust-zone-perimeter-recognition',
      consistency_state: 'BOUNDARY_VERIFIED',
      trust_zone: 'trust-zone-alpha',
      federation_boundary: 'strata://federation.stage-build.internal',
      transitive_routing: 'DISABLED',
      boundary_recognition: 'ENCLAVE_PERIMETER_RECOGNIZED',
      supporting_evidence: Object.freeze([
        'EVD-META-02-CONTEXT',
        'EVD-CFG-02-BINDING',
        'EVD-IDN-03-TRUST-MEMBERSHIP',
      ]),
      perimeter_determination:
        'Perimeter membership establishes identity boundary recognition without conferring downstream execution or cross-boundary authority.',
      authority_conferred: false,
    }),
  }),

  'effective-interpretation': Object.freeze({
    artifactId: 'EVD-TRUST-05-INTERPRETATION',
    evidenceId: 'EVD-TRUST-05-INTERPRETATION',
    source: 'trust' as const,
    classification: 'EFFECTIVE_INTERPRETATION_RESOLUTION' as const,
    version: '1.0.0',
    status: 'ACTIVE' as const,
    relevance: 'PRIMARY_PATH' as const,
    resolutionScope: 'active-precedence-and-compatibility-evaluation',
    consistencyState: 'PRECEDENCE_ENFORCED',
    correlationReferences: Object.freeze([
      'wrk-hyperion-telemetry-edge',
      'REF-CORR-99201-B',
      'hyperion://identity/telemetry/collector-v2',
    ]),
    supportingEvidence: Object.freeze([
      'EVD-CFG-01-ACTIVE-SPEC',
      'EVD-CFG-04-COMPAT',
      'EVD-IDN-01-CONTEXT',
      'EVD-IDN-05-COMPAT',
    ]),
    requiredPrerequisites: Object.freeze([
      'EVD-CFG-01-ACTIVE-SPEC',
      'EVD-CFG-04-COMPAT',
      'EVD-IDN-01-CONTEXT',
      'EVD-IDN-05-COMPAT',
    ]),
    content: Object.freeze({
      resolution_scope: 'active-precedence-and-compatibility-evaluation',
      consistency_state: 'PRECEDENCE_ENFORCED',
      active_identity: 'hyperion://identity/telemetry/collector-v2',
      historical_reference: 'hyperion://identity/telemetry/collector-v1',
      precedence_hierarchy: 'ACTIVE > COMPATIBILITY > HISTORICAL_CONTEXT',
      compatibility_interpretation: 'HISTORICAL_ONLY',
      supporting_evidence: Object.freeze([
        'EVD-CFG-01-ACTIVE-SPEC',
        'EVD-CFG-04-COMPAT',
        'EVD-IDN-01-CONTEXT',
        'EVD-IDN-05-COMPAT',
      ]),
      resolution_principle:
        'Historical compatibility records preserve lineage provenance but cannot override active configuration specifications. Current runtime recognition is governed exclusively by active context.',
      authority_conferred: false,
    }),
  }),
});
