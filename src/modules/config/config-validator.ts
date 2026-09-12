import { ConfigurationArtifact } from '../../evidence/evidence-types.js';

export class ConfigurationConsistencyError extends Error {
  constructor(message: string) {
    super(`Configuration Consistency Error: ${message}`);
    this.name = 'ConfigurationConsistencyError';
  }
}

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

/**
 * Closed set of known valid symbolic references across metadata, audit, and config modules.
 * Prevents dangling correlation references or inconsistent entity identifiers.
 */
export const KNOWN_VALID_REFERENCES: ReadonlySet<string> = new Set<string>([
  'edge-telemetry-enclave',
  'wrk-hyperion-telemetry-edge',
  'spec-fed-boundary-stage',
  'enclave-integrity-anchor-889f',
  'trust-zone-alpha',
  'strata://federation.stage-build.internal',
  'trust-stage-build',
  'arn:strata:iam::1337:role/DeploymentBridgeAuthority',
  'REF-CORR-99201-A',
  'REF-CORR-99201-B',
  'hyperion://identity/telemetry/collector-v1',
  'hyperion://identity/telemetry/collector-v2',
  'aud-stream-rollout-99',
  'policy:release-governance-boundary',
]);

/**
 * Validates the internal consistency and safety of configuration artifacts
 * during trusted initialization before registries lock.
 */
export function validateConfigurationArtifacts(
  artifacts: Readonly<Record<string, ConfigurationArtifact>>
): void {
  const seenIds = new Set<string>();
  let activeSpecCount = 0;

  for (const [key, artifact] of Object.entries(artifacts)) {
    // 1. Artifact ID format and uniqueness
    if (!artifact.artifactId.startsWith('EVD-CFG-')) {
      throw new ConfigurationConsistencyError(
        `Artifact '${key}' has invalid identifier format: '${artifact.artifactId}'. Must start with 'EVD-CFG-'.`
      );
    }

    if (seenIds.has(artifact.artifactId)) {
      throw new ConfigurationConsistencyError(
        `Duplicate artifact identifier discovered: '${artifact.artifactId}' in '${key}'.`
      );
    }
    seenIds.add(artifact.artifactId);

    // 2. Version validation
    if (!SEMVER_REGEX.test(artifact.version)) {
      throw new ConfigurationConsistencyError(
        `Artifact '${key}' has invalid semver format: '${artifact.version}'.`
      );
    }

    // 3. Status validation
    if (!['ACTIVE', 'COMPATIBILITY', 'DEPRECATED'].includes(artifact.status)) {
      throw new ConfigurationConsistencyError(
        `Artifact '${key}' has invalid status: '${artifact.status}'.`
      );
    }

    // 4. Active specification check
    if (artifact.classification === 'CONFIGURATION_SPECIFICATION') {
      if (artifact.status === 'ACTIVE') {
        activeSpecCount++;
      }
    }

    // 5. Historical compatibility consistency
    if (artifact.status === 'COMPATIBILITY') {
      const content = artifact.content as Record<string, unknown>;
      if (content.active_specification_supersedes !== true) {
        throw new ConfigurationConsistencyError(
          `Compatibility artifact '${key}' must explicitly declare that active specification supersedes it.`
        );
      }
    }

    // 6. Correlation reference integrity (no dangling references)
    for (const ref of artifact.correlationReferences) {
      if (!KNOWN_VALID_REFERENCES.has(ref)) {
        throw new ConfigurationConsistencyError(
          `Artifact '${key}' references unknown or dangling correlation reference: '${ref}'.`
        );
      }
    }

    // 7. Security and secrets scanning
    const serialized = JSON.stringify(artifact);
    if (serialized.includes('AKIA') || serialized.includes('BEGIN PRIVATE KEY')) {
      throw new ConfigurationConsistencyError(
        `Artifact '${key}' contains forbidden secret-like material.`
      );
    }

    const envFlag = process.env.ENCLAVE_FLAG || process.env.CHALLENGE_FLAG;
    if (envFlag && serialized.includes(envFlag)) {
      throw new ConfigurationConsistencyError(
        `Artifact '${key}' contains forbidden flag material.`
      );
    }
  }

  if (activeSpecCount === 0) {
    throw new ConfigurationConsistencyError('At least one ACTIVE configuration specification must exist.');
  }
}
