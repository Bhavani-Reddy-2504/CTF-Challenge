import { AppError } from '../../errors/app-error.js';
import type { InferenceArtifact } from '../../evidence/evidence-types.js';

export class InferenceConsistencyError extends AppError {
  constructor(message: string) {
    super({
      code: 'ERR_INFERENCE_CONSISTENCY',
      message,
      statusCode: 500,
      classification: 'INTERNAL_FAULT',
    });
    this.name = 'InferenceConsistencyError';
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
]);

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

/**
 * Recursively inspects an object to ensure no Boolean properties exist.
 */
function assertNoBooleans(obj: unknown, path = 'content'): void {
  if (obj === null || obj === undefined) {
    return;
  }
  if (typeof obj === 'boolean') {
    throw new InferenceConsistencyError(
      `Prohibited boolean oracle discovered at '${path}'. Inference artifacts must not contain boolean fields.`
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
 * of inference artifacts during engine initialization.
 */
export function validateInferenceArtifacts(
  artifacts: Readonly<Record<string, InferenceArtifact>>
): void {
  // 1. Exactly five canonical artifacts
  const keys = Object.keys(artifacts);
  if (keys.length !== 5) {
    throw new InferenceConsistencyError(
      `Expected exactly 5 canonical inference artifacts, found ${keys.length}.`
    );
  }

  const expectedKeys = new Set([
    'specification-model',
    'lineage-model',
    'boundary-model',
    'reconciliation-model',
    'convergence',
  ]);

  for (const key of keys) {
    if (!expectedKeys.has(key)) {
      throw new InferenceConsistencyError(`Unexpected inference artifact key: '${key}'.`);
    }
  }

  const seenIds = new Set<string>();

  for (const [key, artifact] of Object.entries(artifacts)) {
    // 2. Artifact ID format and uniqueness
    if (!artifact.artifactId.startsWith('EVD-INFER-')) {
      throw new InferenceConsistencyError(
        `Artifact '${key}' has invalid identifier format: '${artifact.artifactId}'. Must start with 'EVD-INFER-'.`
      );
    }

    if (seenIds.has(artifact.artifactId)) {
      throw new InferenceConsistencyError(
        `Duplicate inference artifact identifier discovered: '${artifact.artifactId}' in '${key}'.`
      );
    }
    seenIds.add(artifact.artifactId);

    // 3. Semver validation
    if (!SEMVER_REGEX.test(artifact.version)) {
      throw new InferenceConsistencyError(
        `Artifact '${key}' has invalid semver format: '${artifact.version}'.`
      );
    }

    // 4. Status validation
    if (artifact.status !== 'ACTIVE') {
      throw new InferenceConsistencyError(
        `Artifact '${key}' must have status 'ACTIVE', found '${artifact.status}'.`
      );
    }

    // 5. Evidence universe references
    for (const ref of artifact.correlatedEvidence) {
      if (!KNOWN_VALID_EVIDENCE_IDS.has(ref)) {
        throw new InferenceConsistencyError(
          `Artifact '${key}' references unknown evidence ID '${ref}' in correlatedEvidence.`
        );
      }
    }

    // Check relationships in content if present
    const content = artifact.content as Record<string, unknown>;
    if (Array.isArray(content.contextual_relationships)) {
      for (const rel of content.contextual_relationships as Record<string, unknown>[]) {
        const related = rel.related_evidence;
        if (typeof related === 'string' && !KNOWN_VALID_EVIDENCE_IDS.has(related)) {
          throw new InferenceConsistencyError(
            `Artifact '${key}' references unknown evidence ID '${related}' in contextual_relationships.`
          );
        }
      }
    }

    // 6. Zero Boolean Oracles (recursively checked)
    assertNoBooleans(artifact.content, `${key}.content`);

    // 7. Anti-leakage and defensive scanning
    const serialized = JSON.stringify(artifact);

    // Flag check
    const envFlag = process.env.ENCLAVE_FLAG || process.env.CHALLENGE_FLAG;
    if (envFlag && serialized.includes(envFlag)) {
      throw new InferenceConsistencyError(
        `Artifact '${key}' contains prohibited flag material.`
      );
    }

    // Credentials / secrets check
    if (
      /\b(password|secret_key|private_key|api_key|access_token|refresh_token|bearer)\b/i.test(
        serialized
      )
    ) {
      throw new InferenceConsistencyError(
        `Artifact '${key}' contains prohibited credential or secret material.`
      );
    }

    // Real cloud technology check
    if (
      /\b(aws|amazon web services|azure|gcp|google cloud|kubernetes|k8s|docker)\b/i.test(
        serialized
      )
    ) {
      throw new InferenceConsistencyError(
        `Artifact '${key}' contains prohibited real-world cloud technology references.`
      );
    }

    // SPIFFE / SPIRE / SVID check
    if (/\b(spiffe|spire|svid)\b/i.test(serialized)) {
      throw new InferenceConsistencyError(
        `Artifact '${key}' contains prohibited SPIFFE/SPIRE/SVID technology references.`
      );
    }

    // Token / auth terminology check
    if (/\b(jwt|oauth|oidc|saml)\b/i.test(serialized)) {
      throw new InferenceConsistencyError(
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
      throw new InferenceConsistencyError(
        `Artifact '${key}' contains forbidden developer meta-language or instructional phrasing.`
      );
    }

    // Ranking and scoring leakage check
    if (
      /\b(winner|winning_hypothesis|best_hypothesis|likelihood_score|confidence_score|selection_algorithm|model_ranking)\b/i.test(
        serialized
      )
    ) {
      throw new InferenceConsistencyError(
        `Artifact '${key}' contains prohibited scoring, ranking, or winner resolution terminology.`
      );
    }

    // Direct resolution phrasing check
    if (
      /this\s+is\s+correct|this\s+is\s+authoritative|this\s+wins|this\s+overrides|history\s+is\s+wrong|history\s+loses|legacy\s+is\s+obsolete/i.test(
        serialized
      )
    ) {
      throw new InferenceConsistencyError(
        `Artifact '${key}' contains prohibited direct resolution phrasing.`
      );
    }

    // Future module leakage check
    if (/prompt\s*11|phase\s*11|future\s+module|next\s+module/i.test(serialized)) {
      throw new InferenceConsistencyError(
        `Artifact '${key}' contains prohibited forward-looking roadmap references.`
      );
    }
  }
}
