import type {
  BoundaryConstraintContent,
  ConstraintArtifact,
  ContinuityConstraintContent,
  ReconciliationConstraintContent,
  SpecificationConstraintContent,
} from './constraint-types.js';

export const CONSTRAINT_ARTIFACTS: Readonly<{
  specification: ConstraintArtifact<SpecificationConstraintContent>;
  continuity: ConstraintArtifact<ContinuityConstraintContent>;
  boundary: ConstraintArtifact<BoundaryConstraintContent>;
  reconciliation: ConstraintArtifact<ReconciliationConstraintContent>;
}> = Object.freeze({
  specification: Object.freeze({
    artifactId: 'EVD-CONSTRAINT-01-SPECIFICATION',
    evidenceId: 'EVD-CONSTRAINT-01-SPECIFICATION',
    source: 'constraint' as const,
    version: '1.0.0',
    classification: 'SPECIFICATION_CONSTRAINT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    subject: 'hyperion://spec/enclave/execution-profile-v2',
    assertions: Object.freeze([
      'The formally maintained enclave execution profile articulates structural parameters for runtime partition components.',
      'Historical declarations and legacy bindings remain documented across predecessor configuration and audit records.',
      'Runtime partition boundaries establish isolated component execution environments within the enclave topology.',
    ]),
    relationships: Object.freeze([
      Object.freeze({
        related_evidence: 'EVD-CFG-01-ACTIVE-SPEC',
        relationship_type: 'GOVERNING_SPECIFICATION',
      }),
      Object.freeze({
        related_evidence: 'EVD-IDN-01-CONTEXT',
        relationship_type: 'ACTIVE_IDENTITY_ALIGNMENT',
      }),
      Object.freeze({
        related_evidence: 'EVD-CFG-05-INTEGRITY',
        relationship_type: 'STRUCTURAL_INVARIANT',
      }),
    ]),
    interpretation:
      'The formally maintained execution profile defines structural parameters for components operating within the isolated enclave partition.',
    content: Object.freeze({
      constraint_type: 'SPECIFICATION_GOVERNANCE',
      governed_subject: 'hyperion://spec/enclave/execution-profile-v2',
      specification_ref: 'SPEC-HYPERION-ENCLAVE-V2',
      active_structural_boundary: 'ISOLATED_ENCLAVE_PARTITION',
      declarative_assertions: Object.freeze([
        'The formally maintained enclave execution profile articulates structural parameters for runtime partition components.',
        'Historical declarations and legacy bindings remain documented across predecessor configuration and audit records.',
        'Runtime partition boundaries establish isolated component execution environments within the enclave topology.',
      ]),
      contextual_relationships: Object.freeze([
        Object.freeze({
          related_evidence: 'EVD-CFG-01-ACTIVE-SPEC',
          relationship_type: 'GOVERNING_SPECIFICATION',
        }),
        Object.freeze({
          related_evidence: 'EVD-IDN-01-CONTEXT',
          relationship_type: 'ACTIVE_IDENTITY_ALIGNMENT',
        }),
        Object.freeze({
          related_evidence: 'EVD-CFG-05-INTEGRITY',
          relationship_type: 'STRUCTURAL_INVARIANT',
        }),
      ]),
      interpretation:
        'The formally maintained execution profile defines structural parameters for components operating within the isolated enclave partition.',
    }),
  }),

  continuity: Object.freeze({
    artifactId: 'EVD-CONSTRAINT-02-CONTINUITY',
    evidenceId: 'EVD-CONSTRAINT-02-CONTINUITY',
    source: 'constraint' as const,
    version: '1.0.0',
    classification: 'CONTINUITY_CONSTRAINT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    subject: 'REF-CORR-99201-B',
    assertions: Object.freeze([
      'Correlation references anchor succession lineage across iterative lifecycle versions.',
      'Compatibility records and transition audit trails document evolutionary provenance across preceding iterations.',
      'Identifier collector-v1 is recorded as predecessor lineage for telemetry-collector-v2 under correlation anchor REF-CORR-99201-B.',
    ]),
    relationships: Object.freeze([
      Object.freeze({
        related_evidence: 'EVD-IDN-04-LINEAGE',
        relationship_type: 'SUCCESSION_RECORD',
      }),
      Object.freeze({
        related_evidence: 'EVD-CFG-04-COMPAT',
        relationship_type: 'COMPATIBILITY_CONTEXT',
      }),
      Object.freeze({
        related_evidence: 'EVD-AUD-03-FAILS',
        relationship_type: 'AUDIT_CONTINUITY',
      }),
      Object.freeze({
        related_evidence: 'EVD-TRUST-03-LINEAGE',
        relationship_type: 'TRUST_CONTINUITY',
      }),
    ]),
    interpretation:
      'Succession lineage and compatibility records preserve trace continuity for component evolution under correlation anchor REF-CORR-99201-B.',
    content: Object.freeze({
      constraint_type: 'LINEAGE_CONTINUITY',
      governed_subject: 'REF-CORR-99201-B',
      lineage_anchor_ref: 'hyperion://identity/telemetry/collector-v1',
      trace_continuity: 'CONFIRMED_SUCCESSION',
      declarative_assertions: Object.freeze([
        'Correlation references anchor succession lineage across iterative lifecycle versions.',
        'Compatibility records and transition audit trails document evolutionary provenance across preceding iterations.',
        'Identifier collector-v1 is recorded as predecessor lineage for telemetry-collector-v2 under correlation anchor REF-CORR-99201-B.',
      ]),
      contextual_relationships: Object.freeze([
        Object.freeze({
          related_evidence: 'EVD-IDN-04-LINEAGE',
          relationship_type: 'SUCCESSION_RECORD',
        }),
        Object.freeze({
          related_evidence: 'EVD-CFG-04-COMPAT',
          relationship_type: 'COMPATIBILITY_CONTEXT',
        }),
        Object.freeze({
          related_evidence: 'EVD-AUD-03-FAILS',
          relationship_type: 'AUDIT_CONTINUITY',
        }),
        Object.freeze({
          related_evidence: 'EVD-TRUST-03-LINEAGE',
          relationship_type: 'TRUST_CONTINUITY',
        }),
      ]),
      interpretation:
        'Succession lineage and compatibility records preserve trace continuity for component evolution under correlation anchor REF-CORR-99201-B.',
    }),
  }),

  boundary: Object.freeze({
    artifactId: 'EVD-CONSTRAINT-03-BOUNDARY',
    evidenceId: 'EVD-CONSTRAINT-03-BOUNDARY',
    source: 'constraint' as const,
    version: '1.0.0',
    classification: 'BOUNDARY_CONSTRAINT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    subject: 'trust-zone-alpha',
    assertions: Object.freeze([
      'Workload association with a perimeter boundary reflects shared environmental containment within trust-zone-alpha.',
      'Multi-principal membership within trust-zone-alpha demarcates perimeter co-location across distinct functional workloads.',
      'Contextual relationships document perimeter boundaries and hardware affinity mappings within the enclave topology.',
    ]),
    relationships: Object.freeze([
      Object.freeze({
        related_evidence: 'EVD-IDN-03-TRUST-MEMBERSHIP',
        relationship_type: 'PERIMETER_MEMBERSHIP',
      }),
      Object.freeze({
        related_evidence: 'EVD-META-02-CONTEXT',
        relationship_type: 'ENVIRONMENTAL_CONTAINMENT',
      }),
      Object.freeze({
        related_evidence: 'EVD-META-03-BOUNDARY',
        relationship_type: 'TOPOLOGY_BOUNDARY',
      }),
      Object.freeze({
        related_evidence: 'EVD-CFG-02-BINDING',
        relationship_type: 'HARDWARE_AFFINITY',
      }),
      Object.freeze({
        related_evidence: 'EVD-TRUST-04-MEMBERSHIP',
        relationship_type: 'TRUST_MEMBERSHIP_COHERENCE',
      }),
    ]),
    interpretation:
      'Perimeter membership and environmental adjacency demarcate co-location boundaries within the trust-zone-alpha perimeter.',
    content: Object.freeze({
      constraint_type: 'ZONE_PERIMETER_DELIMITATION',
      governed_subject: 'trust-zone-alpha',
      perimeter_anchor: 'ENCLAVE_PARTITION_0',
      boundary_scope: 'MULTI_PRINCIPAL_CONTAINMENT',
      containment_mode: 'ENVIRONMENTAL_DELIMITATION',
      declarative_assertions: Object.freeze([
        'Workload association with a perimeter boundary reflects shared environmental containment within trust-zone-alpha.',
        'Multi-principal membership within trust-zone-alpha demarcates perimeter co-location across distinct functional workloads.',
        'Contextual relationships document perimeter boundaries and hardware affinity mappings within the enclave topology.',
      ]),
      contextual_relationships: Object.freeze([
        Object.freeze({
          related_evidence: 'EVD-IDN-03-TRUST-MEMBERSHIP',
          relationship_type: 'PERIMETER_MEMBERSHIP',
        }),
        Object.freeze({
          related_evidence: 'EVD-META-02-CONTEXT',
          relationship_type: 'ENVIRONMENTAL_CONTAINMENT',
        }),
        Object.freeze({
          related_evidence: 'EVD-META-03-BOUNDARY',
          relationship_type: 'TOPOLOGY_BOUNDARY',
        }),
        Object.freeze({
          related_evidence: 'EVD-CFG-02-BINDING',
          relationship_type: 'HARDWARE_AFFINITY',
        }),
        Object.freeze({
          related_evidence: 'EVD-TRUST-04-MEMBERSHIP',
          relationship_type: 'TRUST_MEMBERSHIP_COHERENCE',
        }),
      ]),
      interpretation:
        'Perimeter membership and environmental adjacency demarcate co-location boundaries within the trust-zone-alpha perimeter.',
    }),
  }),

  reconciliation: Object.freeze({
    artifactId: 'EVD-CONSTRAINT-04-RECONCILIATION',
    evidenceId: 'EVD-CONSTRAINT-04-RECONCILIATION',
    source: 'constraint' as const,
    version: '1.0.0',
    classification: 'RECONCILIATION_CONSTRAINT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    subject: 'hyperion://spec/enclave/reconciliation-context',
    assertions: Object.freeze([
      'Disparate records describing the same operational entity operate across distinct analytical dimensions.',
      'Maintained specifications document structural parameters, continuity records anchor succession lineage, and boundary memberships establish perimeter scope.',
      'Coherent evidence reconciliation requires synthesizing structural, continuity, and perimeter dimensions across the operational evidence model.',
    ]),
    relationships: Object.freeze([
      Object.freeze({
        related_evidence: 'EVD-CONSTRAINT-01-SPECIFICATION',
        relationship_type: 'STRUCTURAL_DIMENSION',
      }),
      Object.freeze({
        related_evidence: 'EVD-CONSTRAINT-02-CONTINUITY',
        relationship_type: 'CONTINUITY_DIMENSION',
      }),
      Object.freeze({
        related_evidence: 'EVD-CONSTRAINT-03-BOUNDARY',
        relationship_type: 'BOUNDARY_DIMENSION',
      }),
      Object.freeze({
        related_evidence: 'EVD-TRUST-05-INTERPRETATION',
        relationship_type: 'INTERPRETATION_SYNTHESIS',
      }),
      Object.freeze({
        related_evidence: 'EVD-TRANS-03-RECONCILIATION',
        relationship_type: 'RECONCILED_PROGRESSION',
      }),
    ]),
    interpretation:
      'Multi-dimensional evidence reconciliation establishes operational coherence by correlating structural parameters, succession records, and perimeter boundaries within the enclave fabric.',
    content: Object.freeze({
      constraint_type: 'CROSS_DOMAIN_RECONCILIATION',
      governed_subject: 'hyperion://spec/enclave/reconciliation-context',
      reconciliation_invariant: 'DIMENSIONAL_ROLE_PRESERVATION',
      synthesis_model: 'MULTI_DIMENSIONAL_ALIGNMENT',
      declarative_assertions: Object.freeze([
        'Disparate records describing the same operational entity operate across distinct analytical dimensions.',
        'Maintained specifications document structural parameters, continuity records anchor succession lineage, and boundary memberships establish perimeter scope.',
        'Coherent evidence reconciliation requires synthesizing structural, continuity, and perimeter dimensions across the operational evidence model.',
      ]),
      contextual_relationships: Object.freeze([
        Object.freeze({
          related_evidence: 'EVD-CONSTRAINT-01-SPECIFICATION',
          relationship_type: 'STRUCTURAL_DIMENSION',
        }),
        Object.freeze({
          related_evidence: 'EVD-CONSTRAINT-02-CONTINUITY',
          relationship_type: 'CONTINUITY_DIMENSION',
        }),
        Object.freeze({
          related_evidence: 'EVD-CONSTRAINT-03-BOUNDARY',
          relationship_type: 'BOUNDARY_DIMENSION',
        }),
        Object.freeze({
          related_evidence: 'EVD-TRUST-05-INTERPRETATION',
          relationship_type: 'INTERPRETATION_SYNTHESIS',
        }),
        Object.freeze({
          related_evidence: 'EVD-TRANS-03-RECONCILIATION',
          relationship_type: 'RECONCILED_PROGRESSION',
        }),
      ]),
      interpretation:
        'Multi-dimensional evidence reconciliation establishes operational coherence by correlating structural parameters, succession records, and perimeter boundaries within the enclave fabric.',
    }),
  }),
});
