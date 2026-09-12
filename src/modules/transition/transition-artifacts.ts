import type {
  CorrelationTransitionContent,
  ObservationTransitionContent,
  ReconciliationTransitionContent,
  TransitionArtifact,
} from './transition-types.js';

export const TRANSITION_ARTIFACTS: Readonly<{
  observation: TransitionArtifact<ObservationTransitionContent>;
  correlation: TransitionArtifact<CorrelationTransitionContent>;
  reconciliation: TransitionArtifact<ReconciliationTransitionContent>;
}> = Object.freeze({
  observation: Object.freeze({
    artifactId: 'EVD-TRANS-01-OBSERVATION',
    evidenceId: 'EVD-TRANS-01-OBSERVATION',
    source: 'transition' as const,
    version: '1.0.0',
    classification: 'OBSERVATION_TRANSITION' as const,
    relevance: 'PRIMARY_PATH' as const,
    fromState: 'UNINITIALIZED' as const,
    toState: 'OBSERVED' as const,
    consistencyState: 'COHERENT',
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    supportingEvidence: Object.freeze([
      'EVD-META-01-PROFILE',
      'EVD-META-02-CONTEXT',
      'EVD-AUD-01-BOOTSTRAP',
      'EVD-CFG-01-ACTIVE-SPEC',
      'EVD-IDN-01-CONTEXT',
    ]),
    interpretation:
      'Primary observational baseline established across enclave metadata, audit history, active configuration, and workload identity.',
    content: Object.freeze({
      transition_name: 'OBSERVATION',
      prior_state: 'UNINITIALIZED' as const,
      effective_state: 'OBSERVED' as const,
      observation_scope: 'ENCLAVE_ENVIRONMENT_BASELINE',
      consistency_state: 'COHERENT',
      supporting_evidence: Object.freeze([
        'EVD-META-01-PROFILE',
        'EVD-META-02-CONTEXT',
        'EVD-AUD-01-BOOTSTRAP',
        'EVD-CFG-01-ACTIVE-SPEC',
        'EVD-IDN-01-CONTEXT',
      ]),
      transition_determination: 'VALIDATED',
      authority_conferred: false,
    }),
  }),

  correlation: Object.freeze({
    artifactId: 'EVD-TRANS-02-CORRELATION',
    evidenceId: 'EVD-TRANS-02-CORRELATION',
    source: 'transition' as const,
    version: '1.0.0',
    classification: 'CORRELATION_TRANSITION' as const,
    relevance: 'PRIMARY_PATH' as const,
    fromState: 'OBSERVED' as const,
    toState: 'CORRELATED' as const,
    consistencyState: 'COHERENT',
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    supportingEvidence: Object.freeze([
      'EVD-TRUST-01-CONTEXT',
      'EVD-TRUST-02-BINDING',
    ]),
    interpretation:
      'Cross-domain trust relationships validated; context coherence and binding consistency established without conferring operational authority.',
    content: Object.freeze({
      transition_name: 'CORRELATION',
      prior_state: 'OBSERVED' as const,
      effective_state: 'CORRELATED' as const,
      correlation_scope: 'CROSS_DOMAIN_TRUST_RESOLUTION',
      consistency_state: 'COHERENT',
      supporting_evidence: Object.freeze([
        'EVD-TRUST-01-CONTEXT',
        'EVD-TRUST-02-BINDING',
      ]),
      transition_determination: 'VALIDATED',
      authority_conferred: false,
    }),
  }),

  reconciliation: Object.freeze({
    artifactId: 'EVD-TRANS-03-RECONCILIATION',
    evidenceId: 'EVD-TRANS-03-RECONCILIATION',
    source: 'transition' as const,
    version: '1.0.0',
    classification: 'RECONCILIATION_TRANSITION' as const,
    relevance: 'PRIMARY_PATH' as const,
    fromState: 'CORRELATED' as const,
    toState: 'RECONCILED' as const,
    consistencyState: 'COHERENT',
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    supportingEvidence: Object.freeze([
      'EVD-TRUST-03-LINEAGE',
      'EVD-TRUST-05-INTERPRETATION',
      'EVD-CFG-04-COMPAT',
    ]),
    interpretation:
      'Deterministic evidence model fully reconciled under precedence rules; historical succession continuity confirmed while active specification governs.',
    content: Object.freeze({
      transition_name: 'RECONCILIATION',
      prior_state: 'CORRELATED' as const,
      effective_state: 'RECONCILED' as const,
      reconciliation_scope: 'EFFECTIVE_INTERPRETATION_PRECEDENCE',
      consistency_state: 'COHERENT',
      supporting_evidence: Object.freeze([
        'EVD-TRUST-03-LINEAGE',
        'EVD-TRUST-05-INTERPRETATION',
        'EVD-CFG-04-COMPAT',
      ]),
      transition_determination: 'VALIDATED',
      authority_conferred: false,
    }),
  }),
});
