import type { SynthesisArtifact } from '../../evidence/evidence-types.js';
import type {
  BoundarySynthesisContent,
  LineageSynthesisContent,
  MultiPerspectiveSynthesisContent,
  RelationalSynthesisContent,
  SpecificationSynthesisContent,
} from './synthesis-types.js';

export interface SynthesisArtifactMap {
  readonly 'specification-perspective': SynthesisArtifact<SpecificationSynthesisContent>;
  readonly 'lineage-perspective': SynthesisArtifact<LineageSynthesisContent>;
  readonly 'boundary-perspective': SynthesisArtifact<BoundarySynthesisContent>;
  readonly 'relational-perspective': SynthesisArtifact<RelationalSynthesisContent>;
  readonly 'multi-perspective': SynthesisArtifact<MultiPerspectiveSynthesisContent>;
}

/**
 * Canonical Synthesis Artifacts for StrataCore: The Hyperion Enclave Fabric.
 *
 * Exposes exactly five deterministic, read-only analytical perspectives.
 * Adheres strictly to Prompt 12 requirements:
 * - Zero Boolean oracles in player-visible content
 * - Zero graph structure or dependency topology fields
 * - Zero ranking, scoring, weight, priority, or confidence fields
 * - Zero winner, answer, or solution indicators
 * - Multi-perspective synthesis requiring cross-domain reasoning
 */
export const SYNTHESIS_ARTIFACTS: Readonly<SynthesisArtifactMap> = Object.freeze({
  'specification-perspective': Object.freeze({
    artifactId: 'EVD-SYNTH-01-SPECIFICATION',
    evidenceId: 'EVD-SYNTH-01-SPECIFICATION',
    source: 'synthesis' as const,
    version: '1.0.0',
    classification: 'SPECIFICATION_SYNTHESIS' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    authority_conferred: false as const,
    correlationReferences: Object.freeze(['REF-SYNTH-SPEC-7701']),
    perspectiveReference: 'SYNTH-SPEC-ALIGNMENT-7701',
    perspectiveDimension: 'STRUCTURAL_PERSPECTIVE',
    synthesisScope: 'HARDWARE_KEY_ENCLAVE_SPECIFICATION',
    correlatedEvidence: Object.freeze([
      'EVD-CFG-01-ACTIVE-SPEC',
      'EVD-TRUST-02-BINDING',
      'EVD-CONSTRAINT-01-SPECIFICATION',
      'EVD-INFER-01-SPECIFICATION',
      'EVD-GRAPH-03-TOPOLOGY',
    ]),
    synthesisNotes:
      'Synthesizes maintained structural evidence into a coherent perspective on hardware key-binding profiles and enclave boundaries.',
    content: Object.freeze({
      perspective_id: 'PERSPECTIVE-SYNTH-01-SPEC',
      perspective_dimension: 'STRUCTURAL_PERSPECTIVE',
      perspective_reference: 'SYNTH-SPEC-ALIGNMENT-7701',
      synthesis_scope: 'HARDWARE_KEY_ENCLAVE_SPECIFICATION',
      correlated_dimensions: Object.freeze([
        'CONFIGURATION_SPECIFICATION',
        'BINDING_PROFILE',
        'SPECIFICATION_CONSTRAINT',
        'SPECIFICATION_INFERENCE_MODEL',
        'GRAPH_TOPOLOGY_FRAGMENT',
      ]),
      synthesized_aspects: Object.freeze([
        'Active operational specification defines hardware key-derivation profile 99201-B.',
        'Binding attestations confirm enclave cryptographic sealing boundaries.',
        'Structural topology links workload identity references to isolation enforcement boundaries.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'CONFIGURATION',
          reference_id: 'EVD-CFG-01-ACTIVE-SPEC',
          observation_summary: 'Target operational profile adheres to formal descriptor rules.',
        }),
        Object.freeze({
          dimension: 'TRUST_BINDING',
          reference_id: 'EVD-TRUST-02-BINDING',
          observation_summary: 'Binding coherence analysis aligns enclave credentials with hardware sealing.',
        }),
        Object.freeze({
          dimension: 'STRUCTURAL_TOPOLOGY',
          reference_id: 'EVD-GRAPH-03-TOPOLOGY',
          observation_summary: 'Interconnected topological paths establish deterministic enclave boundaries.',
        }),
      ]),
      synthesis_notes:
        'Synthesizes maintained structural evidence into a coherent perspective on hardware key-binding profiles and enclave boundaries.',
    }),
  }),

  'lineage-perspective': Object.freeze({
    artifactId: 'EVD-SYNTH-02-LINEAGE',
    evidenceId: 'EVD-SYNTH-02-LINEAGE',
    source: 'synthesis' as const,
    version: '1.0.0',
    classification: 'LINEAGE_SYNTHESIS' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    authority_conferred: false as const,
    correlationReferences: Object.freeze(['REF-SYNTH-LIN-8812']),
    perspectiveReference: 'SYNTH-LIN-CONTINUITY-8812',
    perspectiveDimension: 'HISTORICAL_PERSPECTIVE',
    synthesisScope: 'SUCCESSION_AND_CONTINUITY_RECORDS',
    correlatedEvidence: Object.freeze([
      'EVD-AUD-03-FAILS',
      'EVD-CFG-04-COMPAT',
      'EVD-IDN-04-LINEAGE',
      'EVD-TRUST-03-LINEAGE',
      'EVD-CONSTRAINT-02-CONTINUITY',
      'EVD-INFER-02-LINEAGE',
      'EVD-GRAPH-02-CORRELATION',
    ]),
    synthesisNotes:
      'Synthesizes historical succession, compatibility rules, and continuity records into an analytical historical perspective.',
    content: Object.freeze({
      perspective_id: 'PERSPECTIVE-SYNTH-02-LIN',
      perspective_dimension: 'HISTORICAL_PERSPECTIVE',
      perspective_reference: 'SYNTH-LIN-CONTINUITY-8812',
      synthesis_scope: 'SUCCESSION_AND_CONTINUITY_RECORDS',
      correlated_dimensions: Object.freeze([
        'AUDIT_TRAIL',
        'COMPATIBILITY_RULE',
        'LINEAGE_RECORD',
        'LINEAGE_COHERENCE_RESOLUTION',
        'CONTINUITY_CONSTRAINT',
        'LINEAGE_INFERENCE_MODEL',
        'GRAPH_CORRELATION_FRAGMENT',
      ]),
      synthesized_aspects: Object.freeze([
        'Historical dispatch failures correlate with cross-generation enclave identity succession.',
        'Compatibility rules preserve continuity across legacy and updated workload identifiers.',
        'Lineage coherence records reconcile credential succession without invalidating historical audit events.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'AUDIT_FAILURES',
          reference_id: 'EVD-AUD-03-FAILS',
          observation_summary: 'Rejected invocation audit records identify legacy schema migration points.',
        }),
        Object.freeze({
          dimension: 'LINEAGE_RECORD',
          reference_id: 'EVD-IDN-04-LINEAGE',
          observation_summary: 'Cryptographic lineage chains demonstrate parent-child succession links.',
        }),
        Object.freeze({
          dimension: 'RELATIONAL_CORRELATION',
          reference_id: 'EVD-GRAPH-02-CORRELATION',
          observation_summary: 'Historical trace correlation demonstrates uninterrupted audit continuity.',
        }),
      ]),
      synthesis_notes:
        'Synthesizes historical succession, compatibility rules, and continuity records into an analytical historical perspective.',
    }),
  }),

  'boundary-perspective': Object.freeze({
    artifactId: 'EVD-SYNTH-03-BOUNDARY',
    evidenceId: 'EVD-SYNTH-03-BOUNDARY',
    source: 'synthesis' as const,
    version: '1.0.0',
    classification: 'BOUNDARY_SYNTHESIS' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    authority_conferred: false as const,
    correlationReferences: Object.freeze(['REF-SYNTH-BND-9943']),
    perspectiveReference: 'SYNTH-BND-CONTAINMENT-9943',
    perspectiveDimension: 'ENVIRONMENTAL_PERSPECTIVE',
    synthesisScope: 'PERIMETER_AND_CONTAINMENT_BOUNDARY',
    correlatedEvidence: Object.freeze([
      'EVD-META-02-CONTEXT',
      'EVD-CFG-02-BINDING',
      'EVD-IDN-03-TRUST-MEMBERSHIP',
      'EVD-CONSTRAINT-03-BOUNDARY',
      'EVD-INFER-03-BOUNDARY',
      'EVD-GRAPH-01-CONTEXT',
    ]),
    synthesisNotes:
      'Synthesizes environmental topology, perimeter isolation, and multi-tenant containment into an analytical environmental perspective.',
    content: Object.freeze({
      perspective_id: 'PERSPECTIVE-SYNTH-03-BND',
      perspective_dimension: 'ENVIRONMENTAL_PERSPECTIVE',
      perspective_reference: 'SYNTH-BND-CONTAINMENT-9943',
      synthesis_scope: 'PERIMETER_AND_CONTAINMENT_BOUNDARY',
      correlated_dimensions: Object.freeze([
        'ENVIRONMENT_TOPOLOGY',
        'BINDING_PROFILE',
        'TRUST_DOMAIN_MEMBERSHIP',
        'BOUNDARY_CONSTRAINT',
        'BOUNDARY_INFERENCE_MODEL',
        'GRAPH_CONTEXT_FRAGMENT',
      ]),
      synthesized_aspects: Object.freeze([
        'Enclave environmental containment limits workload access to approved memory isolation regions.',
        'Perimeter boundary constraints delimit cross-enclave interaction channels.',
        'Trust domain membership certificates govern co-located execution boundaries.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'TOPOLOGY_CONTEXT',
          reference_id: 'EVD-META-02-CONTEXT',
          observation_summary: 'Execution context demarcates isolated hardware compute partitions.',
        }),
        Object.freeze({
          dimension: 'TRUST_MEMBERSHIP',
          reference_id: 'EVD-IDN-03-TRUST-MEMBERSHIP',
          observation_summary: 'Multi-tenant membership attestation verifies perimeter containment.',
        }),
        Object.freeze({
          dimension: 'CONTEXT_FRAGMENT',
          reference_id: 'EVD-GRAPH-01-CONTEXT',
          observation_summary: 'Relational context links binding profiles to boundary constraints.',
        }),
      ]),
      synthesis_notes:
        'Synthesizes environmental topology, perimeter isolation, and multi-tenant containment into an analytical environmental perspective.',
    }),
  }),

  'relational-perspective': Object.freeze({
    artifactId: 'EVD-SYNTH-04-RELATIONAL',
    evidenceId: 'EVD-SYNTH-04-RELATIONAL',
    source: 'synthesis' as const,
    version: '1.0.0',
    classification: 'RELATIONAL_SYNTHESIS' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    authority_conferred: false as const,
    correlationReferences: Object.freeze(['REF-SYNTH-REL-4419']),
    perspectiveReference: 'SYNTH-REL-RECONCILIATION-4419',
    perspectiveDimension: 'CROSS_DOMAIN_PERSPECTIVE',
    synthesisScope: 'CROSS_DOMAIN_RECONCILIATION_ANALYSIS',
    correlatedEvidence: Object.freeze([
      'EVD-TRANS-03-RECONCILIATION',
      'EVD-TRUST-05-INTERPRETATION',
      'EVD-CONSTRAINT-04-RECONCILIATION',
      'EVD-INFER-04-RECONCILIATION',
      'EVD-GRAPH-04-CONVERGENCE',
    ]),
    synthesisNotes:
      'Synthesizes cross-domain relationships across structural, historical, environmental, and reconciliation models into a unified relational perspective.',
    content: Object.freeze({
      perspective_id: 'PERSPECTIVE-SYNTH-04-REL',
      perspective_dimension: 'CROSS_DOMAIN_PERSPECTIVE',
      perspective_reference: 'SYNTH-REL-RECONCILIATION-4419',
      synthesis_scope: 'CROSS_DOMAIN_RECONCILIATION_ANALYSIS',
      correlated_dimensions: Object.freeze([
        'RECONCILIATION_TRANSITION',
        'EFFECTIVE_INTERPRETATION_RESOLUTION',
        'RECONCILIATION_CONSTRAINT',
        'RECONCILIATION_INFERENCE_MODEL',
        'GRAPH_CONVERGENCE_FRAGMENT',
      ]),
      synthesized_aspects: Object.freeze([
        'Cross-domain reconciliation harmonizes structural, historical, and environmental constraints.',
        'Transition state machine reaches stable reconciled state without violating boundary invariants.',
        'Dimensional convergence model integrates disparate domain records into consistent relational context.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'TRANSITION_STATE',
          reference_id: 'EVD-TRANS-03-RECONCILIATION',
          observation_summary: 'Reconciliation transition event records final state convergence.',
        }),
        Object.freeze({
          dimension: 'EFFECTIVE_INTERPRETATION',
          reference_id: 'EVD-TRUST-05-INTERPRETATION',
          observation_summary: 'Effective interpretation analysis resolves cross-domain policy coherence.',
        }),
        Object.freeze({
          dimension: 'CONVERGENCE_FRAGMENT',
          reference_id: 'EVD-GRAPH-04-CONVERGENCE',
          observation_summary: 'Dimensional convergence links historical traces with reconciled transition states.',
        }),
      ]),
      synthesis_notes:
        'Synthesizes cross-domain relationships across structural, historical, environmental, and reconciliation models into a unified relational perspective.',
    }),
  }),

  'multi-perspective': Object.freeze({
    artifactId: 'EVD-SYNTH-05-MULTI-PERSPECTIVE',
    evidenceId: 'EVD-SYNTH-05-MULTI-PERSPECTIVE',
    source: 'synthesis' as const,
    version: '1.0.0',
    classification: 'MULTI_PERSPECTIVE_SYNTHESIS' as const,
    relevance: 'PRIMARY_PATH' as const,
    status: 'ACTIVE' as const,
    authority_conferred: false as const,
    correlationReferences: Object.freeze(['REF-SYNTH-MULTI-0051']),
    perspectiveReference: 'SYNTH-MULTI-UNIFIED-0051',
    perspectiveDimension: 'MULTI_DIMENSIONAL_RECONSTRUCTION',
    synthesisScope: 'HOLISTIC_ENCLAVE_SYNTHESIS',
    correlatedEvidence: Object.freeze([
      'EVD-INFER-05-CONVERGENCE',
      'EVD-GRAPH-05-RECONSTRUCTION',
      'EVD-SYNTH-01-SPECIFICATION',
      'EVD-SYNTH-02-LINEAGE',
      'EVD-SYNTH-03-BOUNDARY',
      'EVD-SYNTH-04-RELATIONAL',
    ]),
    synthesisNotes:
      'Provides unified multi-perspective reconstruction context synthesizing all four analytical perspectives and graph reconstruction evidence.',
    content: Object.freeze({
      perspective_id: 'PERSPECTIVE-SYNTH-05-MULTI',
      perspective_dimension: 'MULTI_DIMENSIONAL_RECONSTRUCTION',
      perspective_reference: 'SYNTH-MULTI-UNIFIED-0051',
      synthesis_scope: 'HOLISTIC_ENCLAVE_SYNTHESIS',
      correlated_dimensions: Object.freeze([
        'CONVERGENCE_INFERENCE_MODEL',
        'GRAPH_RECONSTRUCTION_FRAGMENT',
        'SPECIFICATION_SYNTHESIS',
        'LINEAGE_SYNTHESIS',
        'BOUNDARY_SYNTHESIS',
        'RELATIONAL_SYNTHESIS',
      ]),
      synthesized_aspects: Object.freeze([
        'Unified multi-dimensional reconstruction synthesizes structural, historical, environmental, and relational analytical perspectives.',
        'Coexisting evidence dimensions reflect complex enclave architecture requiring multi-perspective reasoning.',
        'Analytical synthesis provides comprehensive evidence reconstruction without deciding final interpretation.',
      ]),
      contextual_observations: Object.freeze([
        Object.freeze({
          dimension: 'STRUCTURAL_SYNTHESIS',
          reference_id: 'EVD-SYNTH-01-SPECIFICATION',
          observation_summary: 'Hardware key-binding and specification dimensions establish enclave isolation base.',
        }),
        Object.freeze({
          dimension: 'HISTORICAL_SYNTHESIS',
          reference_id: 'EVD-SYNTH-02-LINEAGE',
          observation_summary: 'Succession and lineage records establish audit continuity across generation boundaries.',
        }),
        Object.freeze({
          dimension: 'ENVIRONMENTAL_SYNTHESIS',
          reference_id: 'EVD-SYNTH-03-BOUNDARY',
          observation_summary: 'Containment perimeters establish workload execution boundaries across isolated domains.',
        }),
        Object.freeze({
          dimension: 'RELATIONAL_SYNTHESIS',
          reference_id: 'EVD-SYNTH-04-RELATIONAL',
          observation_summary: 'Cross-domain reconciliation harmonizes coexisting operational models.',
        }),
      ]),
      synthesis_notes:
        'Provides unified multi-perspective reconstruction context synthesizing all four analytical perspectives and graph reconstruction evidence.',
    }),
  }),
});
