import { KNOWN_VALID_REFERENCES } from '../config/config-validator.js';
import {
  CANONICAL_TRANSITION_STATES,
  TransitionArtifact,
  TransitionState,
} from './transition-types.js';

export class TransitionConsistencyError extends Error {
  constructor(message: string) {
    super(`Transition Consistency Error: ${message}`);
    this.name = 'TransitionConsistencyError';
  }
}

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

/**
 * Closed set of known valid evidence IDs across Metadata, Audit, Config, Identity, and Trust modules.
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
  'EVD-TRUST-01-CONTEXT',
  'EVD-TRUST-02-BINDING',
  'EVD-TRUST-03-LINEAGE',
  'EVD-TRUST-04-MEMBERSHIP',
  'EVD-TRUST-05-INTERPRETATION',
]);

const VALID_TRANSITION_CLASSIFICATIONS: ReadonlySet<string> = new Set<string>([
  'OBSERVATION_TRANSITION',
  'CORRELATION_TRANSITION',
  'RECONCILIATION_TRANSITION',
]);

const STATE_PROGRESSION_ORDER: ReadonlyMap<TransitionState, number> = new Map<TransitionState, number>([
  ['UNINITIALIZED', 0],
  ['OBSERVED', 1],
  ['CORRELATED', 2],
  ['RECONCILED', 3],
]);

/**
 * Validates the internal consistency, integrity, progression graph,
 * and safety constraints of transition artifacts during trusted engine bootstrap.
 */
export function validateTransitionArtifacts(
  artifacts: Readonly<Record<string, TransitionArtifact>>
): void {
  const seenIds = new Set<string>();
  const seenTransitions = new Set<string>();

  for (const [key, artifact] of Object.entries(artifacts)) {
    // 1. Artifact ID format and uniqueness
    if (!artifact.artifactId.startsWith('EVD-TRANS-')) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' has invalid identifier format: '${artifact.artifactId}'. Must start with 'EVD-TRANS-'.`
      );
    }

    if (seenIds.has(artifact.artifactId)) {
      throw new TransitionConsistencyError(
        `Duplicate transition artifact identifier discovered: '${artifact.artifactId}' in '${key}'.`
      );
    }
    seenIds.add(artifact.artifactId);

    // 2. Semver validation
    if (!SEMVER_REGEX.test(artifact.version)) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' has invalid semver format: '${artifact.version}'.`
      );
    }

    // 3. Classification validation
    if (!VALID_TRANSITION_CLASSIFICATIONS.has(artifact.classification)) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' has invalid classification: '${artifact.classification}'.`
      );
    }

    // 4. Valid state definitions
    if (
      !CANONICAL_TRANSITION_STATES.includes(artifact.fromState) ||
      !CANONICAL_TRANSITION_STATES.includes(artifact.toState)
    ) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' contains non-canonical state: from='${artifact.fromState}', to='${artifact.toState}'.`
      );
    }

    // 5. Directed progression validation (no loops, no backward transitions, linear DAG step)
    const fromIndex = STATE_PROGRESSION_ORDER.get(artifact.fromState);
    const toIndex = STATE_PROGRESSION_ORDER.get(artifact.toState);

    if (fromIndex === undefined || toIndex === undefined) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' references unrecognized state order mapping.`
      );
    }

    if (fromIndex === toIndex) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' defines a self-loop transition on state '${artifact.fromState}'. Loops are forbidden.`
      );
    }

    if (toIndex <= fromIndex) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' defines a backward or non-advancing transition: ${artifact.fromState} -> ${artifact.toState}. Backward transitions are forbidden.`
      );
    }

    if (toIndex !== fromIndex + 1) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' defines a state jump: ${artifact.fromState} -> ${artifact.toState}. State progression must be contiguous.`
      );
    }

    // 6. Duplicate transition check
    const transitionKey = `${artifact.fromState}->${artifact.toState}`;
    if (seenTransitions.has(transitionKey)) {
      throw new TransitionConsistencyError(
        `Duplicate state transition mapping detected: '${transitionKey}' in '${key}'.`
      );
    }
    seenTransitions.add(transitionKey);

    // 7. Authority neutrality enforcement (Transition != Authority)
    const content = artifact.content as Record<string, unknown>;
    if (content.authority_conferred !== false) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' must explicitly define authority_conferred as false.`
      );
    }

    // 8. Supporting evidence validation
    if (!artifact.supportingEvidence || artifact.supportingEvidence.length === 0) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' must declare at least one supporting evidence reference.`
      );
    }

    for (const evId of artifact.supportingEvidence) {
      if (!KNOWN_VALID_EVIDENCE_IDS.has(evId)) {
        throw new TransitionConsistencyError(
          `Artifact '${key}' references unknown or invalid supporting evidence ID: '${evId}'.`
        );
      }
    }

    // 9. Correlation reference integrity
    for (const ref of artifact.correlationReferences) {
      if (!KNOWN_VALID_REFERENCES.has(ref)) {
        throw new TransitionConsistencyError(
          `Artifact '${key}' references unknown or dangling correlation reference: '${ref}'.`
        );
      }
    }

    // 10. Security and secrets scanning
    const serialized = JSON.stringify(artifact);
    if (serialized.includes('AKIA') || serialized.includes('BEGIN PRIVATE KEY')) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' contains forbidden secret-like material.`
      );
    }

    const envFlag = process.env.ENCLAVE_FLAG || process.env.CHALLENGE_FLAG;
    if (envFlag && serialized.includes(envFlag)) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' contains forbidden flag material.`
      );
    }

    // 11. Identity technology leakage check (no SPIFFE, SPIRE, SVID)
    if (/\b(spiffe|spire|svid)\b|spiffe:\/\//i.test(serialized)) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' contains prohibited real-world identity technology reference.`
      );
    }

    // 12. Execution-denial / authorization vocabulary check
    if (
      /REVOKED_FOR_EXECUTION|DENIED_FOR_EXECUTION|NOT_AUTHORIZED|EXECUTION_BLOCKED|ACCESS_DENIED|PERMISSION_REVOKED/i.test(
        serialized
      )
    ) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' contains prohibited execution-oriented or authorization denial semantics.`
      );
    }

    // 13. Token & authentication terminology check
    if (/\b(jwt|bearer|oauth|oidc|saml|access_token|refresh_token)\b/i.test(serialized)) {
      throw new TransitionConsistencyError(
        `Artifact '${key}' contains prohibited token or authentication terminology.`
      );
    }

    // 14. Challenge meta-language and instructional phrasing check
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
      throw new TransitionConsistencyError(
        `Artifact '${key}' contains forbidden developer meta-language or instructional leak phrasing.`
      );
    }
  }
}
