import type { GraphArtifact } from '../../evidence/evidence-types.js';
import type {
  ContextFragmentContent,
  ConvergenceFragmentContent,
  CorrelationFragmentContent,
  ReconstructionFragmentContent,
  TopologyFragmentContent,
} from './graph-types.js';

export interface GraphArtifactMap {
  readonly 'context-fragment': GraphArtifact<ContextFragmentContent>;
  readonly 'correlation-fragment': GraphArtifact<CorrelationFragmentContent>;
  readonly 'topology-fragment': GraphArtifact<TopologyFragmentContent>;
  readonly 'convergence-fragment': GraphArtifact<ConvergenceFragmentContent>;
  readonly 'reconstruction-fragment': GraphArtifact<ReconstructionFragmentContent>;
}

/**
 * Canonical Graph Correlation Artifacts for StrataCore: The Hyperion Enclave Fabric.
 *
 * Exposes exactly five deterministic, read-only correlation fragments.
 * Adheres strictly to Prompt 11 requirements:
 * - Zero Boolean oracles in player-visible content
 * - Zero graph structure fields (no node_count, edge_count, degree, adjacency, paths)
 * - Zero ranking, scoring, weight, priority, or confidence fields
 * - Zero winner or answer indicators
 * - Non-linear correlation fragments requiring multi-module synthesis
 */
export const GRAPH_ARTIFACTS: Readonly<GraphArtifactMap> = Object.freeze({
  'context-fragment': Object.freeze({
    artifactId: 'EVD-GRAPH-01-CONTEXT',
    evidenceId: 'EVD-GRAPH-01-CONTEXT',
    source: 'graph' as const,
    version: '1.0.0',
    classification: 'GRAPH_CONTEXT_FRAGMENT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    fragmentReference: 'FRAG-GRAPH-01-CTX',
    correlationDimension: 'CONTEXTUAL_DELIMITATION',
    contextualScope: 'ENVIRONMENTAL_CONTAINMENT',
    correlatedEvidence: Object.freeze([
      'EVD-META-02-CONTEXT',
      'EVD-CFG-02-BINDING',
      'EVD-CONSTRAINT-03-BOUNDARY',
    ]),
    synthesisNotes:
      'Contextual fragment synthesizes environment topology, hardware key-binding profiles, and perimeter isolation demarcations across co-located enclave workloads.',
    content: Object.freeze({
      fragment_id: 'FRAG-GRAPH-01-CTX',
      correlation_dimension: 'CONTEXTUAL_DELIMITATION',
      fragment_reference: 'FRAG-GRAPH-01-CTX',
      contextual_scope: 'ENVIRONMENTAL_CONTAINMENT',
      associated_records: Object.freeze([
        'EVD-META-02-CONTEXT',
        'EVD-CFG-02-BINDING',
        'EVD-CONSTRAINT-03-BOUNDARY',
      ]),
      relational_assertions: Object.freeze([
        'Co-located workloads within trust-zone-alpha share hardware isolation partition ENCLAVE_PARTITION_0.',
        'Cryptographic binding profiles associate hardware affinity to contextual boundary definitions.',
        'Perimeter containment demarcates environmental adjacency across distinct functional workloads.',
      ]),
      contextual_associations: Object.freeze([
        Object.freeze({
          target_evidence: 'EVD-META-02-CONTEXT',
          association_type: 'ENVIRONMENT_TOPOLOGY',
        }),
        Object.freeze({
          target_evidence: 'EVD-CFG-02-BINDING',
          association_type: 'HARDWARE_AFFINITY_PROFILE',
        }),
        Object.freeze({
          target_evidence: 'EVD-CONSTRAINT-03-BOUNDARY',
          association_type: 'ZONE_PERIMETER_DELIMITATION',
        }),
      ]),
      synthesis_notes:
        'Contextual fragment synthesizes environment topology, hardware key-binding profiles, and perimeter isolation demarcations across co-located enclave workloads.',
    }),
  }),

  'correlation-fragment': Object.freeze({
    artifactId: 'EVD-GRAPH-02-CORRELATION',
    evidenceId: 'EVD-GRAPH-02-CORRELATION',
    source: 'graph' as const,
    version: '1.0.0',
    classification: 'GRAPH_CORRELATION_FRAGMENT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    fragmentReference: 'FRAG-GRAPH-02-CORR',
    correlationDimension: 'LINEAGE_CONTINUITY',
    contextualScope: 'HISTORICAL_SUCCESSION',
    correlatedEvidence: Object.freeze([
      'EVD-AUD-03-FAILS',
      'EVD-IDN-04-LINEAGE',
      'EVD-TRUST-03-LINEAGE',
      'EVD-CONSTRAINT-02-CONTINUITY',
    ]),
    synthesisNotes:
      'Correlation fragment tracks component evolution across audit failure traces and succession lineage anchors under correlation reference REF-CORR-99201-B.',
    content: Object.freeze({
      fragment_id: 'FRAG-GRAPH-02-CORR',
      correlation_dimension: 'LINEAGE_CONTINUITY',
      fragment_reference: 'FRAG-GRAPH-02-CORR',
      contextual_scope: 'HISTORICAL_SUCCESSION',
      associated_records: Object.freeze([
        'EVD-AUD-03-FAILS',
        'EVD-IDN-04-LINEAGE',
        'EVD-TRUST-03-LINEAGE',
        'EVD-CONSTRAINT-02-CONTINUITY',
      ]),
      relational_assertions: Object.freeze([
        'Succession records document causal evolutionary steps across component releases.',
        'Recorded failure transitions in audit history reflect compatibility validation iterations.',
        'Correlation reference REF-CORR-99201-B anchors unbroken lineage trace continuity.',
      ]),
      contextual_associations: Object.freeze([
        Object.freeze({
          target_evidence: 'EVD-AUD-03-FAILS',
          association_type: 'CAUSAL_AUDIT_TRACE',
        }),
        Object.freeze({
          target_evidence: 'EVD-IDN-04-LINEAGE',
          association_type: 'COMPONENT_SUCCESSION',
        }),
        Object.freeze({
          target_evidence: 'EVD-TRUST-03-LINEAGE',
          association_type: 'LINEAGE_COHERENCE',
        }),
        Object.freeze({
          target_evidence: 'EVD-CONSTRAINT-02-CONTINUITY',
          association_type: 'HISTORICAL_CONTINUITY',
        }),
      ]),
      synthesis_notes:
        'Correlation fragment tracks component evolution across audit failure traces and succession lineage anchors under correlation reference REF-CORR-99201-B.',
    }),
  }),

  'topology-fragment': Object.freeze({
    artifactId: 'EVD-GRAPH-03-TOPOLOGY',
    evidenceId: 'EVD-GRAPH-03-TOPOLOGY',
    source: 'graph' as const,
    version: '1.0.0',
    classification: 'GRAPH_TOPOLOGY_FRAGMENT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    fragmentReference: 'FRAG-GRAPH-03-TOPO',
    correlationDimension: 'STRUCTURAL_TOPOLOGY',
    contextualScope: 'SPECIFICATION_ALIGNMENT',
    correlatedEvidence: Object.freeze([
      'EVD-CFG-01-ACTIVE-SPEC',
      'EVD-INFER-01-SPECIFICATION',
      'EVD-GRAPH-01-CONTEXT',
    ]),
    synthesisNotes:
      'Topology fragment models structural configuration alignment and hardware affinity bindings within enclave execution partition boundaries.',
    content: Object.freeze({
      fragment_id: 'FRAG-GRAPH-03-TOPO',
      correlation_dimension: 'STRUCTURAL_TOPOLOGY',
      fragment_reference: 'FRAG-GRAPH-03-TOPO',
      contextual_scope: 'SPECIFICATION_ALIGNMENT',
      associated_records: Object.freeze([
        'EVD-CFG-01-ACTIVE-SPEC',
        'EVD-INFER-01-SPECIFICATION',
        'EVD-GRAPH-01-CONTEXT',
      ]),
      relational_assertions: Object.freeze([
        'Maintained execution profile defines declarative configuration parameters across partitions.',
        'Specification models correlate configuration integrity with hardware cryptographic affinity.',
        'Contextual containment fragments establish structural boundary scope across trust zones.',
      ]),
      contextual_associations: Object.freeze([
        Object.freeze({
          target_evidence: 'EVD-CFG-01-ACTIVE-SPEC',
          association_type: 'ACTIVE_SPECIFICATION_BASELINE',
        }),
        Object.freeze({
          target_evidence: 'EVD-INFER-01-SPECIFICATION',
          association_type: 'STRUCTURAL_INFERENCE_CORRELATION',
        }),
        Object.freeze({
          target_evidence: 'EVD-GRAPH-01-CONTEXT',
          association_type: 'CONTEXTUAL_DELIMITATION_LINK',
        }),
      ]),
      synthesis_notes:
        'Topology fragment models structural configuration alignment and hardware affinity bindings within enclave execution partition boundaries.',
    }),
  }),

  'convergence-fragment': Object.freeze({
    artifactId: 'EVD-GRAPH-04-CONVERGENCE',
    evidenceId: 'EVD-GRAPH-04-CONVERGENCE',
    source: 'graph' as const,
    version: '1.0.0',
    classification: 'GRAPH_CONVERGENCE_FRAGMENT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    fragmentReference: 'FRAG-GRAPH-04-CONV',
    correlationDimension: 'DIMENSIONAL_SYNTHESIS',
    contextualScope: 'RECONCILIATION_SYNTHESIS',
    correlatedEvidence: Object.freeze([
      'EVD-TRANS-03-RECONCILIATION',
      'EVD-INFER-04-RECONCILIATION',
      'EVD-GRAPH-02-CORRELATION',
    ]),
    synthesisNotes:
      'Convergence fragment correlates cross-domain reconciliation transitions with historical lineage continuity records into an orthogonal dimensional model.',
    content: Object.freeze({
      fragment_id: 'FRAG-GRAPH-04-CONV',
      correlation_dimension: 'DIMENSIONAL_SYNTHESIS',
      fragment_reference: 'FRAG-GRAPH-04-CONV',
      contextual_scope: 'RECONCILIATION_SYNTHESIS',
      associated_records: Object.freeze([
        'EVD-TRANS-03-RECONCILIATION',
        'EVD-INFER-04-RECONCILIATION',
        'EVD-GRAPH-02-CORRELATION',
      ]),
      relational_assertions: Object.freeze([
        'Reconciliation state transitions validate systemic consistency across disparate evidence classes.',
        'Cross-domain models synthesize orthogonal dimensions into unified operational contexts.',
        'Correlation fragments link historical succession trace with reconciled state baselines.',
      ]),
      contextual_associations: Object.freeze([
        Object.freeze({
          target_evidence: 'EVD-TRANS-03-RECONCILIATION',
          association_type: 'STATE_TRANSITION_RECONCILIATION',
        }),
        Object.freeze({
          target_evidence: 'EVD-INFER-04-RECONCILIATION',
          association_type: 'RECONCILIATION_MODEL_LINK',
        }),
        Object.freeze({
          target_evidence: 'EVD-GRAPH-02-CORRELATION',
          association_type: 'LINEAGE_CONTINUITY_LINK',
        }),
      ]),
      synthesis_notes:
        'Convergence fragment correlates cross-domain reconciliation transitions with historical lineage continuity records into an orthogonal dimensional model.',
    }),
  }),

  'reconstruction-fragment': Object.freeze({
    artifactId: 'EVD-GRAPH-05-RECONSTRUCTION',
    evidenceId: 'EVD-GRAPH-05-RECONSTRUCTION',
    source: 'graph' as const,
    version: '1.0.0',
    classification: 'GRAPH_RECONSTRUCTION_FRAGMENT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    correlationReferences: Object.freeze(['REF-CORR-99201-B']),
    fragmentReference: 'FRAG-GRAPH-05-RECON',
    correlationDimension: 'RELATIONAL_RECONSTRUCTION',
    contextualScope: 'CROSS_DOMAIN_UNIFICATION',
    correlatedEvidence: Object.freeze([
      'EVD-INFER-05-CONVERGENCE',
      'EVD-GRAPH-03-TOPOLOGY',
      'EVD-GRAPH-04-CONVERGENCE',
    ]),
    synthesisNotes:
      'Reconstruction fragment synthesizes structural, lineage, boundary, and dimensional convergence models into a coherent non-linear correlation context.',
    content: Object.freeze({
      fragment_id: 'FRAG-GRAPH-05-RECON',
      correlation_dimension: 'RELATIONAL_RECONSTRUCTION',
      fragment_reference: 'FRAG-GRAPH-05-RECON',
      contextual_scope: 'CROSS_DOMAIN_UNIFICATION',
      associated_records: Object.freeze([
        'EVD-INFER-05-CONVERGENCE',
        'EVD-GRAPH-03-TOPOLOGY',
        'EVD-GRAPH-04-CONVERGENCE',
      ]),
      relational_assertions: Object.freeze([
        'Unified correlation space synthesizes topology and dimensional convergence fragments.',
        'Multi-model convergence records provide non-linear relational context across all domains.',
        'Reconstruction context integrates disparate fragments into an interconnected evidence space.',
      ]),
      contextual_associations: Object.freeze([
        Object.freeze({
          target_evidence: 'EVD-INFER-05-CONVERGENCE',
          association_type: 'MULTI_MODEL_CONVERGENCE_LINK',
        }),
        Object.freeze({
          target_evidence: 'EVD-GRAPH-03-TOPOLOGY',
          association_type: 'STRUCTURAL_TOPOLOGY_LINK',
        }),
        Object.freeze({
          target_evidence: 'EVD-GRAPH-04-CONVERGENCE',
          association_type: 'DIMENSIONAL_CONVERGENCE_LINK',
        }),
      ]),
      synthesis_notes:
        'Reconstruction fragment synthesizes structural, lineage, boundary, and dimensional convergence models into a coherent non-linear correlation context.',
    }),
  }),
});
