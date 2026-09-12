import { KNOWN_VALID_REFERENCES } from '../config/config-validator.js';
import type { TrustResolutionArtifact } from './trust-types.js';

export class TrustConsistencyError extends Error {
  constructor(message: string) {
    super(`Trust Consistency Error: ${message}`);
    this.name = 'TrustConsistencyError';
  }
}

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

/**
 * Closed set of known valid evidence IDs across Metadata, Audit, Config, and Identity modules.
 */
export const KNOWN_VALID_EVIDENCE_IDS: ReadonlySet<string> = new Set<string>([
  'EVD-META-01-PROFILE',
  'EVD-META-02-CONTEXT',
  'EVD-META-03-BOUNDARY',
  'EVD-META-04-COMPAT',
  'EVD-AUD-01-BOOTSTRAP',
  'EVD-AUD-02-TRUST',
  'EVD-AUD-03-FAILS',
  'EVD-AUD-04-CORR',
  'EVD-CFG-01-ACTIVE-SPEC',
  'EVD-CFG-02-BINDING',
  'EVD-CFG-03-FED-MATRIX',
  'EVD-CFG-04-COMPAT',
  'EVD-CFG-05-INTEGRITY',
  'EVD-IDN-01-CONTEXT',
  'EVD-IDN-02-BINDING',
  'EVD-IDN-03-TRUST-MEMBERSHIP',
  'EVD-IDN-04-LINEAGE',
  'EVD-IDN-05-COMPAT',
]);

const VALID_TRUST_CLASSIFICATIONS: ReadonlySet<string> = new Set<string>([
  'TRUST_COHERENCE_RESOLUTION',
  'BINDING_COHERENCE_RESOLUTION',
  'LINEAGE_COHERENCE_RESOLUTION',
  'TRUST_CONTEXT_RESOLUTION',
  'EFFECTIVE_INTERPRETATION_RESOLUTION',
]);

/**
 * Validates the internal consistency, integrity, and safety of trust resolution artifacts
 * during trusted engine bootstrap before registries are locked.
 */
export function validateTrustArtifacts(
  artifacts: Readonly<Record<string, TrustResolutionArtifact>>
): void {
  const seenIds = new Set<string>();
  let activeResolutionCount = 0;

  for (const [key, artifact] of Object.entries(artifacts)) {
    // 1. Artifact ID format and uniqueness
    if (!artifact.artifactId.startsWith('EVD-TRUST-')) {
      throw new TrustConsistencyError(
        `Artifact '${key}' has invalid identifier format: '${artifact.artifactId}'. Must start with 'EVD-TRUST-'.`
      );
    }

    if (seenIds.has(artifact.artifactId)) {
      throw new TrustConsistencyError(
        `Duplicate artifact identifier discovered: '${artifact.artifactId}' in '${key}'.`
      );
    }
    seenIds.add(artifact.artifactId);

    // 2. Semver validation
    if (!SEMVER_REGEX.test(artifact.version)) {
      throw new TrustConsistencyError(
        `Artifact '${key}' has invalid semver format: '${artifact.version}'.`
      );
    }

    // 3. Status validation
    if (!['ACTIVE', 'COMPATIBILITY', 'DEPRECATED'].includes(artifact.status)) {
      throw new TrustConsistencyError(
        `Artifact '${key}' has invalid status: '${artifact.status}'.`
      );
    }

    // 4. Classification validation
    if (!VALID_TRUST_CLASSIFICATIONS.has(artifact.classification)) {
      throw new TrustConsistencyError(
        `Artifact '${key}' has invalid trust classification: '${artifact.classification}'.`
      );
    }

    if (artifact.status === 'ACTIVE') {
      activeResolutionCount++;
    }

    // 5. Authority neutrality enforcement (Trust Resolution != Authority)
    const content = artifact.content as Record<string, unknown>;
    if (content.authority_conferred !== false) {
      throw new TrustConsistencyError(
        `Artifact '${key}' must explicitly define authority_conferred as false.`
      );
    }

    // 6. Supporting evidence and prerequisite validation
    if (!artifact.supportingEvidence || artifact.supportingEvidence.length === 0) {
      throw new TrustConsistencyError(
        `Artifact '${key}' must declare at least one supporting evidence reference.`
      );
    }

    for (const evId of artifact.supportingEvidence) {
      if (!KNOWN_VALID_EVIDENCE_IDS.has(evId)) {
        throw new TrustConsistencyError(
          `Artifact '${key}' references unknown or invalid supporting evidence ID: '${evId}'.`
        );
      }
    }

    if (!artifact.requiredPrerequisites || artifact.requiredPrerequisites.length === 0) {
      throw new TrustConsistencyError(
        `Artifact '${key}' must declare at least one prerequisite evidence requirement.`
      );
    }

    for (const prereqId of artifact.requiredPrerequisites) {
      if (!KNOWN_VALID_EVIDENCE_IDS.has(prereqId)) {
        throw new TrustConsistencyError(
          `Artifact '${key}' references unknown or invalid prerequisite evidence ID: '${prereqId}'.`
        );
      }
    }

    // 7. Correlation reference integrity
    for (const ref of artifact.correlationReferences) {
      if (!KNOWN_VALID_REFERENCES.has(ref)) {
        throw new TrustConsistencyError(
          `Artifact '${key}' references unknown or dangling correlation reference: '${ref}'.`
        );
      }
    }

    // 8. Security and secrets scanning
    const serialized = JSON.stringify(artifact);
    if (serialized.includes('AKIA') || serialized.includes('BEGIN PRIVATE KEY')) {
      throw new TrustConsistencyError(
        `Artifact '${key}' contains forbidden secret-like material.`
      );
    }

    const envFlag = process.env.ENCLAVE_FLAG || process.env.CHALLENGE_FLAG;
    if (envFlag && serialized.includes(envFlag)) {
      throw new TrustConsistencyError(
        `Artifact '${key}' contains forbidden flag material.`
      );
    }

    // 9. Identity technology leakage check (no SPIFFE, SPIRE, SVID)
    if (/\b(spiffe|spire|svid)\b|spiffe:\/\//i.test(serialized)) {
      throw new TrustConsistencyError(
        `Artifact '${key}' contains prohibited real-world identity technology reference.`
      );
    }

    // 10. Execution-denial / authorization vocabulary check
    if (
      /REVOKED_FOR_EXECUTION|DENIED_FOR_EXECUTION|NOT_AUTHORIZED|EXECUTION_BLOCKED|ACCESS_DENIED|PERMISSION_REVOKED/i.test(
        serialized
      )
    ) {
      throw new TrustConsistencyError(
        `Artifact '${key}' contains prohibited execution-oriented or authorization denial semantics.`
      );
    }

    // 11. Challenge meta-language and instructional phrasing check
    if (
      /prompt\s*\d+/i.test(serialized) ||
      /phase\s*\d+/i.test(serialized) ||
      /subsequent\s+phase/i.test(serialized) ||
      /next\s+stage/i.test(serialized) ||
      /you\s+will\s+need/i.test(serialized) ||
      /obtainable\s+via/i.test(serialized) ||
      /now\s+proceed/i.test(serialized) ||
      /this\s+unlocks/i.test(serialized)
    ) {
      throw new TrustConsistencyError(
        `Artifact '${key}' contains forbidden developer meta-language or instructional leak phrasing.`
      );
    }
  }

  if (activeResolutionCount === 0) {
    throw new TrustConsistencyError('At least one ACTIVE trust resolution must exist.');
  }
}
