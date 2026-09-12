import { AppError } from '../../errors/app-error.js';
import type { GraphArtifact } from '../../evidence/evidence-types.js';
import type { InternalGraphDefinition } from './graph-types.js';

export class GraphConsistencyError extends AppError {
  constructor(message: string) {
    super({
      code: 'ERR_GRAPH_CONSISTENCY',
      message,
      statusCode: 500,
      classification: 'INTERNAL_FAULT',
    });
    this.name = 'GraphConsistencyError';
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
]);

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

/**
 * Internal graph model representing server-side conceptual evidence relationships.
 * Kept strictly private to the validator and module initialization.
 */
export const INTERNAL_GRAPH: InternalGraphDefinition = Object.freeze({
  nodes: Object.freeze([
    Object.freeze({
      nodeId: 'NODE-META-02',
      evidenceRef: 'EVD-META-02-CONTEXT',
      domain: 'metadata',
      description: 'Contextual environment topology',
    }),
    Object.freeze({
      nodeId: 'NODE-CFG-01',
      evidenceRef: 'EVD-CFG-01-ACTIVE-SPEC',
      domain: 'config',
      description: 'Active execution profile specification',
    }),
    Object.freeze({
      nodeId: 'NODE-CFG-02',
      evidenceRef: 'EVD-CFG-02-BINDING',
      domain: 'config',
      description: 'Hardware key binding profile',
    }),
    Object.freeze({
      nodeId: 'NODE-AUD-03',
      evidenceRef: 'EVD-AUD-03-FAILS',
      domain: 'audit',
      description: 'Failure transition audit trace',
    }),
    Object.freeze({
      nodeId: 'NODE-IDN-04',
      evidenceRef: 'EVD-IDN-04-LINEAGE',
      domain: 'identity',
      description: 'Component succession lineage record',
    }),
    Object.freeze({
      nodeId: 'NODE-TRUST-03',
      evidenceRef: 'EVD-TRUST-03-LINEAGE',
      domain: 'trust',
      description: 'Trust lineage coherence',
    }),
    Object.freeze({
      nodeId: 'NODE-TRANS-03',
      evidenceRef: 'EVD-TRANS-03-RECONCILIATION',
      domain: 'transition',
      description: 'Reconciled transition state baseline',
    }),
    Object.freeze({
      nodeId: 'NODE-CONSTRAINT-02',
      evidenceRef: 'EVD-CONSTRAINT-02-CONTINUITY',
      domain: 'constraint',
      description: 'Historical succession continuity constraint',
    }),
    Object.freeze({
      nodeId: 'NODE-CONSTRAINT-03',
      evidenceRef: 'EVD-CONSTRAINT-03-BOUNDARY',
      domain: 'constraint',
      description: 'Perimeter boundary delimitation constraint',
    }),
    Object.freeze({
      nodeId: 'NODE-INFER-01',
      evidenceRef: 'EVD-INFER-01-SPECIFICATION',
      domain: 'inference',
      description: 'Structural configuration inference model',
    }),
    Object.freeze({
      nodeId: 'NODE-INFER-04',
      evidenceRef: 'EVD-INFER-04-RECONCILIATION',
      domain: 'inference',
      description: 'Cross-domain reconciliation inference model',
    }),
    Object.freeze({
      nodeId: 'NODE-INFER-05',
      evidenceRef: 'EVD-INFER-05-CONVERGENCE',
      domain: 'inference',
      description: 'Multi-model inference convergence context',
    }),
    Object.freeze({
      nodeId: 'NODE-GRAPH-01',
      evidenceRef: 'EVD-GRAPH-01-CONTEXT',
      domain: 'graph',
      description: 'Contextual delimitation graph fragment',
    }),
    Object.freeze({
      nodeId: 'NODE-GRAPH-02',
      evidenceRef: 'EVD-GRAPH-02-CORRELATION',
      domain: 'graph',
      description: 'Lineage continuity correlation fragment',
    }),
    Object.freeze({
      nodeId: 'NODE-GRAPH-03',
      evidenceRef: 'EVD-GRAPH-03-TOPOLOGY',
      domain: 'graph',
      description: 'Structural topology graph fragment',
    }),
    Object.freeze({
      nodeId: 'NODE-GRAPH-04',
      evidenceRef: 'EVD-GRAPH-04-CONVERGENCE',
      domain: 'graph',
      description: 'Dimensional convergence graph fragment',
    }),
    Object.freeze({
      nodeId: 'NODE-GRAPH-05',
      evidenceRef: 'EVD-GRAPH-05-RECONSTRUCTION',
      domain: 'graph',
      description: 'Unified relational reconstruction fragment',
    }),
  ]),
  edges: Object.freeze([
    Object.freeze({
      edgeId: 'EDGE-01',
      sourceNode: 'NODE-META-02',
      targetNode: 'NODE-GRAPH-01',
      relationType: 'CONTEXTUAL_ASSOCIATION',
      conceptualMeaning: 'Environment topology associates with contextual fragment',
    }),
    Object.freeze({
      edgeId: 'EDGE-02',
      sourceNode: 'NODE-CFG-02',
      targetNode: 'NODE-GRAPH-01',
      relationType: 'HARDWARE_AFFINITY',
      conceptualMeaning: 'Hardware binding associates with contextual boundary',
    }),
    Object.freeze({
      edgeId: 'EDGE-03',
      sourceNode: 'NODE-CONSTRAINT-03',
      targetNode: 'NODE-GRAPH-01',
      relationType: 'PERIMETER_DELIMITATION',
      conceptualMeaning: 'Boundary constraint associates with contextual fragment',
    }),
    Object.freeze({
      edgeId: 'EDGE-04',
      sourceNode: 'NODE-AUD-03',
      targetNode: 'NODE-GRAPH-02',
      relationType: 'AUDIT_TRACE_ANCHOR',
      conceptualMeaning: 'Failure audit trace connects to correlation fragment',
    }),
    Object.freeze({
      edgeId: 'EDGE-05',
      sourceNode: 'NODE-IDN-04',
      targetNode: 'NODE-GRAPH-02',
      relationType: 'SUCCESSION_ANCHOR',
      conceptualMeaning: 'Succession lineage connects to correlation fragment',
    }),
    Object.freeze({
      edgeId: 'EDGE-06',
      sourceNode: 'NODE-TRUST-03',
      targetNode: 'NODE-GRAPH-02',
      relationType: 'TRUST_CONTINUITY',
      conceptualMeaning: 'Trust lineage coherence connects to correlation fragment',
    }),
    Object.freeze({
      edgeId: 'EDGE-07',
      sourceNode: 'NODE-CONSTRAINT-02',
      targetNode: 'NODE-GRAPH-02',
      relationType: 'CONTINUITY_CONSTRAINT',
      conceptualMeaning: 'Continuity constraint connects to correlation fragment',
    }),
    Object.freeze({
      edgeId: 'EDGE-08',
      sourceNode: 'NODE-GRAPH-01',
      targetNode: 'NODE-GRAPH-03',
      relationType: 'CONTEXT_TO_TOPOLOGY',
      conceptualMeaning: 'Context fragment feeds topology fragment in Branch 1',
    }),
    Object.freeze({
      edgeId: 'EDGE-09',
      sourceNode: 'NODE-CFG-01',
      targetNode: 'NODE-GRAPH-03',
      relationType: 'SPECIFICATION_ALIGNMENT',
      conceptualMeaning: 'Active spec aligns with topology fragment',
    }),
    Object.freeze({
      edgeId: 'EDGE-10',
      sourceNode: 'NODE-INFER-01',
      targetNode: 'NODE-GRAPH-03',
      relationType: 'STRUCTURAL_INFERENCE',
      conceptualMeaning: 'Structural inference model feeds topology fragment',
    }),
    Object.freeze({
      edgeId: 'EDGE-11',
      sourceNode: 'NODE-GRAPH-02',
      targetNode: 'NODE-GRAPH-04',
      relationType: 'CORRELATION_TO_CONVERGENCE',
      conceptualMeaning: 'Correlation fragment feeds convergence fragment in Branch 2',
    }),
    Object.freeze({
      edgeId: 'EDGE-12',
      sourceNode: 'NODE-TRANS-03',
      targetNode: 'NODE-GRAPH-04',
      relationType: 'RECONCILED_BASELINE',
      conceptualMeaning: 'Reconciled transition state feeds convergence fragment',
    }),
    Object.freeze({
      edgeId: 'EDGE-13',
      sourceNode: 'NODE-INFER-04',
      targetNode: 'NODE-GRAPH-04',
      relationType: 'RECONCILIATION_MODEL',
      conceptualMeaning: 'Reconciliation inference model feeds convergence fragment',
    }),
    Object.freeze({
      edgeId: 'EDGE-14',
      sourceNode: 'NODE-GRAPH-03',
      targetNode: 'NODE-GRAPH-05',
      relationType: 'BRANCH1_TO_RECONSTRUCTION',
      conceptualMeaning: 'Topology fragment from Branch 1 converges into reconstruction fragment',
    }),
    Object.freeze({
      edgeId: 'EDGE-15',
      sourceNode: 'NODE-GRAPH-04',
      targetNode: 'NODE-GRAPH-05',
      relationType: 'BRANCH2_TO_RECONSTRUCTION',
      conceptualMeaning: 'Convergence fragment from Branch 2 converges into reconstruction fragment',
    }),
    Object.freeze({
      edgeId: 'EDGE-16',
      sourceNode: 'NODE-INFER-05',
      targetNode: 'NODE-GRAPH-05',
      relationType: 'UNIFIED_CONVERGENCE',
      conceptualMeaning: 'Multi-model inference convergence unifies into reconstruction fragment',
    }),
  ]),
});

/**
 * Validates the internal graph structure to ensure no dangling edges,
 * unique identifiers, no self-references, and no circular gating dependencies.
 */
export function validateInternalGraph(graph: InternalGraphDefinition): void {
  const nodeIds = new Set<string>();
  const evidenceMap = new Map<string, string>();

  for (const node of graph.nodes) {
    if (nodeIds.has(node.nodeId)) {
      throw new GraphConsistencyError(`Duplicate internal node identifier: '${node.nodeId}'.`);
    }
    nodeIds.add(node.nodeId);

    if (!KNOWN_VALID_EVIDENCE_IDS.has(node.evidenceRef)) {
      throw new GraphConsistencyError(
        `Internal node '${node.nodeId}' references unknown evidence ID: '${node.evidenceRef}'.`
      );
    }
    evidenceMap.set(node.nodeId, node.evidenceRef);
  }

  const edgeIds = new Set<string>();
  const adjacency = new Map<string, Set<string>>();

  for (const edge of graph.edges) {
    if (edgeIds.has(edge.edgeId)) {
      throw new GraphConsistencyError(`Duplicate internal edge identifier: '${edge.edgeId}'.`);
    }
    edgeIds.add(edge.edgeId);

    if (!nodeIds.has(edge.sourceNode)) {
      throw new GraphConsistencyError(
        `Edge '${edge.edgeId}' references unknown source node '${edge.sourceNode}'.`
      );
    }
    if (!nodeIds.has(edge.targetNode)) {
      throw new GraphConsistencyError(
        `Edge '${edge.edgeId}' references unknown target node '${edge.targetNode}'.`
      );
    }

    if (edge.sourceNode === edge.targetNode) {
      throw new GraphConsistencyError(
        `Edge '${edge.edgeId}' has forbidden self-referential edge on node '${edge.sourceNode}'.`
      );
    }

    if (!adjacency.has(edge.sourceNode)) {
      adjacency.set(edge.sourceNode, new Set());
    }
    const targets = adjacency.get(edge.sourceNode)!;
    if (targets.has(edge.targetNode)) {
      throw new GraphConsistencyError(
        `Duplicate edge discovered between '${edge.sourceNode}' and '${edge.targetNode}'.`
      );
    }
    targets.add(edge.targetNode);
  }

  // Verify internal graph gating acyclicity (DAG verification)
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacency.get(nodeId);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      if (hasCycle(nodeId)) {
        throw new GraphConsistencyError('Circular dependency cycle detected in internal graph model.');
      }
    }
  }
}

/**
 * Recursively inspects an object to ensure no Boolean properties exist.
 */
function assertNoBooleans(obj: unknown, path = 'content'): void {
  if (obj === null || obj === undefined) {
    return;
  }
  if (typeof obj === 'boolean') {
    throw new GraphConsistencyError(
      `Prohibited boolean oracle discovered at '${path}'. Graph artifacts must not contain boolean fields.`
    );
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertNoBooleans(obj[i], `${path}[${i}]`);
    }
    return;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      assertNoBooleans(value, `${path}.${key}`);
    }
  }
}

/**
 * Validates the internal consistency, integrity, and anti-leakage constraints
 * of graph correlation artifacts during engine initialization.
 */
export function validateGraphArtifacts(
  artifacts: Readonly<Record<string, GraphArtifact>>
): void {
  // 1. Validate internal graph first
  validateInternalGraph(INTERNAL_GRAPH);

  // 2. Exactly five canonical artifacts
  const keys = Object.keys(artifacts);
  if (keys.length !== 5) {
    throw new GraphConsistencyError(
      `Expected exactly 5 canonical graph artifacts, found ${keys.length}.`
    );
  }

  const expectedKeys = new Set([
    'context-fragment',
    'correlation-fragment',
    'topology-fragment',
    'convergence-fragment',
    'reconstruction-fragment',
  ]);

  for (const key of keys) {
    if (!expectedKeys.has(key)) {
      throw new GraphConsistencyError(`Unexpected graph artifact key: '${key}'.`);
    }
  }

  const seenIds = new Set<string>();

  for (const [key, artifact] of Object.entries(artifacts)) {
    // 3. Artifact ID format and uniqueness
    if (!artifact.artifactId.startsWith('EVD-GRAPH-')) {
      throw new GraphConsistencyError(
        `Artifact '${key}' has invalid identifier format: '${artifact.artifactId}'. Must start with 'EVD-GRAPH-'.`
      );
    }

    if (seenIds.has(artifact.artifactId)) {
      throw new GraphConsistencyError(
        `Duplicate graph artifact identifier discovered: '${artifact.artifactId}' in '${key}'.`
      );
    }
    seenIds.add(artifact.artifactId);

    // 4. Semver validation
    if (!SEMVER_REGEX.test(artifact.version)) {
      throw new GraphConsistencyError(
        `Artifact '${key}' has invalid semver format: '${artifact.version}'.`
      );
    }

    // 5. Status validation
    if (artifact.status !== 'ACTIVE') {
      throw new GraphConsistencyError(
        `Artifact '${key}' must have status 'ACTIVE', found '${artifact.status}'.`
      );
    }

    // 6. Evidence universe references
    for (const ref of artifact.correlatedEvidence) {
      if (!KNOWN_VALID_EVIDENCE_IDS.has(ref)) {
        throw new GraphConsistencyError(
          `Artifact '${key}' references unknown evidence ID '${ref}' in correlatedEvidence.`
        );
      }
    }

    const content = artifact.content as Record<string, unknown>;
    if (Array.isArray(content.contextual_associations)) {
      for (const assoc of content.contextual_associations as Record<string, unknown>[]) {
        const target = assoc.target_evidence;
        if (typeof target === 'string' && !KNOWN_VALID_EVIDENCE_IDS.has(target)) {
          throw new GraphConsistencyError(
            `Artifact '${key}' references unknown target evidence ID '${target}' in contextual_associations.`
          );
        }
      }
    }

    // 7. Zero Boolean Oracles (recursively checked)
    assertNoBooleans(artifact.content, `${key}.content`);

    // 8. Anti-leakage and defensive scanning
    const serialized = JSON.stringify(artifact);

    // Flag check
    const envFlag = process.env.ENCLAVE_FLAG || process.env.CHALLENGE_FLAG;
    if (envFlag && serialized.includes(envFlag)) {
      throw new GraphConsistencyError(
        `Artifact '${key}' contains prohibited flag material.`
      );
    }

    // Credentials / secrets check
    if (
      /\b(password|secret_key|private_key|api_key|access_token|refresh_token|bearer)\b/i.test(
        serialized
      )
    ) {
      throw new GraphConsistencyError(
        `Artifact '${key}' contains prohibited credential or secret material.`
      );
    }

    // Real cloud technology check
    if (
      /\b(aws|amazon web services|azure|gcp|google cloud|kubernetes|k8s|docker)\b/i.test(
        serialized
      )
    ) {
      throw new GraphConsistencyError(
        `Artifact '${key}' contains prohibited real-world cloud technology references.`
      );
    }

    // SPIFFE / SPIRE / SVID check
    if (/\b(spiffe|spire|svid)\b/i.test(serialized)) {
      throw new GraphConsistencyError(
        `Artifact '${key}' contains prohibited SPIFFE/SPIRE/SVID technology references.`
      );
    }

    // Token / auth terminology check
    if (/\b(jwt|oauth|oidc|saml)\b/i.test(serialized)) {
      throw new GraphConsistencyError(
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
      /correct\s+answer/i.test(serialized)
    ) {
      throw new GraphConsistencyError(
        `Artifact '${key}' contains forbidden developer meta-language or instructional phrasing.`
      );
    }

    // Graph structure / topology oracle check
    if (
      /\b(node_count|edge_count|shortest_path|longest_path|topological_order|traversal_order|critical_path|solution_path|correct_path)\b/i.test(
        serialized
      ) ||
      /\b(is_root|is_leaf|is_correct|is_valid|is_selected|is_solution)\b/i.test(
        serialized
      )
    ) {
      throw new GraphConsistencyError(
        `Artifact '${key}' contains prohibited graph structure or path oracle fields.`
      );
    }

    // Ranking and scoring leakage check
    if (
      /\b(winner|winning_hypothesis|best_hypothesis|likelihood_score|confidence_score|selection_algorithm|model_ranking)\b/i.test(
        serialized
      )
    ) {
      throw new GraphConsistencyError(
        `Artifact '${key}' contains prohibited scoring, ranking, or winner resolution terminology.`
      );
    }

    // Future module leakage check
    if (/prompt\s*12|phase\s*12|future\s+module|next\s+module/i.test(serialized)) {
      throw new GraphConsistencyError(
        `Artifact '${key}' contains prohibited forward-looking roadmap references.`
      );
    }
  }
}
