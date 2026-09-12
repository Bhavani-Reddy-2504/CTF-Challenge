import { AppError } from '../../errors/app-error.js';
import type { ResolutionArtifact } from '../../evidence/evidence-types.js';
import type { InternalResolutionDefinition } from './resolution-types.js';

export class ResolutionConsistencyError extends AppError {
  constructor(message: string) {
    super({
      code: 'ERR_RESOLUTION_CONSISTENCY',
      message,
      statusCode: 500,
      classification: 'INTERNAL_FAULT',
    });
    this.name = 'ResolutionConsistencyError';
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
  // Prompt 13: Resolution
  'EVD-RES-01-STRUCTURAL',
  'EVD-RES-02-HISTORICAL',
  'EVD-RES-03-ENVIRONMENTAL',
  'EVD-RES-04-RELATIONAL',
  'EVD-RES-05-CONTEXT',
]);

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

/**
 * Internal resolution model representing server-side conceptual resolution relationships.
 * Kept strictly private to the validator and module initialization.
 */
export const INTERNAL_RESOLUTION_MODEL: InternalResolutionDefinition = Object.freeze({
  nodes: Object.freeze([
    Object.freeze({
      nodeId: 'NODE-RES-STRUCT',
      evidenceRef: 'EVD-RES-01-STRUCTURAL',
      dimension: 'STRUCTURAL_CONFIGURATION',
      description: 'Structural and execution configuration resolution context',
    }),
    Object.freeze({
      nodeId: 'NODE-RES-HIST',
      evidenceRef: 'EVD-RES-02-HISTORICAL',
      dimension: 'HISTORICAL_SUCCESSION',
      description: 'Historical succession and audit continuity resolution context',
    }),
    Object.freeze({
      nodeId: 'NODE-RES-ENV',
      evidenceRef: 'EVD-RES-03-ENVIRONMENTAL',
      dimension: 'ENVIRONMENTAL_CONTAINMENT',
      description: 'Environmental containment and perimeter resolution context',
    }),
    Object.freeze({
      nodeId: 'NODE-RES-REL',
      evidenceRef: 'EVD-RES-04-RELATIONAL',
      dimension: 'CROSS_DOMAIN_RELATIONSHIP',
      description: 'Cross-domain reconciliation and non-linear correlation context',
    }),
    Object.freeze({
      nodeId: 'NODE-RES-UNIFIED',
      evidenceRef: 'EVD-RES-05-CONTEXT',
      dimension: 'CONTROLLED_MULTI_DOMAIN_ALIGNMENT',
      description: 'Unified multi-domain resolution preparation context',
    }),
  ]),
  relations: Object.freeze([
    Object.freeze({
      relationId: 'REL-STRUCT-TO-UNIFIED',
      sourceNode: 'NODE-RES-STRUCT',
      targetNode: 'NODE-RES-UNIFIED',
      relationType: 'STRUCTURAL_PREPARATION',
      contextualDescription: 'Structural context contributes to unified resolution preparation',
    }),
    Object.freeze({
      relationId: 'REL-HIST-TO-UNIFIED',
      sourceNode: 'NODE-RES-HIST',
      targetNode: 'NODE-RES-UNIFIED',
      relationType: 'HISTORICAL_PREPARATION',
      contextualDescription: 'Historical context contributes to unified resolution preparation',
    }),
    Object.freeze({
      relationId: 'REL-ENV-TO-UNIFIED',
      sourceNode: 'NODE-RES-ENV',
      targetNode: 'NODE-RES-UNIFIED',
      relationType: 'ENVIRONMENTAL_PREPARATION',
      contextualDescription: 'Environmental context contributes to unified resolution preparation',
    }),
    Object.freeze({
      relationId: 'REL-REL-TO-UNIFIED',
      sourceNode: 'NODE-RES-REL',
      targetNode: 'NODE-RES-UNIFIED',
      relationType: 'RELATIONAL_PREPARATION',
      contextualDescription: 'Relational context contributes to unified resolution preparation',
    }),
  ]),
});

/**
 * Validates that the internal resolution model is an acyclic DAG.
 */
export function validateInternalResolutionModel(model: InternalResolutionDefinition): void {
  const nodeIds = new Set<string>();
  for (const node of model.nodes) {
    if (nodeIds.has(node.nodeId)) {
      throw new ResolutionConsistencyError(
        `Duplicate nodeId in internal resolution model: ${node.nodeId}`
      );
    }
    nodeIds.add(node.nodeId);
  }

  const adjacency = new Map<string, string[]>();
  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, []);
  }

  for (const rel of model.relations) {
    if (!nodeIds.has(rel.sourceNode)) {
      throw new ResolutionConsistencyError(
        `Unknown sourceNode in relation ${rel.relationId}: ${rel.sourceNode}`
      );
    }
    if (!nodeIds.has(rel.targetNode)) {
      throw new ResolutionConsistencyError(
        `Unknown targetNode in relation ${rel.relationId}: ${rel.targetNode}`
      );
    }
    if (rel.sourceNode === rel.targetNode) {
      throw new ResolutionConsistencyError(
        `Self-referential relation in internal resolution model: ${rel.relationId}`
      );
    }
    adjacency.get(rel.sourceNode)!.push(rel.targetNode);
  }

  // Cycle detection via DFS
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function dfs(current: string): void {
    visiting.add(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      if (visiting.has(neighbor)) {
        throw new ResolutionConsistencyError(
          `Cycle detected in internal resolution model involving node: ${neighbor}`
        );
      }
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      }
    }
    visiting.delete(current);
    visited.add(current);
  }

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }
}

/**
 * Recursively checks any object or array to ensure ZERO boolean values exist.
 * Throws ResolutionConsistencyError if any boolean value is found.
 */
export function assertNoBooleansRecursively(obj: unknown, path = 'root'): void {
  if (typeof obj === 'boolean') {
    throw new ResolutionConsistencyError(
      `Forbidden Boolean value found at path "${path}": ${obj}. Resolution content must be free of boolean oracles.`
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
 * Validates all canonical resolution artifacts during bootstrap.
 * Enforces strict fail-closed integrity, envelope standards, and anti-leakage defenses.
 */
export function validateResolutionArtifacts(
  artifacts: Record<string, ResolutionArtifact<any>>
): void {
  // 1. Validate internal resolution model first
  validateInternalResolutionModel(INTERNAL_RESOLUTION_MODEL);

  // Check 1 — Exact artifact count (5)
  const keys = Object.keys(artifacts);
  if (keys.length !== 5) {
    throw new ResolutionConsistencyError(
      `Expected exactly 5 resolution artifacts, received: ${keys.length}`
    );
  }

  // Check 2 — Canonical routes (only the five approved routes)
  const expectedKeys = new Set([
    'structural-context',
    'historical-context',
    'environmental-context',
    'relational-context',
    'resolution-context',
  ]);

  for (const key of keys) {
    if (!expectedKeys.has(key)) {
      throw new ResolutionConsistencyError(`Unknown canonical resolution key: ${key}`);
    }
  }

  const expectedIds = new Map([
    ['structural-context', 'EVD-RES-01-STRUCTURAL'],
    ['historical-context', 'EVD-RES-02-HISTORICAL'],
    ['environmental-context', 'EVD-RES-03-ENVIRONMENTAL'],
    ['relational-context', 'EVD-RES-04-RELATIONAL'],
    ['resolution-context', 'EVD-RES-05-CONTEXT'],
  ]);

  const seenIds = new Set<string>();

  for (const [key, artifact] of Object.entries(artifacts)) {
    // Check 3 — Artifact ID integrity
    const expectedId = expectedIds.get(key);
    if (artifact.artifactId !== expectedId) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' expected ID '${expectedId}', got: ${artifact.artifactId}`
      );
    }

    if (seenIds.has(artifact.artifactId)) {
      throw new ResolutionConsistencyError(
        `Duplicate artifactId found in resolution artifacts: ${artifact.artifactId}`
      );
    }
    seenIds.add(artifact.artifactId);

    // Check 6 — Source integrity
    if (artifact.source !== 'resolution') {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' must declare source 'resolution', got: ${artifact.source}`
      );
    }

    // Check 4 — Version integrity
    if (artifact.version !== '1.0.0' || !SEMVER_REGEX.test(artifact.version)) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' must declare version '1.0.0', got: ${artifact.version}`
      );
    }

    // Check 5 — Status integrity
    if (artifact.status !== 'ACTIVE') {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' must declare status 'ACTIVE', got: ${artifact.status}`
      );
    }

    if (artifact.authority_conferred !== false) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' must strictly set authority_conferred: false`
      );
    }

    // Correlated evidence universe check
    for (const ref of artifact.correlatedEvidence) {
      if (!KNOWN_VALID_EVIDENCE_IDS.has(ref)) {
        throw new ResolutionConsistencyError(
          `Artifact '${key}' references unknown evidence ID: ${ref}`
        );
      }
    }

    // Check 7 — Recursive zero-Boolean check
    assertNoBooleansRecursively(artifact.content, `${key}.content`);

    // Anti-leakage checks on serialized artifact
    const serialized = JSON.stringify(artifact);

    // Check 14 — Flag leakage
    const envFlag = process.env.ENCLAVE_FLAG || process.env.CHALLENGE_FLAG;
    if (envFlag && serialized.includes(envFlag)) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' contains prohibited flag material.`
      );
    }

    // Check 13 — Secret leakage
    if (
      /BEGIN\s+(RSA|EC|PRIVATE)\s+KEY/i.test(serialized) ||
      /bearer\s+[a-z0-9_.-]{10,}/i.test(serialized) ||
      /\b(api_key|client_secret|private_key)\b/i.test(serialized)
    ) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' contains prohibited credential or secret patterns.`
      );
    }

    // Check 15 — Real-world cloud technology check
    if (/\b(aws|azure|gcp|kubernetes|docker|k8s)\b/i.test(serialized)) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' contains prohibited real-world cloud technology names.`
      );
    }

    // Check 17 — Identity framework leakage check
    if (/\b(spiffe|spire|svid)\b/i.test(serialized)) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' contains prohibited SPIFFE/SPIRE/SVID technology terms.`
      );
    }

    // Check 16 — Authentication terminology check
    if (/\b(jwt|oauth|oidc|saml)\b/i.test(serialized)) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' contains prohibited authentication or token terminology.`
      );
    }

    // Check 18 — Meta-language & roadmap check
    if (
      /prompt\s*1[3-9]/i.test(serialized) ||
      /phase\s*1[3-9]/i.test(serialized) ||
      /prompt\s*\d+/i.test(serialized) ||
      /phase\s*\d+/i.test(serialized) ||
      /subsequent\s+phase/i.test(serialized) ||
      /next\s+stage/i.test(serialized) ||
      /next\s+phase/i.test(serialized) ||
      /flag\s+location/i.test(serialized) ||
      /the\s+solution\s+is/i.test(serialized) ||
      /correct\s+answer/i.test(serialized) ||
      /final\s+solution/i.test(serialized) ||
      /final\s+answer/i.test(serialized) ||
      /solution\s+path/i.test(serialized) ||
      /challenge\s+author/i.test(serialized) ||
      /developer\s+instruction/i.test(serialized)
    ) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' contains forbidden developer meta-language or instructional phrasing.`
      );
    }

    // Check 11 — Dependency topology leakage check
    if (
      /\b(node_count|edge_count|dependency_count|prerequisite_count|adjacency|neighbors|parents|children|depth|level|critical_path|shortest_path|longest_path|topological_order|traversal_order)\b/i.test(
        serialized
      )
    ) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' contains prohibited dependency topology leakage fields.`
      );
    }

    // Check 8 — Ranking leakage check
    if (
      /\b(score|rank|ranking|weight|priority|confidence|probability|likelihood|precedence|resolution_order)\b/i.test(
        serialized
      )
    ) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' contains prohibited ranking or precedence terminology.`
      );
    }

    // Check 9 — Answer / Winner / Selection leakage check
    if (
      /\b(winner|winning_model|winning_hypothesis|best_model|best_hypothesis|correct_hypothesis|selected_hypothesis|answer|final_answer|solution|solution_path|resolved_value)\b/i.test(
        serialized
      ) ||
      /\b(winning_dimension|dominant_dimension|highest_priority|authoritative_winner)\b/i.test(
        serialized
      )
    ) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' contains prohibited answer, winner, or solution indicators.`
      );
    }

    // Check 10 — Direct coaching language check
    if (
      /always\s+wins/i.test(serialized) ||
      /must\s+select/i.test(serialized) ||
      /correct\s+interpretation/i.test(serialized) ||
      /the\s+answer\s+is/i.test(serialized) ||
      /final\s+answer/i.test(serialized) ||
      /use\s+this\s+solution/i.test(serialized) ||
      /choose\s+this\s+model/i.test(serialized) ||
      /this\s+record\s+wins/i.test(serialized) ||
      /highest\s+version\s+wins/i.test(serialized) ||
      /follow\s+this\s+path/i.test(serialized)
    ) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' contains prohibited coaching language.`
      );
    }

    // Check 12 — Internal resolution model leakage check
    if (
      /NODE-RES-|REL-STRUCT-TO|REL-HIST-TO|REL-ENV-TO|REL-REL-TO|INTERNAL_RESOLUTION_MODEL/i.test(
        serialized
      )
    ) {
      throw new ResolutionConsistencyError(
        `Artifact '${key}' leaks internal resolution model identifiers or structures.`
      );
    }
  }
}
