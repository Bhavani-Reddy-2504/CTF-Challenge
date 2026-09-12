import { AppError } from '../../errors/app-error.js';
import type { SynthesisArtifact } from '../../evidence/evidence-types.js';
import type { InternalSynthesisDefinition } from './synthesis-types.js';

export class SynthesisConsistencyError extends AppError {
  constructor(message: string) {
    super({
      code: 'ERR_SYNTHESIS_CONSISTENCY',
      message,
      statusCode: 500,
      classification: 'INTERNAL_FAULT',
    });
    this.name = 'SynthesisConsistencyError';
  }
}

export const KNOWN_VALID_EVIDENCE_IDS: ReadonlySet<string> = new Set<string>([
  // Prompt 4: Metadata
  'EVD-META-01-ROUTER',
  'EVD-META-02-CONTEXT',
  'EVD-META-03-BOUNDARY',
  'EVD-META-04-SECURITY',
  // Prompt 4: Audit
  'EVD-AUD-01-DISPATCH',
  'EVD-AUD-02-BOOT',
  'EVD-AUD-03-FAILS',
  // Prompt 5: Config
  'EVD-CFG-01-ACTIVE-SPEC',
  'EVD-CFG-02-BINDING',
  'EVD-CFG-03-INTEGRITY',
  'EVD-CFG-04-COMPAT',
  // Prompt 6: Identity
  'EVD-IDN-01-CONTEXT',
  'EVD-IDN-02-BINDING',
  'EVD-IDN-03-TRUST-MEMBERSHIP',
  'EVD-IDN-04-LINEAGE',
  // Prompt 7: Trust
  'EVD-TRUST-01-COHERENCE',
  'EVD-TRUST-02-BINDING',
  'EVD-TRUST-03-LINEAGE',
  'EVD-TRUST-04-MEMBERSHIP',
  'EVD-TRUST-05-INTERPRETATION',
  // Prompt 8: Transition
  'EVD-TRANS-01-OBSERVATION',
  'EVD-TRANS-02-CORRELATION',
  'EVD-TRANS-03-RECONCILIATION',
  // Prompt 9: Constraint
  'EVD-CONSTRAINT-01-SPECIFICATION',
  'EVD-CONSTRAINT-02-CONTINUITY',
  'EVD-CONSTRAINT-03-BOUNDARY',
  'EVD-CONSTRAINT-04-RECONCILIATION',
  // Prompt 10: Inference
  'EVD-INFER-01-SPECIFICATION',
  'EVD-INFER-02-LINEAGE',
  'EVD-INFER-03-BOUNDARY',
  'EVD-INFER-04-RECONCILIATION',
  'EVD-INFER-05-CONVERGENCE',
  // Prompt 11: Graph
  'EVD-GRAPH-01-CONTEXT',
  'EVD-GRAPH-02-CORRELATION',
  'EVD-GRAPH-03-TOPOLOGY',
  'EVD-GRAPH-04-CONVERGENCE',
  'EVD-GRAPH-05-RECONSTRUCTION',
  // Prompt 12: Synthesis
  'EVD-SYNTH-01-SPECIFICATION',
  'EVD-SYNTH-02-LINEAGE',
  'EVD-SYNTH-03-BOUNDARY',
  'EVD-SYNTH-04-RELATIONAL',
  'EVD-SYNTH-05-MULTI-PERSPECTIVE',
]);

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

/**
 * Internal synthesis model representing server-side conceptual perspective relationships.
 * Kept strictly private to the validator and module initialization.
 */
export const INTERNAL_SYNTHESIS_MODEL: InternalSynthesisDefinition = Object.freeze({
  perspectives: Object.freeze([
    Object.freeze({
      perspectiveId: 'PERSPECTIVE-SPEC',
      evidenceRef: 'EVD-SYNTH-01-SPECIFICATION',
      dimension: 'STRUCTURAL_PERSPECTIVE',
      description: 'Maintained structural and key-binding perspective',
    }),
    Object.freeze({
      perspectiveId: 'PERSPECTIVE-LIN',
      evidenceRef: 'EVD-SYNTH-02-LINEAGE',
      dimension: 'HISTORICAL_PERSPECTIVE',
      description: 'Historical succession and continuity perspective',
    }),
    Object.freeze({
      perspectiveId: 'PERSPECTIVE-BND',
      evidenceRef: 'EVD-SYNTH-03-BOUNDARY',
      dimension: 'ENVIRONMENTAL_PERSPECTIVE',
      description: 'Environmental containment and boundary perspective',
    }),
    Object.freeze({
      perspectiveId: 'PERSPECTIVE-REL',
      evidenceRef: 'EVD-SYNTH-04-RELATIONAL',
      dimension: 'CROSS_DOMAIN_PERSPECTIVE',
      description: 'Cross-domain reconciliation and coexistence perspective',
    }),
    Object.freeze({
      perspectiveId: 'PERSPECTIVE-MULTI',
      evidenceRef: 'EVD-SYNTH-05-MULTI-PERSPECTIVE',
      dimension: 'MULTI_DIMENSIONAL_RECONSTRUCTION',
      description: 'Holistic multi-perspective reconstruction perspective',
    }),
  ]),
  links: Object.freeze([
    Object.freeze({
      linkId: 'LINK-SPEC-TO-MULTI',
      sourcePerspective: 'PERSPECTIVE-SPEC',
      targetPerspective: 'PERSPECTIVE-MULTI',
      synthesisNature: 'STRUCTURAL_ALIGNMENT',
      conceptualContext: 'Structural perspective informs multi-dimensional reconstruction',
    }),
    Object.freeze({
      linkId: 'LINK-LIN-TO-MULTI',
      sourcePerspective: 'PERSPECTIVE-LIN',
      targetPerspective: 'PERSPECTIVE-MULTI',
      synthesisNature: 'HISTORICAL_ALIGNMENT',
      conceptualContext: 'Historical succession informs multi-dimensional reconstruction',
    }),
    Object.freeze({
      linkId: 'LINK-BND-TO-MULTI',
      sourcePerspective: 'PERSPECTIVE-BND',
      targetPerspective: 'PERSPECTIVE-MULTI',
      synthesisNature: 'ENVIRONMENTAL_ALIGNMENT',
      conceptualContext: 'Environmental containment informs multi-dimensional reconstruction',
    }),
    Object.freeze({
      linkId: 'LINK-REL-TO-MULTI',
      sourcePerspective: 'PERSPECTIVE-REL',
      targetPerspective: 'PERSPECTIVE-MULTI',
      synthesisNature: 'RELATIONAL_ALIGNMENT',
      conceptualContext: 'Relational reconciliation informs multi-dimensional reconstruction',
    }),
  ]),
});

/**
 * Validates that the internal synthesis model is an acyclic DAG.
 */
export function validateInternalSynthesisModel(model: InternalSynthesisDefinition): void {
  const perspectiveIds = new Set<string>();
  for (const pers of model.perspectives) {
    if (perspectiveIds.has(pers.perspectiveId)) {
      throw new SynthesisConsistencyError(
        `Duplicate perspectiveId in internal synthesis model: ${pers.perspectiveId}`
      );
    }
    perspectiveIds.add(pers.perspectiveId);
  }

  const adjacency = new Map<string, string[]>();
  for (const persId of perspectiveIds) {
    adjacency.set(persId, []);
  }

  for (const link of model.links) {
    if (!perspectiveIds.has(link.sourcePerspective)) {
      throw new SynthesisConsistencyError(
        `Unknown sourcePerspective in link ${link.linkId}: ${link.sourcePerspective}`
      );
    }
    if (!perspectiveIds.has(link.targetPerspective)) {
      throw new SynthesisConsistencyError(
        `Unknown targetPerspective in link ${link.linkId}: ${link.targetPerspective}`
      );
    }
    if (link.sourcePerspective === link.targetPerspective) {
      throw new SynthesisConsistencyError(
        `Self-referential link in internal synthesis model: ${link.linkId}`
      );
    }
    adjacency.get(link.sourcePerspective)!.push(link.targetPerspective);
  }

  // Cycle detection via DFS
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function dfs(current: string): void {
    visiting.add(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visiting.has(neighbor)) {
        throw new SynthesisConsistencyError(
          `Cycle detected in internal synthesis model involving perspective: ${neighbor}`
        );
      }
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      }
    }
    visiting.delete(current);
    visited.add(current);
  }

  for (const persId of perspectiveIds) {
    if (!visited.has(persId)) {
      dfs(persId);
    }
  }
}

/**
 * Recursively checks any object or array to ensure ZERO boolean values exist.
 * Throws SynthesisConsistencyError if any boolean value is found.
 */
export function assertNoBooleansRecursively(obj: unknown, path = 'root'): void {
  if (typeof obj === 'boolean') {
    throw new SynthesisConsistencyError(
      `Forbidden Boolean value found at path "${path}": ${obj}. Synthesis content must be free of boolean oracles.`
    );
  }
  if (obj !== null && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        assertNoBooleansRecursively(item, `${path}[${index}]`);
      });
    } else {
      for (const [key, value] of Object.entries(obj)) {
        assertNoBooleansRecursively(value, path ? `${path}.${key}` : key);
      }
    }
  }
}

/**
 * Validates all canonical synthesis artifacts during bootstrap.
 * Enforces strict fail-closed integrity, envelope standards, and anti-leakage defenses.
 */
export function validateSynthesisArtifacts(
  artifacts: Record<string, SynthesisArtifact<any>>
): void {
  // 1. Validate internal synthesis model first
  validateInternalSynthesisModel(INTERNAL_SYNTHESIS_MODEL);

  const keys = Object.keys(artifacts);
  if (keys.length !== 5) {
    throw new SynthesisConsistencyError(
      `Expected exactly 5 synthesis artifacts, received: ${keys.length}`
    );
  }

  const expectedKeys = new Set([
    'specification-perspective',
    'lineage-perspective',
    'boundary-perspective',
    'relational-perspective',
    'multi-perspective',
  ]);

  for (const key of keys) {
    if (!expectedKeys.has(key)) {
      throw new SynthesisConsistencyError(`Unknown canonical synthesis key: ${key}`);
    }
  }

  const seenIds = new Set<string>();

  for (const [key, artifact] of Object.entries(artifacts)) {
    if (!artifact.artifactId || !artifact.artifactId.startsWith('EVD-SYNTH-')) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' has invalid artifactId: ${artifact.artifactId}`
      );
    }

    if (seenIds.has(artifact.artifactId)) {
      throw new SynthesisConsistencyError(
        `Duplicate artifactId found in synthesis artifacts: ${artifact.artifactId}`
      );
    }
    seenIds.add(artifact.artifactId);

    if (artifact.source !== 'synthesis') {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' must declare source 'synthesis', got: ${artifact.source}`
      );
    }

    if (!SEMVER_REGEX.test(artifact.version)) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' must declare valid semver version, got: ${artifact.version}`
      );
    }

    if (artifact.status !== 'ACTIVE') {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' must declare status 'ACTIVE', got: ${artifact.status}`
      );
    }

    if (artifact.authority_conferred !== false) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' must strictly set authority_conferred: false`
      );
    }

    // Correlated evidence universe check
    for (const ref of artifact.correlatedEvidence) {
      if (!KNOWN_VALID_EVIDENCE_IDS.has(ref)) {
        throw new SynthesisConsistencyError(
          `Artifact '${key}' references unknown evidence ID: ${ref}`
        );
      }
    }

    // Recursive zero-Boolean validation on content
    assertNoBooleansRecursively(artifact.content, `${key}.content`);

    // Anti-leakage checks on serialized artifact
    const serialized = JSON.stringify(artifact);

    // Flag leakage check
    const envFlag = process.env.ENCLAVE_FLAG || process.env.CHALLENGE_FLAG;
    if (envFlag && serialized.includes(envFlag)) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' contains prohibited flag material.`
      );
    }

    // Secrets / credentials check
    if (
      /BEGIN\s+(RSA|EC|PRIVATE)\s+KEY/i.test(serialized) ||
      /bearer\s+[a-z0-9_.-]{10,}/i.test(serialized) ||
      /\b(api_key|client_secret|private_key)\b/i.test(serialized)
    ) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' contains prohibited credential or secret patterns.`
      );
    }

    // Real cloud technology check
    if (/\b(aws|azure|gcp|kubernetes|docker|k8s)\b/i.test(serialized)) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' contains prohibited real-world cloud technology names.`
      );
    }

    // SPIFFE / SPIRE / SVID check
    if (/\b(spiffe|spire|svid)\b/i.test(serialized)) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' contains prohibited SPIFFE/SPIRE/SVID technology terms.`
      );
    }

    // Token / auth terminology check
    if (/\b(jwt|oauth|oidc|saml)\b/i.test(serialized)) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' contains prohibited authentication or token terminology.`
      );
    }

    // Challenge meta-language check
    if (
      /prompt\s*\d+/i.test(serialized) ||
      /phase\s*\d+/i.test(serialized) ||
      /subsequent\s+phase/i.test(serialized) ||
      /next\s+stage/i.test(serialized) ||
      /flag\s+location/i.test(serialized) ||
      /the\s+solution\s+is/i.test(serialized) ||
      /correct\s+answer/i.test(serialized) ||
      /final\s+answer/i.test(serialized) ||
      /solution\s+path/i.test(serialized)
    ) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' contains forbidden developer meta-language or instructional phrasing.`
      );
    }

    // Graph structure / topology oracle check
    if (
      /\b(node_count|edge_count|dependency_count|prerequisite_count|shortest_path|longest_path|topological_order|traversal_order|critical_path|solution_path|correct_path)\b/i.test(
        serialized
      ) ||
      /\b(is_root|is_leaf|is_correct|is_valid|is_selected|is_solution)\b/i.test(
        serialized
      )
    ) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' contains prohibited graph structure or path oracle fields.`
      );
    }

    // Ranking, scoring, and winner leakage check
    if (
      /\b(winner|winning_hypothesis|winning_model|best_hypothesis|likelihood_score|confidence_score|selection_algorithm|model_ranking)\b/i.test(
        serialized
      ) ||
      /\b(score|rank|ranking|priority|weight|confidence|probability|likelihood)\b/i.test(
        serialized
      )
    ) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' contains prohibited scoring, ranking, or winner resolution terminology.`
      );
    }

    // Direct hierarchy oracles
    if (
      /\b(precedence_order|resolution_order|winning_dimension|dominant_dimension|highest_priority|authoritative_winner)\b/i.test(
        serialized
      )
    ) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' contains prohibited hierarchy or resolution order fields.`
      );
    }

    // Future module leakage check
    if (/prompt\s*13|phase\s*13|future\s+module|next\s+module/i.test(serialized)) {
      throw new SynthesisConsistencyError(
        `Artifact '${key}' contains prohibited forward-looking roadmap references.`
      );
    }
  }
}
