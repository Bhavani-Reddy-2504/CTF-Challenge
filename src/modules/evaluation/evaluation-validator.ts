import { AppError } from '../../errors/app-error.js';
import type { EvaluationArtifact } from '../../evidence/evidence-types.js';

export class EvaluationConsistencyError extends AppError {
  constructor(message: string) {
    super({
      code: 'ERR_EVALUATION_CONSISTENCY',
      message,
      statusCode: 500,
      classification: 'INTERNAL_FAULT',
    });
    this.name = 'EvaluationConsistencyError';
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
  // Prompt 14: Evaluation
  'EVD-EVAL-01-STRUCTURAL',
  'EVD-EVAL-02-HISTORICAL',
  'EVD-EVAL-03-ENVIRONMENTAL',
  'EVD-EVAL-04-RELATIONAL',
  'EVD-EVAL-05-SUBMISSION-CONTEXT',
]);

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

/**
 * Validates that an object contains absolutely no boolean values recursively.
 */
export function assertNoBooleansRecursively(obj: unknown, path = 'root'): void {
  if (obj === null || obj === undefined) {
    return;
  }
  if (typeof obj === 'boolean') {
    throw new EvaluationConsistencyError(
      `Boolean leakage detected at ${path}: boolean values are strictly prohibited.`
    );
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => assertNoBooleansRecursively(item, `${path}[${idx}]`));
    return;
  }
  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      assertNoBooleansRecursively(value, `${path}.${key}`);
    }
  }
}

/**
 * Validates all evaluation artifacts against structural, security, and anti-leakage invariants.
 * Fails closed if any rule is violated.
 */
export function validateEvaluationArtifacts(
  artifacts: Record<string, EvaluationArtifact<Record<string, unknown>>>
): void {
  const routes = Object.keys(artifacts);

  // 1. Exactly 5 canonical artifacts
  if (routes.length !== 5) {
    throw new EvaluationConsistencyError(
      `Expected exactly 5 canonical evaluation artifacts, received: ${routes.length}`
    );
  }

  // 2. Exactly 5 canonical routes
  const expectedRoutes = new Set([
    'structural-readiness',
    'historical-readiness',
    'environmental-readiness',
    'relational-readiness',
    'submission-context',
  ]);
  for (const route of routes) {
    if (!expectedRoutes.has(route)) {
      throw new EvaluationConsistencyError(
        `Non-canonical evaluation route detected: '${route}'`
      );
    }
  }

  const seenIds = new Set<string>();

  for (const [segment, artifact] of Object.entries(artifacts)) {
    // 3. Artifact ID format
    if (!/^EVD-EVAL-[0-9]{2}-[A-Z0-9-]+$/.test(artifact.artifactId)) {
      throw new EvaluationConsistencyError(
        `Invalid evaluation artifact ID format: '${artifact.artifactId}'`
      );
    }
    if (artifact.evidenceId !== artifact.artifactId) {
      throw new EvaluationConsistencyError(
        `Artifact evidenceId mismatch for '${artifact.artifactId}'`
      );
    }

    // 4. Version equals '1.0.0'
    if (artifact.version !== '1.0.0' || !SEMVER_REGEX.test(artifact.version)) {
      throw new EvaluationConsistencyError(
        `Artifact '${artifact.artifactId}' must have version '1.0.0'`
      );
    }

    // 5. Status equals 'ACTIVE'
    if (artifact.status !== 'ACTIVE') {
      throw new EvaluationConsistencyError(
        `Artifact '${artifact.artifactId}' must have status 'ACTIVE'`
      );
    }

    // 6. Source equals 'evaluation'
    if (artifact.source !== 'evaluation') {
      throw new EvaluationConsistencyError(
        `Artifact '${artifact.artifactId}' must have source 'evaluation'`
      );
    }

    // 7. authority_conferred remains false
    if (artifact.authority_conferred !== false) {
      throw new EvaluationConsistencyError(
        `Artifact '${artifact.artifactId}' must have authority_conferred: false`
      );
    }

    // 8. Artifact IDs are unique
    if (seenIds.has(artifact.artifactId)) {
      throw new EvaluationConsistencyError(
        `Duplicate artifact ID detected: '${artifact.artifactId}'`
      );
    }
    seenIds.add(artifact.artifactId);

    // Correlated evidence validation
    for (const ref of artifact.correlatedEvidence) {
      if (!KNOWN_VALID_EVIDENCE_IDS.has(ref)) {
        throw new EvaluationConsistencyError(
          `Artifact '${artifact.artifactId}' references unknown evidence: '${ref}'`
        );
      }
    }

    // 10. Content recursively contains zero booleans
    assertNoBooleansRecursively(artifact.content, `${segment}.content`);

    // Anti-leakage checks on serialized artifact
    const serialized = JSON.stringify(artifact);

    // 11. No scoring terminology
    if (/\b(score|scores|scoring|percentage|grade)\b/i.test(serialized)) {
      throw new EvaluationConsistencyError(
        `Scoring terminology leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 12. No ranking terminology
    if (/\b(rank|ranking|rankings|priority|tier_rank)\b/i.test(serialized)) {
      throw new EvaluationConsistencyError(
        `Ranking terminology leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 13. No confidence terminology
    if (/\b(confidence|certainty|probability|likelihood)\b/i.test(serialized)) {
      throw new EvaluationConsistencyError(
        `Confidence terminology leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 14. No winner terminology
    if (/\b(winner|winning|champion|best_candidate)\b/i.test(serialized)) {
      throw new EvaluationConsistencyError(
        `Winner terminology leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 15. No answer terminology
    if (/\b(expected_answer|correct_answer|final_answer)\b/i.test(serialized)) {
      throw new EvaluationConsistencyError(
        `Answer terminology leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 16. No solution terminology
    if (/\b(solution_path|final_solution|solve_order)\b/i.test(serialized)) {
      throw new EvaluationConsistencyError(
        `Solution terminology leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 17-19. No partial-match or comparison metadata
    if (
      /\b(matched_fields|failed_fields|correct_components|incorrect_components|partial_match|edit_distance|proximity)\b/i.test(
        serialized
      )
    ) {
      throw new EvaluationConsistencyError(
        `Partial-match metadata leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 20. No internal graph topology metadata
    if (/\b(dag_nodes|adjacency_list|in_degree|topological_order)\b/i.test(serialized)) {
      throw new EvaluationConsistencyError(
        `Internal graph topology leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 21-22. No dependency or prerequisite counts
    if (/\b(prerequisite_count|dependencies_met|total_dependencies)\b/i.test(serialized)) {
      throw new EvaluationConsistencyError(
        `Dependency counts leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 23. No route names for future modules
    if (/\bsim:\/\/(sts|policy|controlplane|vault)\b/i.test(serialized)) {
      throw new EvaluationConsistencyError(
        `Future module route leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 24-26. No challenge roadmap language or prompt references
    if (/\b(prompt\s*15|phase\s*15|stage\s*15|roadmap)\b/i.test(serialized)) {
      throw new EvaluationConsistencyError(
        `Roadmap reference leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 27. No flag patterns
    const envFlag = process.env.ENCLAVE_FLAG || process.env.CHALLENGE_FLAG;
    if (envFlag && serialized.includes(envFlag)) {
      throw new EvaluationConsistencyError(
        `Flag pattern leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 28-33. No credentials, secrets, private keys, API keys, bearer tokens
    if (
      /\b(password|secret_key|private_key|api_key|bearer\s+[a-zA-Z0-9_\-\.]+)\b/i.test(
        serialized
      )
    ) {
      throw new EvaluationConsistencyError(
        `Credential or secret leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 34-36. No real cloud infrastructure or container references
    if (
      /\b(aws|azure|gcp|kubernetes|k8s|docker|ec2|s3|spiffe|spire|svid)\b/i.test(
        serialized
      )
    ) {
      throw new EvaluationConsistencyError(
        `Real cloud or container infrastructure leaked in artifact '${artifact.artifactId}'`
      );
    }

    // 37-40. No evaluator internal identifiers or expected interpretations
    if (
      /\b(INTERNAL_EVALUATOR|EXPECTED_INTERPRETATION|ACCEPTANCE_CONDITION)\b/i.test(
        serialized
      )
    ) {
      throw new EvaluationConsistencyError(
        `Internal evaluator identifier leaked in artifact '${artifact.artifactId}'`
      );
    }
  }
}
