import type { ResolutionArtifact } from '../../evidence/evidence-types.js';
import type {
  EnvironmentalResolutionContent,
  HistoricalResolutionContent,
  MultiDomainResolutionContent,
  RelationalResolutionContent,
  StructuralResolutionContent,
} from './resolution-types.js';

export interface ResolutionArtifactMap {
  readonly 'structural-context': ResolutionArtifact<StructuralResolutionContent>;
  readonly 'historical-context': ResolutionArtifact<HistoricalResolutionContent>;
  readonly 'environmental-context': ResolutionArtifact<EnvironmentalResolutionContent>;
  readonly 'relational-context': ResolutionArtifact<RelationalResolutionContent>;
  readonly 'resolution-context': ResolutionArtifact<MultiDomainResolutionContent>;
}

/**
 * Canonical Resolution Artifacts for StrataCore: The Hyperion Enclave Fabric.
 *
 * Exposes exactly five deterministic, read-only resolution preparation contexts.
 * Adheres strictly to Prompt 13 requirements:
 * - Zero Boolean oracles in player-visible content
 * - Zero graph structure or dependency topology fields
 * - Zero ranking, scoring, weight, priority, or confidence fields
 * - Zero winner, answer, or solution indicators
 * - Multi-domain resolution preparation without deciding the final challenge outcome
 */
export const RESOLUTION_ARTIFACTS: Readonly<ResolutionArtifactMap> = Object.freeze({
  'structural-context': Object.freeze({
    artifactId: 'EVD-RES-01-STRUCTURAL',
    evidenceId: 'EVD-RES-01-STRUCTURAL',
    source: 'resolution' as const,
    version: '1.0.0',
    classification: 'STRUCTURAL_RESOLUTION_CONTEXT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    authority_conferred: false as const,
    correlationReferences: Object.freeze(['REF-RES-STRUCT-1011']),
    resolutionReference: 'RES-STRUCT-ALIGNMENT-1011',
    resolutionDimension: 'STRUCTURAL_CONFIGURATION',
    resolutionScope: 'ENCLAVE_STRUCTURAL_CONFIGURATION_CONTEXT',
    correlatedEvidence: Object.freeze([
      'EVD-CFG-01-ACTIVE-SPEC',
      'EVD-TRUST-02-BINDING',
      'EVD-CONSTRAINT-01-SPECIFICATION',
      'EVD-INFER-01-SPECIFICATION',
      'EVD-GRAPH-03-TOPOLOGY',
      'EVD-SYNTH-01-SPECIFICATION',
    ]),
    resolutionNotes:
      'Establishes controlled structural resolution context relating maintained execution configuration, structural parameters, and hardware affinity.',
    content: Object.freeze({
      resolution_context_id: 'CTX-RES-01-STRUCT',
      resolution_dimension: 'STRUCTURAL_CONFIGURATION',
      resolution_reference: 'RES-STRUCT-ALIGNMENT-1011',
      resolution_scope: 'ENCLAVE_STRUCTURAL_CONFIGURATION_CONTEXT',
      correlated_dimensions: Object.freeze([
        'ACTIVE_SPECIFICATION',
        'BINDING_PROFILE',
        'SPECIFICATION_CONSTRAINT',
        'SPECIFICATION_INFERENCE',
        'GRAPH_TOPOLOGY',
        'STRUCTURAL_PERSPECTIVE',
      ]),
      resolution_aspects: Object.freeze([
        'Execution configuration parameters correlate with hardware affinity profile 99201-B.',
        'Structural parameters align enclave specification constraints across registered execution domains.',
        'Topological paths interconnect workload identity contexts with hardware sealing parameters.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'CONFIGURATION_DESCRIPTOR',
          reference_id: 'EVD-CFG-01-ACTIVE-SPEC',
          observation_summary: 'Hardware profile parameters define enclave register boundaries.',
        }),
        Object.freeze({
          dimension: 'TRUST_BINDING',
          reference_id: 'EVD-TRUST-02-BINDING',
          observation_summary: 'Binding attestations associate cryptographic identity anchors with hardware primitives.',
        }),
        Object.freeze({
          dimension: 'SYNTHESIZED_STRUCTURE',
          reference_id: 'EVD-SYNTH-01-SPECIFICATION',
          observation_summary: 'Analytical perspective confirms coherent structural alignment across isolation parameters.',
        }),
      ]),
      resolution_notes:
        'Establishes controlled structural resolution context relating maintained execution configuration, structural parameters, and hardware affinity.',
    }),
  }),

  'historical-context': Object.freeze({
    artifactId: 'EVD-RES-02-HISTORICAL',
    evidenceId: 'EVD-RES-02-HISTORICAL',
    source: 'resolution' as const,
    version: '1.0.0',
    classification: 'HISTORICAL_RESOLUTION_CONTEXT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    authority_conferred: false as const,
    correlationReferences: Object.freeze(['REF-RES-HIST-2022']),
    resolutionReference: 'RES-HIST-SUCCESSION-2022',
    resolutionDimension: 'HISTORICAL_SUCCESSION',
    resolutionScope: 'SUCCESSION_AND_PROVENANCE_RESOLUTION_CONTEXT',
    correlatedEvidence: Object.freeze([
      'EVD-AUD-03-FAILS',
      'EVD-IDN-04-LINEAGE',
      'EVD-TRUST-03-LINEAGE',
      'EVD-CONSTRAINT-02-CONTINUITY',
      'EVD-INFER-02-LINEAGE',
      'EVD-GRAPH-02-CORRELATION',
      'EVD-SYNTH-02-LINEAGE',
    ]),
    resolutionNotes:
      'Establishes controlled historical resolution context relating lineage, succession, compatibility provenance, and audit continuity.',
    content: Object.freeze({
      resolution_context_id: 'CTX-RES-02-HIST',
      resolution_dimension: 'HISTORICAL_SUCCESSION',
      resolution_reference: 'RES-HIST-SUCCESSION-2022',
      resolution_scope: 'SUCCESSION_AND_PROVENANCE_RESOLUTION_CONTEXT',
      correlated_dimensions: Object.freeze([
        'AUDIT_RECORD',
        'IDENTITY_LINEAGE',
        'TRUST_LINEAGE',
        'CONTINUITY_CONSTRAINT',
        'LINEAGE_INFERENCE',
        'GRAPH_CORRELATION',
        'HISTORICAL_PERSPECTIVE',
      ]),
      resolution_aspects: Object.freeze([
        'Workload identity lineage traces succession across recorded migration events.',
        'Audit continuity correlates historical dispatch rejections with evolving schema identifiers.',
        'Compatibility provenance establishes unbroken lineage chains without displacing prior audit milestones.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'AUDIT_CONTINUITY',
          reference_id: 'EVD-AUD-03-FAILS',
          observation_summary: 'Historical rejection events document protocol version migration boundaries.',
        }),
        Object.freeze({
          dimension: 'LINEAGE_CHAIN',
          reference_id: 'EVD-IDN-04-LINEAGE',
          observation_summary: 'Parent-child succession records verify identity provenance continuity.',
        }),
        Object.freeze({
          dimension: 'HISTORICAL_PERSPECTIVE',
          reference_id: 'EVD-SYNTH-02-LINEAGE',
          observation_summary: 'Synthesized lineage perspective reflects persistent audit trail continuity.',
        }),
      ]),
      resolution_notes:
        'Establishes controlled historical resolution context relating lineage, succession, compatibility provenance, and audit continuity.',
    }),
  }),

  'environmental-context': Object.freeze({
    artifactId: 'EVD-RES-03-ENVIRONMENTAL',
    evidenceId: 'EVD-RES-03-ENVIRONMENTAL',
    source: 'resolution' as const,
    version: '1.0.0',
    classification: 'ENVIRONMENTAL_RESOLUTION_CONTEXT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    authority_conferred: false as const,
    correlationReferences: Object.freeze(['REF-RES-ENV-3033']),
    resolutionReference: 'RES-ENV-CONTAINMENT-3033',
    resolutionDimension: 'ENVIRONMENTAL_CONTAINMENT',
    resolutionScope: 'PERIMETER_CONTAINMENT_RESOLUTION_CONTEXT',
    correlatedEvidence: Object.freeze([
      'EVD-META-02-CONTEXT',
      'EVD-CFG-02-BINDING',
      'EVD-IDN-03-TRUST-MEMBERSHIP',
      'EVD-CONSTRAINT-03-BOUNDARY',
      'EVD-INFER-03-BOUNDARY',
      'EVD-GRAPH-01-CONTEXT',
      'EVD-SYNTH-03-BOUNDARY',
    ]),
    resolutionNotes:
      'Establishes controlled environmental resolution context relating containment, trust-zone relationships, and perimeter boundaries.',
    content: Object.freeze({
      resolution_context_id: 'CTX-RES-03-ENV',
      resolution_dimension: 'ENVIRONMENTAL_CONTAINMENT',
      resolution_reference: 'RES-ENV-CONTAINMENT-3033',
      resolution_scope: 'PERIMETER_CONTAINMENT_RESOLUTION_CONTEXT',
      correlated_dimensions: Object.freeze([
        'METADATA_CONTEXT',
        'BINDING_CONFIG',
        'TRUST_MEMBERSHIP',
        'BOUNDARY_CONSTRAINT',
        'BOUNDARY_INFERENCE',
        'GRAPH_CONTEXT',
        'ENVIRONMENTAL_PERSPECTIVE',
      ]),
      resolution_aspects: Object.freeze([
        'Enclave isolation boundaries delineate memory partitions across co-located execution zones.',
        'Trust domain membership defines perimeter containment rules for concurrent workloads.',
        'Environmental perimeter constraints govern interaction channels across multi-principal enclaves.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'TOPOLOGY_METADATA',
          reference_id: 'EVD-META-02-CONTEXT',
          observation_summary: 'Hardware partition topology describes co-located execution environments.',
        }),
        Object.freeze({
          dimension: 'DOMAIN_MEMBERSHIP',
          reference_id: 'EVD-IDN-03-TRUST-MEMBERSHIP',
          observation_summary: 'Trust domain attestation binds execution boundaries to isolation zones.',
        }),
        Object.freeze({
          dimension: 'ENVIRONMENTAL_PERSPECTIVE',
          reference_id: 'EVD-SYNTH-03-BOUNDARY',
          observation_summary: 'Synthesized boundary perspective documents perimeter confinement criteria.',
        }),
      ]),
      resolution_notes:
        'Establishes controlled environmental resolution context relating containment, trust-zone relationships, and perimeter boundaries.',
    }),
  }),

  'relational-context': Object.freeze({
    artifactId: 'EVD-RES-04-RELATIONAL',
    evidenceId: 'EVD-RES-04-RELATIONAL',
    source: 'resolution' as const,
    version: '1.0.0',
    classification: 'RELATIONAL_RESOLUTION_CONTEXT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    authority_conferred: false as const,
    correlationReferences: Object.freeze(['REF-RES-REL-4044']),
    resolutionReference: 'RES-REL-ALIGNMENT-4044',
    resolutionDimension: 'CROSS_DOMAIN_RELATIONSHIP',
    resolutionScope: 'CROSS_DOMAIN_RELATIONAL_ALIGNMENT',
    correlatedEvidence: Object.freeze([
      'EVD-TRANS-03-RECONCILIATION',
      'EVD-TRUST-05-INTERPRETATION',
      'EVD-CONSTRAINT-04-RECONCILIATION',
      'EVD-INFER-04-RECONCILIATION',
      'EVD-GRAPH-04-CONVERGENCE',
      'EVD-SYNTH-04-RELATIONAL',
    ]),
    resolutionNotes:
      'Correlates structural, historical, and environmental dimensions as coexisting orthogonal facets.',
    content: Object.freeze({
      resolution_context_id: 'CTX-RES-04-REL',
      resolution_dimension: 'CROSS_DOMAIN_RELATIONSHIP',
      resolution_reference: 'RES-REL-ALIGNMENT-4044',
      resolution_scope: 'CROSS_DOMAIN_RELATIONAL_ALIGNMENT',
      correlated_dimensions: Object.freeze([
        'TRANSITION_RECONCILIATION',
        'TRUST_INTERPRETATION',
        'CONSTRAINT_RECONCILIATION',
        'INFERENCE_RECONCILIATION',
        'GRAPH_CONVERGENCE',
        'RELATIONAL_PERSPECTIVE',
      ]),
      resolution_aspects: Object.freeze([
        'Structural, historical, and environmental dimensions coexist as orthogonal analytical facets.',
        'Cross-domain reconciliation models align disparate evidence categories into consistent relational context.',
        'Transition convergence harmonizes operational state invariants across all participating domains.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'RECONCILED_TRANSITION',
          reference_id: 'EVD-TRANS-03-RECONCILIATION',
          observation_summary: 'Reconciliation milestone confirms stable convergence across domain state machines.',
        }),
        Object.freeze({
          dimension: 'TRUST_INTERPRETATION',
          reference_id: 'EVD-TRUST-05-INTERPRETATION',
          observation_summary: 'Interpretation analysis verifies mutual consistency of cross-domain policy assertions.',
        }),
        Object.freeze({
          dimension: 'RELATIONAL_PERSPECTIVE',
          reference_id: 'EVD-SYNTH-04-RELATIONAL',
          observation_summary: 'Synthesized relational perspective provides dimensional alignment across analytical domains.',
        }),
      ]),
      resolution_notes:
        'Correlates structural, historical, and environmental dimensions as coexisting orthogonal facets.',
    }),
  }),

  'resolution-context': Object.freeze({
    artifactId: 'EVD-RES-05-CONTEXT',
    evidenceId: 'EVD-RES-05-CONTEXT',
    source: 'resolution' as const,
    version: '1.0.0',
    classification: 'MULTI_DOMAIN_RESOLUTION_CONTEXT' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    authority_conferred: false as const,
    correlationReferences: Object.freeze(['REF-RES-UNIFIED-5055']),
    resolutionReference: 'RES-UNIFIED-ALIGNMENT-5055',
    resolutionDimension: 'CONTROLLED_MULTI_DOMAIN_ALIGNMENT',
    resolutionScope: 'UNIFIED_MULTI_DOMAIN_RESOLUTION_CONTEXT',
    correlatedEvidence: Object.freeze([
      'EVD-RES-01-STRUCTURAL',
      'EVD-RES-02-HISTORICAL',
      'EVD-RES-03-ENVIRONMENTAL',
      'EVD-RES-04-RELATIONAL',
      'EVD-INFER-05-CONVERGENCE',
      'EVD-GRAPH-05-RECONSTRUCTION',
      'EVD-SYNTH-05-MULTI-PERSPECTIVE',
    ]),
    resolutionNotes:
      'Establishes unified resolution context integrating all four analytical branches and multi-perspective reconstruction.',
    content: Object.freeze({
      resolution_context_id: 'CTX-RES-05-UNIFIED',
      resolution_dimension: 'CONTROLLED_MULTI_DOMAIN_ALIGNMENT',
      resolution_reference: 'RES-UNIFIED-ALIGNMENT-5055',
      resolution_scope: 'UNIFIED_MULTI_DOMAIN_RESOLUTION_CONTEXT',
      correlated_dimensions: Object.freeze([
        'STRUCTURAL_RESOLUTION_CONTEXT',
        'HISTORICAL_RESOLUTION_CONTEXT',
        'ENVIRONMENTAL_RESOLUTION_CONTEXT',
        'RELATIONAL_RESOLUTION_CONTEXT',
        'CONVERGENCE_INFERENCE',
        'GRAPH_RECONSTRUCTION',
        'MULTI_PERSPECTIVE_SYNTHESIS',
      ]),
      resolution_aspects: Object.freeze([
        'Controlled resolution context integrates independently established structural, historical, environmental, and relational domains.',
        'Multi-domain alignment prepares operational reasoning context without dictating a final resolution outcome.',
        'Coexisting resolution dimensions establish baseline consistency across the enclave fabric.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'STRUCTURAL_RESOLUTION',
          reference_id: 'EVD-RES-01-STRUCTURAL',
          observation_summary: 'Hardware configuration and specification context prepared for multi-domain analysis.',
        }),
        Object.freeze({
          dimension: 'HISTORICAL_RESOLUTION',
          reference_id: 'EVD-RES-02-HISTORICAL',
          observation_summary: 'Lineage succession and audit provenance context prepared for multi-domain analysis.',
        }),
        Object.freeze({
          dimension: 'ENVIRONMENTAL_RESOLUTION',
          reference_id: 'EVD-RES-03-ENVIRONMENTAL',
          observation_summary: 'Perimeter containment and isolation context prepared for multi-domain analysis.',
        }),
        Object.freeze({
          dimension: 'RELATIONAL_RESOLUTION',
          reference_id: 'EVD-RES-04-RELATIONAL',
          observation_summary: 'Cross-domain alignment correlates coexisting dimensions into unified context.',
        }),
      ]),
      resolution_notes:
        'Establishes unified resolution context integrating all four analytical branches and multi-perspective reconstruction.',
    }),
  }),
});
