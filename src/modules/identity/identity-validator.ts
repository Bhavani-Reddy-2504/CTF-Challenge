import { IdentityArtifact } from '../../evidence/evidence-types.js';
import { KNOWN_VALID_REFERENCES } from '../config/config-validator.js';

export class IdentityConsistencyError extends Error {
  constructor(message: string) {
    super(`Identity Consistency Error: ${message}`);
    this.name = 'IdentityConsistencyError';
  }
}

/**
 * Validates the internal consistency and safety of identity artifacts
 * during trusted initialization before registries lock.
 */
export function validateIdentityArtifacts(
  artifacts: Readonly<Record<string, IdentityArtifact>>
): void {
  const seenIds = new Set<string>();
  let activeContextCount = 0;

  for (const [key, artifact] of Object.entries(artifacts)) {
    // 1. Artifact ID format and uniqueness
    if (!artifact.artifactId.startsWith('EVD-IDN-')) {
      throw new IdentityConsistencyError(
        `Artifact '${key}' has invalid identifier format: '${artifact.artifactId}'. Must start with 'EVD-IDN-'.`
      );
    }

    if (seenIds.has(artifact.artifactId)) {
      throw new IdentityConsistencyError(
        `Duplicate artifact identifier discovered: '${artifact.artifactId}' in '${key}'.`
      );
    }
    seenIds.add(artifact.artifactId);

    // 2. Status validation
    if (!['ACTIVE', 'COMPATIBILITY', 'DEPRECATED'].includes(artifact.status)) {
      throw new IdentityConsistencyError(
        `Artifact '${key}' has invalid status: '${artifact.status}'.`
      );
    }

    // 3. Active context tracking
    if (artifact.classification === 'IDENTITY_CONTEXT' && artifact.status === 'ACTIVE') {
      activeContextCount++;
    }

    // 4. Compatibility consistency
    if (artifact.status === 'COMPATIBILITY') {
      const content = artifact.content as Record<string, unknown>;
      if (content.active_specification_precedence !== true) {
        throw new IdentityConsistencyError(
          `Compatibility identity artifact '${key}' must explicitly declare active specification precedence.`
        );
      }
    }

    // 5. Correlation reference integrity (no dangling references)
    for (const ref of artifact.correlationReferences) {
      if (!KNOWN_VALID_REFERENCES.has(ref)) {
        throw new IdentityConsistencyError(
          `Artifact '${key}' references unknown or dangling correlation reference: '${ref}'.`
        );
      }
    }

    // 6. Security and secrets scanning
    const serialized = JSON.stringify(artifact);
    if (serialized.includes('AKIA') || serialized.includes('BEGIN PRIVATE KEY')) {
      throw new IdentityConsistencyError(
        `Artifact '${key}' contains forbidden secret-like material.`
      );
    }

    const envFlag = process.env.ENCLAVE_FLAG || process.env.CHALLENGE_FLAG;
    if (envFlag && serialized.includes(envFlag)) {
      throw new IdentityConsistencyError(
        `Artifact '${key}' contains forbidden flag material.`
      );
    }

    // 7. Information leakage checks
    if (
      /prompt\s*\d+/i.test(serialized) ||
      /phase\s*\d+/i.test(serialized) ||
      /subsequent\s+phase/i.test(serialized) ||
      /next\s+stage/i.test(serialized) ||
      /you\s+will\s+need/i.test(serialized) ||
      /obtainable\s+via/i.test(serialized)
    ) {
      throw new IdentityConsistencyError(
        `Artifact '${key}' contains forbidden developer meta-language or instructional leak phrasing.`
      );
    }

    // 8. Identity technology leakage checks (no SPIFFE, SPIRE, SVID)
    if (/\b(spiffe|spire|svid)\b|spiffe:\/\//i.test(serialized)) {
      throw new IdentityConsistencyError(
        `Artifact '${key}' contains prohibited real-world identity technology reference.`
      );
    }

    // 9. Execution-oriented semantic checks (identity != authorization)
    if (
      /REVOKED_FOR_EXECUTION|DENIED_FOR_EXECUTION|NOT_AUTHORIZED|EXECUTION_BLOCKED|ACCESS_DENIED|PERMISSION_REVOKED/i.test(
        serialized
      )
    ) {
      throw new IdentityConsistencyError(
        `Artifact '${key}' contains prohibited execution-oriented or authorization denial semantics.`
      );
    }
  }

  if (activeContextCount === 0) {
    throw new IdentityConsistencyError('At least one ACTIVE identity context must exist.');
  }
}
