import { EvidenceArtifact } from '../../evidence/evidence-types.js';

export interface AuditEventRecord {
  readonly event_id: string;
  readonly timestamp: string;
  readonly event_type: string;
  readonly actor_reference: string;
  readonly resource_reference: string;
  readonly outcome: 'SUCCESS' | 'FAILED' | 'REJECTED' | 'REGISTERED';
  readonly correlation_id: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface AuditStreamPayload {
  readonly chronology_stream: string;
  readonly events: readonly AuditEventRecord[];
}

export const AUDIT_ARTIFACTS: Record<string, EvidenceArtifact<AuditStreamPayload>> = Object.freeze({
  'bootstrap-history': Object.freeze({
    evidenceId: 'EVD-AUD-01-BOOTSTRAP',
    source: 'audit' as const,
    classification: 'AUDIT_TRAIL' as const,
    relevance: 'CHRONOLOGY_ANCHOR' as const,
    correlationReferences: Object.freeze(['edge-telemetry-enclave', 'wrk-hyperion-telemetry-edge']),
    content: Object.freeze({
      chronology_stream: 'stream-bootstrap-partition-init',
      events: Object.freeze([
        Object.freeze({
          event_id: 'EVT-1001',
          timestamp: '2026-08-15T00:00:00Z',
          event_type: 'PARTITION_INITIALIZED',
          actor_reference: 'system:hypervisor:core',
          resource_reference: 'enclave:edge-telemetry-enclave',
          outcome: 'SUCCESS' as const,
          correlation_id: 'BOOT-INIT-001',
          details: Object.freeze({ isolation_tier: 'hardware-isolated', zone: 'trust-zone-alpha' }),
        }),
        Object.freeze({
          event_id: 'EVT-1002',
          timestamp: '2026-08-15T00:15:00Z',
          event_type: 'WORKLOAD_DOMAIN_ENROLLED',
          actor_reference: 'system:idp:edge',
          resource_reference: 'domain:https://identity.edge.hyperion.internal',
          outcome: 'SUCCESS' as const,
          correlation_id: 'BOOT-INIT-002',
          details: Object.freeze({ attestation_anchor: 'enclave-integrity-anchor-889f' }),
        }),
        Object.freeze({
          event_id: 'EVT-1003',
          timestamp: '2026-08-15T00:30:00Z',
          event_type: 'SERVICE_ACCOUNT_ENROLLED',
          actor_reference: 'system:provisioner',
          resource_reference: 'hyperion://identity/telemetry/collector-v1',
          outcome: 'SUCCESS' as const,
          correlation_id: 'BOOT-INIT-003',
          details: Object.freeze({ status: 'ACTIVE_INITIAL', workload_id: 'wrk-hyperion-telemetry-edge' }),
        }),
      ]),
    }),
  }),

  'trust-events': Object.freeze({
    evidenceId: 'EVD-AUD-02-TRUST',
    source: 'audit' as const,
    classification: 'AUDIT_TRAIL' as const,
    relevance: 'PRIMARY_PATH' as const,
    correlationReferences: Object.freeze(['strata://federation.stage-build.internal', 'arn:strata:iam::1337:role/DeploymentBridgeAuthority']),
    content: Object.freeze({
      chronology_stream: 'stream-federation-trust-agreements',
      events: Object.freeze([
        Object.freeze({
          event_id: 'EVT-2001',
          timestamp: '2026-08-20T10:00:00Z',
          event_type: 'FEDERATION_POLICY_BOUND',
          actor_reference: 'system:controlplane:security',
          resource_reference: 'federation:trust-stage-build',
          outcome: 'SUCCESS' as const,
          correlation_id: 'FED-AGREE-001',
          details: Object.freeze({
            source_enclave: 'edge-telemetry-enclave',
            target_domain: 'strata://federation.stage-build.internal',
          }),
        }),
        Object.freeze({
          event_id: 'EVT-2002',
          timestamp: '2026-08-20T10:05:00Z',
          event_type: 'TRUST_CONSTRAINT_APPLIED',
          actor_reference: 'system:policy:compiler',
          resource_reference: 'policy:federation-boundary',
          outcome: 'SUCCESS' as const,
          correlation_id: 'FED-AGREE-002',
          details: Object.freeze({
            transitive_delegation: 'DISABLED',
            allowed_audience: 'strata://federation.stage-build.internal',
            max_delegation_hops: 2,
          }),
        }),
        Object.freeze({
          event_id: 'EVT-2003',
          timestamp: '2026-08-20T10:10:00Z',
          event_type: 'ROLE_DELEGATION_BINDING',
          actor_reference: 'system:iam:admin',
          resource_reference: 'arn:strata:iam::1337:role/DeploymentBridgeAuthority',
          outcome: 'SUCCESS' as const,
          correlation_id: 'FED-AGREE-003',
          details: Object.freeze({ trust_bridge: true, session_tagging_permitted: true }),
        }),
      ]),
    }),
  }),

  'failed-transitions': Object.freeze({
    evidenceId: 'EVD-AUD-03-FAILS',
    source: 'audit' as const,
    classification: 'AUDIT_TRAIL' as const,
    relevance: 'PRIMARY_PATH' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-A', 'REF-CORR-99201-B']),
    content: Object.freeze({
      chronology_stream: 'stream-federation-exchange-exceptions',
      events: Object.freeze([
        Object.freeze({
          event_id: 'EVT-4090',
          timestamp: '2026-08-25T14:22:10Z',
          event_type: 'CROSS_ENCLAVE_EXCHANGE_REJECTED',
          actor_reference: 'hyperion://identity/telemetry/collector-v1',
          resource_reference: 'strata://federation.orbital-core.internal',
          outcome: 'REJECTED' as const,
          correlation_id: 'REF-CORR-99201-A',
          details: Object.freeze({
            reason: 'ERR_TRUST_BOUNDARY_VIOLATION',
            message: 'Inbound assertion issuer not trusted for requested audience. Direct ingress to orbital-core is prohibited.',
          }),
        }),
        Object.freeze({
          event_id: 'EVT-4091',
          timestamp: '2026-08-25T14:25:00Z',
          event_type: 'ROLLOUT_FAILURE_RECORD',
          actor_reference: 'system:rollout:agent',
          resource_reference: 'deployment:REF-CORR-99201-B',
          outcome: 'FAILED' as const,
          correlation_id: 'REF-CORR-99201-B',
          details: Object.freeze({
            reason: 'ERR_REVOKED_PRINCIPAL',
            message: 'Service account telemetry-collector-v1 revoked due to policy migration. Deprecation active.',
            trace_reference: 'aud-stream-rollout-99',
          }),
        }),
        Object.freeze({
          event_id: 'EVT-4092',
          timestamp: '2026-08-25T14:30:00Z',
          event_type: 'SERVICE_ACCOUNT_SUPERSEDED',
          actor_reference: 'system:provisioner',
          resource_reference: 'hyperion://identity/telemetry/collector-v2',
          outcome: 'SUCCESS' as const,
          correlation_id: 'REF-CORR-99201-B',
          details: Object.freeze({
            supersedes: 'hyperion://identity/telemetry/collector-v1',
            status: 'ACTIVE_PRODUCTION',
          }),
        }),
      ]),
    }),
  }),

  'correlation-records': Object.freeze({
    evidenceId: 'EVD-AUD-04-CORR',
    source: 'audit' as const,
    classification: 'AUDIT_TRAIL' as const,
    relevance: 'CORRELATION_CONTEXT' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B', 'policy:release-governance-boundary']),
    content: Object.freeze({
      chronology_stream: 'stream-controlplane-correlation-bindings',
      events: Object.freeze([
        Object.freeze({
          event_id: 'EVT-5001',
          timestamp: '2026-08-26T09:00:00Z',
          event_type: 'STATE_MACHINE_INITIALIZED',
          actor_reference: 'system:controlplane:orchestrator',
          resource_reference: 'pipeline:deployment-enclave-primary',
          outcome: 'SUCCESS' as const,
          correlation_id: 'CTRL-PIPELINE-001',
          details: Object.freeze({
            lifecycle_state: 'PROVISIONAL',
            progression_requirement:
              'Fabric pipeline governance requires multi-party confirmation from provisional to verified state prior to elevated execution.',
            governance_stream: 'stream-controlplane-correlation-bindings',
          }),
        }),
        Object.freeze({
          event_id: 'EVT-5002',
          timestamp: '2026-08-26T09:05:00Z',
          event_type: 'POLICY_CONDITION_ADVISORY',
          actor_reference: 'system:policy:enforcer',
          resource_reference: 'policy:release-governance-boundary',
          outcome: 'REGISTERED' as const,
          correlation_id: 'REF-CORR-99201-B',
          details: Object.freeze({
            lineage_check_required: true,
            condition_description:
              'Protected release governance requires verified audit lineage condition matching active deployment record.',
            proof_correlation_id: 'REF-CORR-99201-B',
          }),
        }),
        Object.freeze({
          event_id: 'EVT-5003',
          timestamp: '2026-08-26T09:10:00Z',
          event_type: 'STEPUP_ANCHOR_RECORDED',
          actor_reference: 'system:authenticator:stepup',
          resource_reference: 'mfa:stepup-anchor',
          outcome: 'SUCCESS' as const,
          correlation_id: 'REF-CORR-99201-B',
          details: Object.freeze({
            stepup_verification_anchor:
              'Privileged elevation context anchored to historical lineage proof REF-CORR-99201-B',
            proof_correlation_id: 'REF-CORR-99201-B',
          }),
        }),
      ]),
    }),
  }),
});
