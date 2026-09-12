import { ConfigurationArtifact } from '../../evidence/evidence-types.js';

export interface ActiveSpecificationContent {
  readonly specification_id: string;
  readonly effective_epoch: string;
  readonly enclave_partition: string;
  readonly workload_binding: string;
  readonly authoritative_principal: string;
  readonly predecessor_principal: string;
  readonly attestation_authority: string;
  readonly egress_profile_ref: string;
  readonly specification_digest: string;
}

export interface BindingProfileContent {
  readonly binding_id: string;
  readonly workload_id: string;
  readonly hardware_security_anchor: string;
  readonly zone_membership: string;
  readonly isolation_policy: string;
  readonly integrity_verification: string;
  readonly runtime_attestation_required: boolean;
}

export interface FederationMatrixContent {
  readonly matrix_id: string;
  readonly source_enclave: string;
  readonly permitted_target_domains: readonly string[];
  readonly prohibited_target_domains: readonly string[];
  readonly intermediate_bridge_role: string;
  readonly delegation_hop_ceiling: number;
  readonly transitive_routing: boolean;
}

export interface CompatibilityRulesContent {
  readonly rule_id: string;
  readonly compatibility_mode: string;
  readonly active_specification_supersedes: boolean;
  readonly legacy_principal: string;
  readonly successor_principal: string;
  readonly deprecation_reference: string;
  readonly lineage_proof_required: boolean;
  readonly advisory: string;
}

export interface IntegrityRuleItem {
  readonly rule_code: string;
  readonly description: string;
  readonly anchor_reference?: string;
  readonly active_status_enforced?: boolean;
  readonly lineage_reference?: string;
  readonly target_role?: string;
}

export interface IntegrityConstraintsContent {
  readonly constraint_id: string;
  readonly rules: readonly IntegrityRuleItem[];
}

export const CONFIG_ARTIFACTS: Record<string, ConfigurationArtifact> = Object.freeze({
  'active-specification': Object.freeze({
    artifactId: 'EVD-CFG-01-ACTIVE-SPEC',
    evidenceId: 'EVD-CFG-01-ACTIVE-SPEC',
    source: 'config' as const,
    classification: 'CONFIGURATION_SPECIFICATION' as const,
    version: '2.4.0',
    status: 'ACTIVE' as const,
    relevance: 'PRIMARY_PATH' as const,
    correlationReferences: Object.freeze([
      'edge-telemetry-enclave',
      'wrk-hyperion-telemetry-edge',
      'spec-fed-boundary-stage',
    ]),
    content: Object.freeze({
      specification_id: 'spec-edge-telemetry-active',
      effective_epoch: 'epoch-window-2026-q3',
      enclave_partition: 'edge-telemetry-enclave',
      workload_binding: 'wrk-hyperion-telemetry-edge',
      authoritative_principal: 'hyperion://identity/telemetry/collector-v2',
      predecessor_principal: 'hyperion://identity/telemetry/collector-v1',
      attestation_authority: 'https://identity.edge.hyperion.internal',
      egress_profile_ref: 'spec-fed-boundary-stage',
      specification_digest: 'digest-sha256:7f4a2118e90c5a2c',
    }),
  }),

  'binding-profile': Object.freeze({
    artifactId: 'EVD-CFG-02-BINDING',
    evidenceId: 'EVD-CFG-02-BINDING',
    source: 'config' as const,
    classification: 'BINDING_PROFILE' as const,
    version: '2.4.0',
    status: 'ACTIVE' as const,
    relevance: 'PRIMARY_PATH' as const,
    correlationReferences: Object.freeze([
      'wrk-hyperion-telemetry-edge',
      'enclave-integrity-anchor-889f',
      'trust-zone-alpha',
    ]),
    content: Object.freeze({
      binding_id: 'bind-workload-enclave-01',
      workload_id: 'wrk-hyperion-telemetry-edge',
      hardware_security_anchor: 'enclave-integrity-anchor-889f',
      zone_membership: 'trust-zone-alpha',
      isolation_policy: 'isolated-hypervisor-partition',
      integrity_verification: 'hardware-enforced',
      runtime_attestation_required: true,
    }),
  }),

  'federation-matrix': Object.freeze({
    artifactId: 'EVD-CFG-03-FED-MATRIX',
    evidenceId: 'EVD-CFG-03-FED-MATRIX',
    source: 'config' as const,
    classification: 'TRUST_RELATIONSHIP' as const,
    version: '2.4.0',
    status: 'ACTIVE' as const,
    relevance: 'PRIMARY_PATH' as const,
    correlationReferences: Object.freeze([
      'strata://federation.stage-build.internal',
      'trust-stage-build',
      'arn:strata:iam::1337:role/DeploymentBridgeAuthority',
    ]),
    content: Object.freeze({
      matrix_id: 'fed-matrix-edge-stage',
      source_enclave: 'edge-telemetry-enclave',
      permitted_target_domains: Object.freeze(['strata://federation.stage-build.internal']),
      prohibited_target_domains: Object.freeze(['strata://federation.orbital-core.internal']),
      intermediate_bridge_role: 'arn:strata:iam::1337:role/DeploymentBridgeAuthority',
      delegation_hop_ceiling: 2,
      transitive_routing: false,
    }),
  }),

  'compatibility-rules': Object.freeze({
    artifactId: 'EVD-CFG-04-COMPAT',
    evidenceId: 'EVD-CFG-04-COMPAT',
    source: 'config' as const,
    classification: 'COMPATIBILITY_RULE' as const,
    version: '1.1.0',
    status: 'COMPATIBILITY' as const,
    relevance: 'CORRELATION_CONTEXT' as const,
    correlationReferences: Object.freeze([
      'REF-CORR-99201-B',
      'hyperion://identity/telemetry/collector-v1',
      'hyperion://identity/telemetry/collector-v2',
    ]),
    content: Object.freeze({
      rule_id: 'rule-compat-v1-fallback',
      compatibility_mode: 'strata-legacy-v1-fallback',
      active_specification_supersedes: true,
      legacy_principal: 'hyperion://identity/telemetry/collector-v1',
      successor_principal: 'hyperion://identity/telemetry/collector-v2',
      deprecation_reference: 'REF-CORR-99201-B',
      lineage_proof_required: true,
      advisory:
        'Legacy principal assertions are strictly rejected under active policy; historical trace reference remains part of the preserved lineage record.',
    }),
  }),

  'integrity-constraints': Object.freeze({
    artifactId: 'EVD-CFG-05-INTEGRITY',
    evidenceId: 'EVD-CFG-05-INTEGRITY',
    source: 'config' as const,
    classification: 'INTEGRITY_CONSTRAINT' as const,
    version: '2.4.0',
    status: 'ACTIVE' as const,
    relevance: 'PRIMARY_PATH' as const,
    correlationReferences: Object.freeze([
      'enclave-integrity-anchor-889f',
      'REF-CORR-99201-B',
      'arn:strata:iam::1337:role/DeploymentBridgeAuthority',
    ]),
    content: Object.freeze({
      constraint_id: 'cnstr-fabric-integrity-rules',
      rules: Object.freeze([
        Object.freeze({
          rule_code: 'INT-RULE-01',
          description:
            'Workload identity claims must bind to the integrity anchor assigned to the enclave partition.',
          anchor_reference: 'enclave-integrity-anchor-889f',
        }),
        Object.freeze({
          rule_code: 'INT-RULE-02',
          description:
            'Active specification v2.4.0 strictly supersedes compatibility profile v1.1.0; compatibility mode does not grant authority.',
          active_status_enforced: true,
        }),
        Object.freeze({
          rule_code: 'INT-RULE-03',
          description:
            'Delegated execution authority requires provenance validation; verified lineage consistency is required across execution context.',
          lineage_reference: 'REF-CORR-99201-B',
          target_role: 'arn:strata:iam::1337:role/DeploymentBridgeAuthority',
        }),
      ]),
    }),
  }),
});
