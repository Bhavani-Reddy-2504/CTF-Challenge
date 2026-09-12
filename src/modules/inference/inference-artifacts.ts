import type { InferenceArtifact } from '../../evidence/evidence-types.js';
import type {
  BoundaryInferenceContent,
  ConvergenceInferenceContent,
  LineageInferenceContent,
  ReconciliationInferenceContent,
  SpecificationInferenceContent,
} from './inference-types.js';

export interface InferenceArtifactMap {
  readonly 'specification-model': InferenceArtifact<SpecificationInferenceContent>;
  readonly 'lineage-model': InferenceArtifact<LineageInferenceContent>;
  readonly 'boundary-model': InferenceArtifact<BoundaryInferenceContent>;
  readonly 'reconciliation-model': InferenceArtifact<ReconciliationInferenceContent>;
  readonly convergence: InferenceArtifact<ConvergenceInferenceContent>;
}

/**
 * Canonical Inference Artifacts for StrataCore: The Hyperion Enclave Fabric.
 *
 * Exposes exactly five deterministic, read-only inference models.
 * Strictly adheres to Prompt 10 requirements:
 * - Zero Boolean oracles in player-visible content
 * - Zero score, rank, weight, priority, confidence, or likelihood fields
 * - Zero winner or answer indicators
 * - Controlled ambiguity: models are internally coherent and describe distinct dimensions
 */
export const INFERENCE_ARTIFACTS: Readonly<InferenceArtifactMap> = Object.freeze({
  'specification-model': Object.freeze({
    artifactId: 'EVD-INFER-01-SPECIFICATION',
    evidenceId: 'EVD-INFER-01-SPECIFICATION',
    source: 'inference' as const,
    version: '1.0.0',
    classification: 'SPECIFICATION_INFERENCE_MODEL' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    modelReference: 'MODEL-SPEC-STRUCTURAL-CONSISTENCY',
    interpretiveScope: 'STRUCTURAL_CONFIGURATION',
    consistencyDomain: 'ENCLAVE_SPECIFICATION',
    correlatedEvidence: Object.freeze([
      'EVD-CFG-01-ACTIVE-SPEC',
      'EVD-CONSTRAINT-01-SPECIFICATION',
      'EVD-TRUST-02-BINDING',
    ]),
    synthesisNotes:
      'Structural configuration model evaluates declarative parameters and cryptographic binding requirements against the maintained execution profile.',
    content: Object.freeze({
      model_id: 'MODEL-SPEC-STRUCTURAL-CONSISTENCY',
      governed_dimension: 'STRUCTURAL_CONFIGURATION',
      model_reference: 'MODEL-SPEC-STRUCTURAL-CONSISTENCY',
      interpretive_scope: 'STRUCTURAL_CONFIGURATION',
      consistency_domain: 'ENCLAVE_SPECIFICATION',
      correlated_evidence: Object.freeze([
        'EVD-CFG-01-ACTIVE-SPEC',
        'EVD-CONSTRAINT-01-SPECIFICATION',
        'EVD-TRUST-02-BINDING',
      ]),
      candidate_hypotheses: Object.freeze([
        Object.freeze({
          hypothesis_id: 'HYP-SPEC-01',
          premise: 'Execution profile v2 defines current runtime structural parameters.',
          interpretive_implication:
            'Structural integrity requires adherence to maintained configuration v2 without incorporating historical version definitions.',
        }),
        Object.freeze({
          hypothesis_id: 'HYP-SPEC-02',
          premise: 'Hardware cryptographic binding profile governs runtime partition isolation.',
          interpretive_implication:
            'Enclave workloads must satisfy key-binding constraints established under the active profile.',
        }),
      ]),
      declarative_assertions: Object.freeze([
        'The maintained structural specification establishes declarative configuration boundaries for enclave execution.',
        'Cryptographic binding profiles bind hardware affinity to execution profile parameters.',
        'Structural consistency models configuration adherence based on maintained enclave profiles.',
      ]),
      contextual_relationships: Object.freeze([
        Object.freeze({
          related_evidence: 'EVD-CFG-01-ACTIVE-SPEC',
          relationship_type: 'SPECIFICATION_BASELINE',
        }),
        Object.freeze({
          related_evidence: 'EVD-CONSTRAINT-01-SPECIFICATION',
          relationship_type: 'STRUCTURAL_CONSTRAINT',
        }),
        Object.freeze({
          related_evidence: 'EVD-TRUST-02-BINDING',
          relationship_type: 'CRYPTOGRAPHIC_BINDING',
        }),
      ]),
      synthesis_notes:
        'Structural configuration model evaluates declarative parameters and cryptographic binding requirements against the maintained execution profile.',
    }),
  }),

  'lineage-model': Object.freeze({
    artifactId: 'EVD-INFER-02-LINEAGE',
    evidenceId: 'EVD-INFER-02-LINEAGE',
    source: 'inference' as const,
    version: '1.0.0',
    classification: 'LINEAGE_INFERENCE_MODEL' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    modelReference: 'MODEL-LINEAGE-SUCCESSION-TRACE',
    interpretiveScope: 'HISTORICAL_SUCCESSION',
    consistencyDomain: 'CAUSAL_AUDIT_TRAIL',
    correlatedEvidence: Object.freeze([
      'EVD-AUD-03-FAILS',
      'EVD-CFG-04-COMPAT',
      'EVD-IDN-04-LINEAGE',
      'EVD-CONSTRAINT-02-CONTINUITY',
    ]),
    synthesisNotes:
      'Succession lineage model evaluates continuity across component evolution and recorded failure audit traces under correlation anchor REF-CORR-99201-B.',
    content: Object.freeze({
      model_id: 'MODEL-LINEAGE-SUCCESSION-TRACE',
      governed_dimension: 'HISTORICAL_SUCCESSION',
      model_reference: 'MODEL-LINEAGE-SUCCESSION-TRACE',
      interpretive_scope: 'HISTORICAL_SUCCESSION',
      consistency_domain: 'CAUSAL_AUDIT_TRAIL',
      correlated_evidence: Object.freeze([
        'EVD-AUD-03-FAILS',
        'EVD-CFG-04-COMPAT',
        'EVD-IDN-04-LINEAGE',
        'EVD-CONSTRAINT-02-CONTINUITY',
      ]),
      candidate_hypotheses: Object.freeze([
        Object.freeze({
          hypothesis_id: 'HYP-LINEAGE-01',
          premise: 'Component succession maintains historical trace continuity across version updates.',
          interpretive_implication:
            'Historical identity collector-v1 preserves audit trail lineage without governing active structural execution.',
        }),
        Object.freeze({
          hypothesis_id: 'HYP-LINEAGE-02',
          premise: 'Recorded failure events in audit history reflect compatibility validation iterations.',
          interpretive_implication:
            'Audit records document evolutionary progression rather than active operational fault states.',
        }),
      ]),
      declarative_assertions: Object.freeze([
        'Succession trace continuity preserves component evolution history under correlation anchor REF-CORR-99201-B.',
        'Compatibility profiles document transitional compatibility rules across component generations.',
        'Lineage records provide causal audit attribution across sequential deployment epochs.',
      ]),
      contextual_relationships: Object.freeze([
        Object.freeze({
          related_evidence: 'EVD-AUD-03-FAILS',
          relationship_type: 'FAILURE_AUDIT_TRACE',
        }),
        Object.freeze({
          related_evidence: 'EVD-CFG-04-COMPAT',
          relationship_type: 'COMPATIBILITY_CONTEXT',
        }),
        Object.freeze({
          related_evidence: 'EVD-IDN-04-LINEAGE',
          relationship_type: 'SUCCESSION_RECORD',
        }),
        Object.freeze({
          related_evidence: 'EVD-CONSTRAINT-02-CONTINUITY',
          relationship_type: 'CONTINUITY_CONSTRAINT',
        }),
      ]),
      synthesis_notes:
        'Succession lineage model evaluates continuity across component evolution and recorded failure audit traces under correlation anchor REF-CORR-99201-B.',
    }),
  }),

  'boundary-model': Object.freeze({
    artifactId: 'EVD-INFER-03-BOUNDARY',
    evidenceId: 'EVD-INFER-03-BOUNDARY',
    source: 'inference' as const,
    version: '1.0.0',
    classification: 'BOUNDARY_INFERENCE_MODEL' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    modelReference: 'MODEL-BOUNDARY-ENVIRONMENTAL-DELIMITATION',
    interpretiveScope: 'ENVIRONMENTAL_CONTAINMENT',
    consistencyDomain: 'TOPOLOGY_PERIMETER',
    correlatedEvidence: Object.freeze([
      'EVD-META-02-CONTEXT',
      'EVD-IDN-03-TRUST-MEMBERSHIP',
      'EVD-CONSTRAINT-03-BOUNDARY',
    ]),
    synthesisNotes:
      'Perimeter boundary model evaluates environmental containment and multi-principal demarcation within trust-zone-alpha.',
    content: Object.freeze({
      model_id: 'MODEL-BOUNDARY-ENVIRONMENTAL-DELIMITATION',
      governed_dimension: 'ENVIRONMENTAL_CONTAINMENT',
      model_reference: 'MODEL-BOUNDARY-ENVIRONMENTAL-DELIMITATION',
      interpretive_scope: 'ENVIRONMENTAL_CONTAINMENT',
      consistency_domain: 'TOPOLOGY_PERIMETER',
      correlated_evidence: Object.freeze([
        'EVD-META-02-CONTEXT',
        'EVD-IDN-03-TRUST-MEMBERSHIP',
        'EVD-CONSTRAINT-03-BOUNDARY',
      ]),
      candidate_hypotheses: Object.freeze([
        Object.freeze({
          hypothesis_id: 'HYP-BOUND-01',
          premise: 'Trust zone containment defines environmental boundary scope across co-located workloads.',
          interpretive_implication:
            'Shared containment within trust-zone-alpha demarcates perimeter adjacency without establishing structural equivalence.',
        }),
        Object.freeze({
          hypothesis_id: 'HYP-BOUND-02',
          premise: 'Hardware affinity binds multi-principal workloads to enclave partition ENCLAVE_PARTITION_0.',
          interpretive_implication:
            'Co-location within partition topology delineates boundary constraints without merging functional identities.',
        }),
      ]),
      declarative_assertions: Object.freeze([
        'Perimeter boundary containment defines environmental co-location within trust-zone-alpha.',
        'Multi-principal membership documents shared perimeter topology across distinct workloads.',
        'Hardware partition mappings isolate perimeter execution domains.',
      ]),
      contextual_relationships: Object.freeze([
        Object.freeze({
          related_evidence: 'EVD-META-02-CONTEXT',
          relationship_type: 'ENVIRONMENTAL_CONTEXT',
        }),
        Object.freeze({
          related_evidence: 'EVD-IDN-03-TRUST-MEMBERSHIP',
          relationship_type: 'TRUST_MEMBERSHIP',
        }),
        Object.freeze({
          related_evidence: 'EVD-CONSTRAINT-03-BOUNDARY',
          relationship_type: 'PERIMETER_CONSTRAINT',
        }),
      ]),
      synthesis_notes:
        'Perimeter boundary model evaluates environmental containment and multi-principal demarcation within trust-zone-alpha.',
    }),
  }),

  'reconciliation-model': Object.freeze({
    artifactId: 'EVD-INFER-04-RECONCILIATION',
    evidenceId: 'EVD-INFER-04-RECONCILIATION',
    source: 'inference' as const,
    version: '1.0.0',
    classification: 'RECONCILIATION_INFERENCE_MODEL' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    modelReference: 'MODEL-RECON-CROSS-DIMENSIONAL-SYNTHESIS',
    interpretiveScope: 'CROSS_DOMAIN_COHERENCE',
    consistencyDomain: 'DIMENSIONAL_SYNTHESIS',
    correlatedEvidence: Object.freeze([
      'EVD-TRANS-03-RECONCILIATION',
      'EVD-CONSTRAINT-04-RECONCILIATION',
      'EVD-TRUST-05-INTERPRETATION',
    ]),
    synthesisNotes:
      'Cross-domain reconciliation model synthesizes structural configuration, historical succession, and perimeter containment dimensions.',
    content: Object.freeze({
      model_id: 'MODEL-RECON-CROSS-DIMENSIONAL-SYNTHESIS',
      governed_dimension: 'CROSS_DOMAIN_COHERENCE',
      model_reference: 'MODEL-RECON-CROSS-DIMENSIONAL-SYNTHESIS',
      interpretive_scope: 'CROSS_DOMAIN_COHERENCE',
      consistency_domain: 'DIMENSIONAL_SYNTHESIS',
      correlated_evidence: Object.freeze([
        'EVD-TRANS-03-RECONCILIATION',
        'EVD-CONSTRAINT-04-RECONCILIATION',
        'EVD-TRUST-05-INTERPRETATION',
      ]),
      candidate_hypotheses: Object.freeze([
        Object.freeze({
          hypothesis_id: 'HYP-RECON-01',
          premise: 'Multi-dimensional evidence requires simultaneous synthesis across distinct functional domains.',
          interpretive_implication:
            'Structural baseline, historical trace, and boundary delimitation operate in orthogonal dimensions without mutual displacement.',
        }),
        Object.freeze({
          hypothesis_id: 'HYP-RECON-02',
          premise: 'State progression to reconciled baseline preserves dimensional integrity across domain records.',
          interpretive_implication:
            'Reconciled interpretation synthesizes evidence relationships without subordinating one dimension to another.',
        }),
      ]),
      declarative_assertions: Object.freeze([
        'Cross-domain reconciliation synthesizes orthogonal evidence dimensions into a coherent operational model.',
        'Reconciliation transitions validate systemic consistency across disparate evidence classes.',
        'Dimensional synthesis preserves structural, lineage, and boundary records in a unified interpretive context.',
      ]),
      contextual_relationships: Object.freeze([
        Object.freeze({
          related_evidence: 'EVD-TRANS-03-RECONCILIATION',
          relationship_type: 'RECONCILIATION_TRANSITION',
        }),
        Object.freeze({
          related_evidence: 'EVD-CONSTRAINT-04-RECONCILIATION',
          relationship_type: 'RECONCILIATION_CONSTRAINT',
        }),
        Object.freeze({
          related_evidence: 'EVD-TRUST-05-INTERPRETATION',
          relationship_type: 'EFFECTIVE_INTERPRETATION',
        }),
      ]),
      synthesis_notes:
        'Cross-domain reconciliation model synthesizes structural configuration, historical succession, and perimeter containment dimensions.',
    }),
  }),

  convergence: Object.freeze({
    artifactId: 'EVD-INFER-05-CONVERGENCE',
    evidenceId: 'EVD-INFER-05-CONVERGENCE',
    source: 'inference' as const,
    version: '1.0.0',
    classification: 'CONVERGENCE_INFERENCE_MODEL' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    modelReference: 'MODEL-CONVERGENCE-UNIFIED-INFERENCE-SPACE',
    interpretiveScope: 'MULTI_MODEL_CONVERGENCE',
    consistencyDomain: 'UNIFIED_INFERENCE_SPACE',
    correlatedEvidence: Object.freeze([
      'EVD-INFER-01-SPECIFICATION',
      'EVD-INFER-02-LINEAGE',
      'EVD-INFER-03-BOUNDARY',
      'EVD-INFER-04-RECONCILIATION',
    ]),
    synthesisNotes:
      'Multi-model convergence context establishes that structural, lineage, boundary, and reconciliation models must be evaluated concurrently within the unified inference space.',
    content: Object.freeze({
      model_id: 'MODEL-CONVERGENCE-UNIFIED-INFERENCE-SPACE',
      governed_dimension: 'MULTI_MODEL_CONVERGENCE',
      model_reference: 'MODEL-CONVERGENCE-UNIFIED-INFERENCE-SPACE',
      interpretive_scope: 'MULTI_MODEL_CONVERGENCE',
      consistency_domain: 'UNIFIED_INFERENCE_SPACE',
      correlated_models: Object.freeze([
        'EVD-INFER-01-SPECIFICATION',
        'EVD-INFER-02-LINEAGE',
        'EVD-INFER-03-BOUNDARY',
        'EVD-INFER-04-RECONCILIATION',
      ]),
      evaluated_hypotheses: Object.freeze([
        Object.freeze({
          hypothesis_id: 'HYP-CONV-01',
          premise: 'Candidate models represent distinct dimensional projections of the enclave fabric.',
          interpretive_implication:
            'Full inference coherence requires joint evaluation of all candidate models without isolating a single dimension.',
        }),
        Object.freeze({
          hypothesis_id: 'HYP-CONV-02',
          premise: 'Apparent divergences between structural and lineage models reflect differing temporal and functional scopes.',
          interpretive_implication:
            'Resolution emerges from multi-dimensional correlation rather than selecting an individual candidate model in isolation.',
        }),
      ]),
      declarative_assertions: Object.freeze([
        'Multi-model convergence establishes that candidate models provide complementary projections of the enclave state.',
        'Unified inference space correlates structural configuration, historical succession, environmental boundaries, and dimensional reconciliation.',
        'Candidate models remain mutually non-exclusive within their respective dimensional scopes.',
      ]),
      contextual_relationships: Object.freeze([
        Object.freeze({
          related_evidence: 'EVD-INFER-01-SPECIFICATION',
          relationship_type: 'STRUCTURAL_MODEL_CORRELATION',
        }),
        Object.freeze({
          related_evidence: 'EVD-INFER-02-LINEAGE',
          relationship_type: 'LINEAGE_MODEL_CORRELATION',
        }),
        Object.freeze({
          related_evidence: 'EVD-INFER-03-BOUNDARY',
          relationship_type: 'BOUNDARY_MODEL_CORRELATION',
        }),
        Object.freeze({
          related_evidence: 'EVD-INFER-04-RECONCILIATION',
          relationship_type: 'RECONCILIATION_MODEL_CORRELATION',
        }),
      ]),
      synthesis_notes:
        'Multi-model convergence context establishes that structural, lineage, boundary, and reconciliation models must be evaluated concurrently within the unified inference space.',
    }),
  }),
});
