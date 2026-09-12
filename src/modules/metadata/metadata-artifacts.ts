import { EvidenceArtifact } from '../../evidence/evidence-types.js';

export const METADATA_ARTIFACTS: Record<string, EvidenceArtifact> = Object.freeze({
  'workload-profile': Object.freeze({
    evidenceId: 'EVD-META-01-PROFILE',
    source: 'metadata' as const,
    classification: 'WORKLOAD_SPECIFICATION' as const,
    relevance: 'PRIMARY_PATH' as const,
    correlationReferences: Object.freeze(['wrk-hyperion-telemetry-edge', 'trust-zone-alpha', 'enclave-integrity-anchor-889f']),
    content: Object.freeze({
      workload_id: 'wrk-hyperion-telemetry-edge',
      logical_partition: 'edge-telemetry-enclave',
      active_service_account: 'hyperion://identity/telemetry/collector-v2',
      assigned_tier: 'ingress-telemetry',
      trust_zone_ref: 'trust-zone-alpha',
      hardware_security_ref: 'enclave-integrity-anchor-889f',
    }),
  }),

  'execution-context': Object.freeze({
    evidenceId: 'EVD-META-02-CONTEXT',
    source: 'metadata' as const,
    classification: 'ENVIRONMENT_TOPOLOGY' as const,
    relevance: 'PRIMARY_PATH' as const,
    correlationReferences: Object.freeze(['edge-telemetry-enclave', 'trust-stage-build']),
    content: Object.freeze({
      enclave_id: 'edge-telemetry-enclave',
      node_epoch_window: 'epoch-window-2026-q3',
      isolation_level: 'isolated-hypervisor-partition',
      permitted_outbound_trust: 'trust-stage-build',
      direct_core_ingress: false,
      telemetry_channel: 'orbital-downlink-primary',
    }),
  }),

  'trust-boundary': Object.freeze({
    evidenceId: 'EVD-META-03-BOUNDARY',
    source: 'metadata' as const,
    classification: 'TRUST_RELATIONSHIP' as const,
    relevance: 'PRIMARY_PATH' as const,
    correlationReferences: Object.freeze(['strata://federation.stage-build.internal', 'arn:strata:iam::1337:role/DeploymentBridgeAuthority']),
    content: Object.freeze({
      source_boundary: 'edge-telemetry-enclave',
      target_federation_domain: 'strata://federation.stage-build.internal',
      intermediate_bridge_role: 'arn:strata:iam::1337:role/DeploymentBridgeAuthority',
      transitive_trust_enabled: false,
      delegation_ceiling: 2,
    }),
  }),

  'compatibility-record': Object.freeze({
    evidenceId: 'EVD-META-04-COMPAT',
    source: 'metadata' as const,
    classification: 'HISTORICAL_EVENT' as const,
    relevance: 'CORRELATION_CONTEXT' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B', 'aud-stream-rollout-99']),
    content: Object.freeze({
      compatibility_mode: 'strata-legacy-v1-fallback',
      legacy_deprecation_notice: 'v1 service accounts revoked as of deployment REF-CORR-99201-B',
      active_audit_stream_ref: 'aud-stream-rollout-99',
      correlation_trace_id: 'REF-CORR-99201-B',
      advisory: 'Legacy telemetry collectors using unmigrated credentials will trigger ERR_REVOKED_PRINCIPAL during attestation.',
    }),
  }),
});
