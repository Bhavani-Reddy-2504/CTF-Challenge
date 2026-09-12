import { deepFreeze } from '../../evidence/evidence-types.js';
import type {
  EnvironmentalEvaluationContent,
  EvaluationArtifact,
  HistoricalEvaluationContent,
  RelationalEvaluationContent,
  StructuralEvaluationContent,
  SubmissionEvaluationContent,
} from './evaluation-types.js';

export type EvaluationArtifactMap = {
  readonly 'structural-readiness': EvaluationArtifact<StructuralEvaluationContent>;
  readonly 'historical-readiness': EvaluationArtifact<HistoricalEvaluationContent>;
  readonly 'environmental-readiness': EvaluationArtifact<EnvironmentalEvaluationContent>;
  readonly 'relational-readiness': EvaluationArtifact<RelationalEvaluationContent>;
  readonly 'submission-context': EvaluationArtifact<SubmissionEvaluationContent>;
};

export const EVALUATION_ARTIFACTS: EvaluationArtifactMap = deepFreeze({
  'structural-readiness': {
    evidenceId: 'EVD-EVAL-01-STRUCTURAL',
    artifactId: 'EVD-EVAL-01-STRUCTURAL',
    source: 'evaluation',
    classification: 'STRUCTURAL_EVALUATION_READINESS',
    relevance: 'PRIMARY_PATH' as const,
    version: '1.0.0',
    status: 'ACTIVE',
    authority_conferred: false,
    evaluationReference: 'EVAL-STRUCTURAL-READINESS-4011',
    evaluationDimension: 'STRUCTURAL_CONFIGURATION',
    evaluationScope: 'STRUCTURAL_EVALUATION_READINESS',
    correlationReferences: Object.freeze([
      'EVD-RES-01-STRUCTURAL',
      'EVD-SYNTH-01-SPECIFICATION',
      'EVD-GRAPH-03-TOPOLOGY',
      'EVD-INFER-01-SPECIFICATION',
    ]),
    correlatedEvidence: Object.freeze([
      'EVD-RES-01-STRUCTURAL',
      'EVD-SYNTH-01-SPECIFICATION',
      'EVD-GRAPH-03-TOPOLOGY',
      'EVD-INFER-01-SPECIFICATION',
    ]),
    evaluationNotes:
      'Confirms readiness of structural analytical context for controlled evaluation without revealing correctness conditions.',
    content: Object.freeze({
      evaluation_context_id: 'CTX-EVAL-01-STRUCTURAL',
      evaluation_dimension: 'STRUCTURAL_CONFIGURATION',
      evaluation_reference: 'EVAL-STRUCTURAL-READINESS-4011',
      evaluation_scope: 'STRUCTURAL_EVALUATION_READINESS',
      correlated_dimensions: Object.freeze([
        'STRUCTURAL_RESOLUTION_CONTEXT',
        'SPECIFICATION_SYNTHESIS',
        'GRAPH_TOPOLOGY_FRAGMENT',
        'SPECIFICATION_INFERENCE_MODEL',
      ]),
      readiness_aspects: Object.freeze([
        'Structural evaluation readiness context established across configuration specifications and hardware bindings.',
        'Analytical context confirmed as prepared for participation in multi-domain evaluation.',
        'Maintains strict isolation from final evaluation criteria.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'SPECIFICATION_ALIGNMENT',
          reference_id: 'EVD-RES-01-STRUCTURAL',
          observation_summary:
            'Hardware configuration and specification context prepared for evaluation.',
        }),
        Object.freeze({
          dimension: 'TOPOLOGICAL_SYNTHESIS',
          reference_id: 'EVD-SYNTH-01-SPECIFICATION',
          observation_summary:
            'Structural synthesis context integrated with topological boundaries.',
        }),
      ]),
      evaluation_notes:
        'Confirms readiness of structural analytical context for controlled evaluation without revealing correctness conditions.',
    }),
  },

  'historical-readiness': {
    evidenceId: 'EVD-EVAL-02-HISTORICAL',
    artifactId: 'EVD-EVAL-02-HISTORICAL',
    source: 'evaluation',
    classification: 'HISTORICAL_EVALUATION_READINESS',
    relevance: 'PRIMARY_PATH' as const,
    version: '1.0.0',
    status: 'ACTIVE',
    authority_conferred: false,
    evaluationReference: 'EVAL-HISTORICAL-READINESS-4022',
    evaluationDimension: 'HISTORICAL_SUCCESSION',
    evaluationScope: 'HISTORICAL_EVALUATION_READINESS',
    correlationReferences: Object.freeze([
      'EVD-RES-02-HISTORICAL',
      'EVD-SYNTH-02-LINEAGE',
      'EVD-GRAPH-02-CORRELATION',
      'EVD-INFER-02-LINEAGE',
    ]),
    correlatedEvidence: Object.freeze([
      'EVD-RES-02-HISTORICAL',
      'EVD-SYNTH-02-LINEAGE',
      'EVD-GRAPH-02-CORRELATION',
      'EVD-INFER-02-LINEAGE',
    ]),
    evaluationNotes:
      'Confirms readiness of historical analytical context for controlled evaluation without revealing correctness conditions.',
    content: Object.freeze({
      evaluation_context_id: 'CTX-EVAL-02-HISTORICAL',
      evaluation_dimension: 'HISTORICAL_SUCCESSION',
      evaluation_reference: 'EVAL-HISTORICAL-READINESS-4022',
      evaluation_scope: 'HISTORICAL_EVALUATION_READINESS',
      correlated_dimensions: Object.freeze([
        'HISTORICAL_RESOLUTION_CONTEXT',
        'LINEAGE_SYNTHESIS',
        'GRAPH_CORRELATION_FRAGMENT',
        'LINEAGE_INFERENCE_MODEL',
      ]),
      readiness_aspects: Object.freeze([
        'Historical evaluation readiness context established across audit records and identity succession.',
        'Historical provenance confirmed as prepared for participation in multi-domain evaluation.',
        'Preserves analytical neutrality without exposing historical requirements.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'LINEAGE_PROVENANCE',
          reference_id: 'EVD-RES-02-HISTORICAL',
          observation_summary:
            'Audit history and identity succession context prepared for evaluation.',
        }),
        Object.freeze({
          dimension: 'CORRELATION_SYNTHESIS',
          reference_id: 'EVD-SYNTH-02-LINEAGE',
          observation_summary:
            'Historical synthesis context integrated with correlation fragments.',
        }),
      ]),
      evaluation_notes:
        'Confirms readiness of historical analytical context for controlled evaluation without revealing correctness conditions.',
    }),
  },

  'environmental-readiness': {
    evidenceId: 'EVD-EVAL-03-ENVIRONMENTAL',
    artifactId: 'EVD-EVAL-03-ENVIRONMENTAL',
    source: 'evaluation',
    classification: 'ENVIRONMENTAL_EVALUATION_READINESS',
    relevance: 'PRIMARY_PATH' as const,
    version: '1.0.0',
    status: 'ACTIVE',
    authority_conferred: false,
    evaluationReference: 'EVAL-ENVIRONMENTAL-READINESS-4033',
    evaluationDimension: 'ENVIRONMENTAL_CONTAINMENT',
    evaluationScope: 'ENVIRONMENTAL_EVALUATION_READINESS',
    correlationReferences: Object.freeze([
      'EVD-RES-03-ENVIRONMENTAL',
      'EVD-SYNTH-03-BOUNDARY',
      'EVD-GRAPH-01-CONTEXT',
      'EVD-INFER-03-BOUNDARY',
    ]),
    correlatedEvidence: Object.freeze([
      'EVD-RES-03-ENVIRONMENTAL',
      'EVD-SYNTH-03-BOUNDARY',
      'EVD-GRAPH-01-CONTEXT',
      'EVD-INFER-03-BOUNDARY',
    ]),
    evaluationNotes:
      'Confirms readiness of environmental analytical context for controlled evaluation without revealing correctness conditions.',
    content: Object.freeze({
      evaluation_context_id: 'CTX-EVAL-03-ENVIRONMENTAL',
      evaluation_dimension: 'ENVIRONMENTAL_CONTAINMENT',
      evaluation_reference: 'EVAL-ENVIRONMENTAL-READINESS-4033',
      evaluation_scope: 'ENVIRONMENTAL_EVALUATION_READINESS',
      correlated_dimensions: Object.freeze([
        'ENVIRONMENTAL_RESOLUTION_CONTEXT',
        'BOUNDARY_SYNTHESIS',
        'GRAPH_CONTEXT_FRAGMENT',
        'BOUNDARY_INFERENCE_MODEL',
      ]),
      readiness_aspects: Object.freeze([
        'Environmental evaluation readiness context established across containment perimeters and metadata definitions.',
        'Isolation parameters confirmed as prepared for participation in multi-domain evaluation.',
        'Maintains operational containment without disclosing environmental interpretations.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'PERIMETER_CONTAINMENT',
          reference_id: 'EVD-RES-03-ENVIRONMENTAL',
          observation_summary:
            'Perimeter isolation and boundary context prepared for evaluation.',
        }),
        Object.freeze({
          dimension: 'CONTEXTUAL_SYNTHESIS',
          reference_id: 'EVD-SYNTH-03-BOUNDARY',
          observation_summary:
            'Environmental synthesis context integrated with contextual fragments.',
        }),
      ]),
      evaluation_notes:
        'Confirms readiness of environmental analytical context for controlled evaluation without revealing correctness conditions.',
    }),
  },

  'relational-readiness': {
    evidenceId: 'EVD-EVAL-04-RELATIONAL',
    artifactId: 'EVD-EVAL-04-RELATIONAL',
    source: 'evaluation',
    classification: 'RELATIONAL_EVALUATION_READINESS',
    relevance: 'PRIMARY_PATH' as const,
    version: '1.0.0',
    status: 'ACTIVE',
    authority_conferred: false,
    evaluationReference: 'EVAL-RELATIONAL-READINESS-4044',
    evaluationDimension: 'CROSS_DOMAIN_RELATIONSHIP',
    evaluationScope: 'RELATIONAL_EVALUATION_READINESS',
    correlationReferences: Object.freeze([
      'EVD-RES-04-RELATIONAL',
      'EVD-SYNTH-04-RELATIONAL',
      'EVD-GRAPH-04-CONVERGENCE',
      'EVD-INFER-04-RECONCILIATION',
      'EVD-TRANS-03-RECONCILIATION',
    ]),
    correlatedEvidence: Object.freeze([
      'EVD-RES-04-RELATIONAL',
      'EVD-SYNTH-04-RELATIONAL',
      'EVD-GRAPH-04-CONVERGENCE',
      'EVD-INFER-04-RECONCILIATION',
      'EVD-TRANS-03-RECONCILIATION',
    ]),
    evaluationNotes:
      'Confirms readiness of relational analytical context for controlled evaluation without revealing correctness conditions.',
    content: Object.freeze({
      evaluation_context_id: 'CTX-EVAL-04-RELATIONAL',
      evaluation_dimension: 'CROSS_DOMAIN_RELATIONSHIP',
      evaluation_reference: 'EVAL-RELATIONAL-READINESS-4044',
      evaluation_scope: 'RELATIONAL_EVALUATION_READINESS',
      correlated_dimensions: Object.freeze([
        'RELATIONAL_RESOLUTION_CONTEXT',
        'RELATIONAL_SYNTHESIS',
        'GRAPH_CONVERGENCE_FRAGMENT',
        'RECONCILIATION_INFERENCE_MODEL',
        'RECONCILIATION_TRANSITION',
      ]),
      readiness_aspects: Object.freeze([
        'Relational evaluation readiness context established across cross-domain alignments and reconciled transitions.',
        'Cross-domain coherence confirmed as prepared for participation in multi-domain evaluation.',
        'Preserves relational neutrality without disclosing relational evaluation constraints.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'CROSS_DOMAIN_ALIGNMENT',
          reference_id: 'EVD-RES-04-RELATIONAL',
          observation_summary:
            'Reconciled state transitions and relational alignment prepared for evaluation.',
        }),
        Object.freeze({
          dimension: 'CONVERGENCE_SYNTHESIS',
          reference_id: 'EVD-SYNTH-04-RELATIONAL',
          observation_summary:
            'Relational synthesis context integrated with convergence fragments.',
        }),
      ]),
      evaluation_notes:
        'Confirms readiness of relational analytical context for controlled evaluation without revealing correctness conditions.',
    }),
  },

  'submission-context': {
    evidenceId: 'EVD-EVAL-05-SUBMISSION-CONTEXT',
    artifactId: 'EVD-EVAL-05-SUBMISSION-CONTEXT',
    source: 'evaluation',
    classification: 'CONTROLLED_SUBMISSION_CONTEXT',
    relevance: 'PRIMARY_PATH' as const,
    version: '1.0.0',
    status: 'ACTIVE',
    authority_conferred: false,
    evaluationReference: 'EVAL-SUBMISSION-CONTEXT-4055',
    evaluationDimension: 'FINAL_MULTI_DOMAIN_EVALUATION',
    evaluationScope: 'CONTROLLED_SUBMISSION_BOUNDARY',
    correlationReferences: Object.freeze([
      'EVD-EVAL-01-STRUCTURAL',
      'EVD-EVAL-02-HISTORICAL',
      'EVD-EVAL-03-ENVIRONMENTAL',
      'EVD-EVAL-04-RELATIONAL',
      'EVD-RES-05-CONTEXT',
      'EVD-SYNTH-05-MULTI-PERSPECTIVE',
      'EVD-GRAPH-05-RECONSTRUCTION',
      'EVD-INFER-05-CONVERGENCE',
    ]),
    correlatedEvidence: Object.freeze([
      'EVD-EVAL-01-STRUCTURAL',
      'EVD-EVAL-02-HISTORICAL',
      'EVD-EVAL-03-ENVIRONMENTAL',
      'EVD-EVAL-04-RELATIONAL',
      'EVD-RES-05-CONTEXT',
      'EVD-SYNTH-05-MULTI-PERSPECTIVE',
      'EVD-GRAPH-05-RECONSTRUCTION',
      'EVD-INFER-05-CONVERGENCE',
    ]),
    evaluationNotes:
      'Establishes controlled final submission boundary without exposing evaluation criteria, expected values, or flags.',
    content: Object.freeze({
      evaluation_context_id: 'CTX-EVAL-05-SUBMISSION',
      evaluation_dimension: 'FINAL_MULTI_DOMAIN_EVALUATION',
      evaluation_reference: 'EVAL-SUBMISSION-CONTEXT-4055',
      evaluation_scope: 'CONTROLLED_SUBMISSION_BOUNDARY',
      correlated_dimensions: Object.freeze([
        'STRUCTURAL_EVALUATION_READINESS',
        'HISTORICAL_EVALUATION_READINESS',
        'ENVIRONMENTAL_EVALUATION_READINESS',
        'RELATIONAL_EVALUATION_READINESS',
        'MULTI_DOMAIN_RESOLUTION_CONTEXT',
        'MULTI_PERSPECTIVE_SYNTHESIS',
        'GRAPH_RECONSTRUCTION_FRAGMENT',
        'CONVERGENCE_INFERENCE_MODEL',
      ]),
      readiness_aspects: Object.freeze([
        'Controlled submission context established across all four evaluation readiness branches and multi-perspective synthesis.',
        'Confirms that final submission boundary is operational and ready to accept candidate interpretations.',
        'Establishes submission eligibility without implying correctness, expected content, or solution criteria.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'READINESS_CONVERGENCE',
          reference_id: 'EVD-EVAL-01-STRUCTURAL',
          observation_summary:
            'Structural, historical, environmental, and relational readiness converged into submission boundary.',
        }),
        Object.freeze({
          dimension: 'RESOLUTION_CONVERGENCE',
          reference_id: 'EVD-RES-05-CONTEXT',
          observation_summary:
            'Multi-domain resolution context converged with submission boundary.',
        }),
      ]),
      evaluation_notes:
        'Establishes controlled final submission boundary without exposing evaluation criteria, expected values, or flags.',
    }),
  },
});
