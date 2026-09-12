import { KNOWN_VALID_REFERENCES } from '../config/config-validator.js';
import type { ConstraintArtifact, ContradictionDimension } from './constraint-types.js';

export class ConstraintConsistencyError extends Error {
  constructor(message: string) {
    super(`Constraint Consistency Error: ${message}`);
    this.name = 'ConstraintConsistencyError';
  }
}

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

/**
 * Closed set of known valid evidence IDs across Metadata, Audit, Config, Identity, Trust,
 * Transition, and Constraint modules.
 */
export const KNOWN_VALID_EVIDENCE_IDS: ReadonlySet<string> = new Set<string>([
  // Metadata
  'EVD-META-01-PROFILE',
  'EVD-META-02-CONTEXT',
  'EVD-META-03-BOUNDARY',
  'EVD-META-04-COMPAT',
  // Audit
  'EVD-AUD-01-BOOTSTRAP',
  'EVD-AUD-02-TRUST',
  'EVD-AUD-03-FAILS',
  'EVD-AUD-04-CORR',
  // Config
  'EVD-CFG-01-ACTIVE-SPEC',
  'EVD-CFG-02-BINDING',
  'EVD-CFG-03-FED-MATRIX',
  'EVD-CFG-04-COMPAT',
  'EVD-CFG-05-INTEGRITY',
  // Identity
  'EVD-IDN-01-CONTEXT',
  'EVD-IDN-02-BINDING',
  'EVD-IDN-03-TRUST-MEMBERSHIP',
  'EVD-IDN-04-LINEAGE',
  'EVD-IDN-05-COMPAT',
  // Trust
  'EVD-TRUST-01-CONTEXT',
  'EVD-TRUST-02-BINDING',
  'EVD-TRUST-03-LINEAGE',
  'EVD-TRUST-04-MEMBERSHIP',
  'EVD-TRUST-05-INTERPRETATION',
  // Transition
  'EVD-TRANS-01-OBSERVATION',
  'EVD-TRANS-02-CORRELATION',
  'EVD-TRANS-03-RECONCILIATION',
  // Constraint
  'EVD-CONSTRAINT-01-SPECIFICATION',
  'EVD-CONSTRAINT-02-CONTINUITY',
  'EVD-CONSTRAINT-03-BOUNDARY',
  'EVD-CONSTRAINT-04-RECONCILIATION',
]);

const VALID_CONSTRAINT_CLASSIFICATIONS: ReadonlySet<string> = new Set<string>([
  'SPECIFICATION_CONSTRAINT',
  'CONTINUITY_CONSTRAINT',
  'BOUNDARY_CONSTRAINT',
  'RECONCILIATION_CONSTRAINT',
]);

export const CONTRADICTION_MATRIX: readonly ContradictionDimension[] = Object.freeze([
  Object.freeze({
    dimension: 'MAINTAINED_SPECIFICATION',
    interpretationRole: 'STRUCTURAL_DEFINITION',
    governingPrinciple: 'Maintained execution profile defines runtime structural baseline.',
    primaryEvidence: Object.freeze([
      'EVD-CFG-01-ACTIVE-SPEC',
      'EVD-IDN-01-CONTEXT',
      'EVD-CFG-05-INTEGRITY',
    ]),
    apparentConflict:
      'Predecessor collector-v1 is declared in audit history while collector-v2 is declared in active spec.',
    resolutionRationale:
      'Historical records preserve lineage succession; active specification governs runtime structure without mutual contradiction.',
  }),
  Object.freeze({
    dimension: 'HISTORICAL_CONTINUITY',
    interpretationRole: 'LINEAGE_PRESERVATION',
    governingPrinciple:
      'Historical records and compatibility definitions preserve succession traceability.',
    primaryEvidence: Object.freeze([
      'EVD-IDN-04-LINEAGE',
      'EVD-CFG-04-COMPAT',
      'EVD-AUD-03-FAILS',
      'EVD-TRUST-03-LINEAGE',
    ]),
    apparentConflict:
      'Failed transition recorded under REF-CORR-99201-B appears alongside valid active correlation.',
    resolutionRationale:
      'Historical transition failures reflect past transition attempts; the correlation reference remains valid as an anchor of continuity.',
  }),
  Object.freeze({
    dimension: 'PERIMETER_BOUNDARY',
    interpretationRole: 'ENVIRONMENTAL_ASSOCIATION',
    governingPrinciple:
      'Perimeter containment delimits operational boundaries without establishing identity equivalence.',
    primaryEvidence: Object.freeze([
      'EVD-IDN-03-TRUST-MEMBERSHIP',
      'EVD-META-02-CONTEXT',
      'EVD-CFG-02-BINDING',
      'EVD-TRUST-04-MEMBERSHIP',
    ]),
    apparentConflict:
      'Multiple distinct principals share trust-zone-alpha perimeter membership.',
    resolutionRationale:
      'Perimeter association indicates co-location within a common boundary, not identity equivalence or structural isomorphism.',
  }),
  Object.freeze({
    dimension: 'RECONCILIATION_INVARIANT',
    interpretationRole: 'SYNTHESIZED_INTERPRETATION',
    governingPrinciple:
      'Joint interpretation synthesizes structural, continuity, and perimeter dimensions.',
    primaryEvidence: Object.freeze([
      'EVD-TRUST-05-INTERPRETATION',
      'EVD-TRANS-03-RECONCILIATION',
    ]),
    apparentConflict:
      'Multiple disparate evidence dimensions appear to offer conflicting primary attributes.',
    resolutionRationale:
      'Each evidence record describes a distinct dimension; structural definition, lineage continuity, and boundary association are non-overlapping.',
  }),
]);

/**
 * Validates the internal consistency, integrity, contradiction matrix,
 * and safety constraints of constraint artifacts during trusted engine bootstrap.
 */
export function validateConstraintArtifacts(
  artifacts: Readonly<Record<string, ConstraintArtifact>>
): void {
  // 1. Exactly four canonical artifacts
  const keys = Object.keys(artifacts);
  if (keys.length !== 4) {
    throw new ConstraintConsistencyError(
      `Expected exactly 4 canonical constraint artifacts, found ${keys.length}.`
    );
  }

  const seenIds = new Set<string>();

  for (const [key, artifact] of Object.entries(artifacts)) {
    // 2. Artifact ID format and uniqueness
    if (!artifact.artifactId.startsWith('EVD-CONSTRAINT-')) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' has invalid identifier format: '${artifact.artifactId}'. Must start with 'EVD-CONSTRAINT-'.`
      );
    }

    if (seenIds.has(artifact.artifactId)) {
      throw new ConstraintConsistencyError(
        `Duplicate constraint artifact identifier discovered: '${artifact.artifactId}' in '${key}'.`
      );
    }
    seenIds.add(artifact.artifactId);

    // 3. Semver validation
    if (!SEMVER_REGEX.test(artifact.version)) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' has invalid semver format: '${artifact.version}'.`
      );
    }

    // 4. Status validation
    if (artifact.status !== 'ACTIVE') {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' has invalid status: '${artifact.status}'. Must be 'ACTIVE'.`
      );
    }

    // 5. Classification validation
    if (!VALID_CONSTRAINT_CLASSIFICATIONS.has(artifact.classification)) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' has invalid classification: '${artifact.classification}'.`
      );
    }

    // 6. Assertions validation
    if (!artifact.assertions || artifact.assertions.length === 0) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' must declare at least one assertion.`
      );
    }

    // 7. Relationships validation
    if (!artifact.relationships || artifact.relationships.length === 0) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' must declare at least one relationship.`
      );
    }

    for (const rel of artifact.relationships) {
      const relEvidence = (rel as Record<string, unknown>).related_evidence;
      if (typeof relEvidence !== 'string' || !KNOWN_VALID_EVIDENCE_IDS.has(relEvidence)) {
        throw new ConstraintConsistencyError(
          `Artifact '${key}' references unknown or invalid relationship evidence: '${String(
            relEvidence
          )}'.`
        );
      }
    }

    // 8. Correlation reference integrity
    for (const ref of artifact.correlationReferences) {
      if (!KNOWN_VALID_REFERENCES.has(ref)) {
        throw new ConstraintConsistencyError(
          `Artifact '${key}' references unknown or dangling correlation reference: '${ref}'.`
        );
      }
    }

    // 9. Security and secrets scanning
    const serialized = JSON.stringify(artifact);
    if (serialized.includes('AKIA') || serialized.includes('BEGIN PRIVATE KEY')) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' contains forbidden secret-like material.`
      );
    }

    const envFlag = process.env.ENCLAVE_FLAG || process.env.CHALLENGE_FLAG;
    if (
      (envFlag && serialized.includes(envFlag)) ||
      /[A-Za-z0-9_-]{3,8}\{[^}\r\n]{4,}\}/.test(serialized)
    ) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' contains forbidden flag material.`
      );
    }

    // 10. Real cloud technology leakage check
    if (/\b(aws|azure|gcp|kubernetes|docker|k8s)\b/i.test(serialized)) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' contains prohibited real-world cloud technology reference.`
      );
    }

    // 11. Identity technology leakage check (no SPIFFE, SPIRE, SVID)
    if (/\b(spiffe|spire|svid)\b|spiffe:\/\//i.test(serialized)) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' contains prohibited real-world identity technology reference.`
      );
    }

    // 12. Execution denial / authorization vocabulary check
    if (
      /REVOKED_FOR_EXECUTION|DENIED_FOR_EXECUTION|NOT_AUTHORIZED|EXECUTION_BLOCKED|ACCESS_DENIED|PERMISSION_REVOKED/i.test(
        serialized
      )
    ) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' contains prohibited execution-oriented or authorization denial semantics.`
      );
    }

    // 13. Token & authentication terminology check
    if (/\b(jwt|oauth|oidc|saml|access_token|refresh_token)\b/i.test(serialized)) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' contains prohibited token or authentication terminology.`
      );
    }

    // 14. Challenge meta-language check
    if (
      /prompt\s*\d+/i.test(serialized) ||
      /phase\s*\d+/i.test(serialized) ||
      /subsequent\s+phase/i.test(serialized) ||
      /next\s+stage/i.test(serialized) ||
      /you\s+will\s+need/i.test(serialized) ||
      /this\s+unlocks/i.test(serialized)
    ) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' contains forbidden developer meta-language or instructional phrasing.`
      );
    }

    // 15. Binary oracle check: no boolean fields in artifact content
    for (const [prop, val] of Object.entries(artifact.content as Record<string, unknown>)) {
      if (typeof val === 'boolean') {
        throw new ConstraintConsistencyError(
          `Artifact '${key}' contains prohibited boolean oracle property: '${prop}'.`
        );
      }
    }

    // 16. Internal ranking and weight leakage check
    const contentStr = JSON.stringify(artifact.content);
    if (
      /interpretation_weight|precedence_rank|resolution_order|structural_equivalence|precedence_hierarchy/i.test(
        contentStr
      )
    ) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' contains prohibited internal ranking or weight field.`
      );
    }

    // 17. Direct resolution language check
    if (
      /active\s+always\s+wins|highest\s+version\s+wins|specification\s+always\s+wins|without\s+replacing\s+the\s+active|rather\s+than\s+ongoing\s+structural|without\s+establishing\s+structural\s+equivalence|governing\s+primacy\s+of\s+the\s+maintained/i.test(
        serialized
      )
    ) {
      throw new ConstraintConsistencyError(
        `Artifact '${key}' contains forbidden direct resolution phrasing.`
      );
    }
  }

  // 18. Contradiction Matrix Validation
  validateContradictionMatrix(CONTRADICTION_MATRIX);

  // 19. Circular interpretation check: ensure no circularity
  const relMap = new Map<string, Set<string>>();
  for (const art of Object.values(artifacts)) {
    const deps = new Set<string>();
    for (const r of art.relationships) {
      const relId = (r as Record<string, unknown>).related_evidence as string;
      if (relId.startsWith('EVD-CONSTRAINT-')) {
        deps.add(relId);
      }
    }
    relMap.set(art.artifactId, deps);
  }

  for (const [artId, deps] of relMap.entries()) {
    for (const depId of deps) {
      const reverseDeps = relMap.get(depId);
      if (reverseDeps && reverseDeps.has(artId)) {
        throw new ConstraintConsistencyError(
          `Circular constraint dependency detected between '${artId}' and '${depId}'.`
        );
      }
    }
  }
}

/**
 * Validates that the internal contradiction matrix is completely populated,
 * references known valid evidence, and establishes no true logical contradictions.
 */
export function validateContradictionMatrix(
  matrix: readonly ContradictionDimension[]
): void {
  if (matrix.length === 0) {
    throw new ConstraintConsistencyError('Contradiction matrix must not be empty.');
  }

  for (const entry of matrix) {
    if (!entry.dimension || !entry.interpretationRole || !entry.governingPrinciple) {
      throw new ConstraintConsistencyError(
        'Contradiction matrix entry is missing required fields.'
      );
    }

    for (const evId of entry.primaryEvidence) {
      if (!KNOWN_VALID_EVIDENCE_IDS.has(evId)) {
        throw new ConstraintConsistencyError(
          `Contradiction matrix entry for '${entry.dimension}' references unknown evidence '${evId}'.`
        );
      }
    }

    if (!entry.apparentConflict || !entry.resolutionRationale) {
      throw new ConstraintConsistencyError(
        `Contradiction matrix entry for '${entry.dimension}' must define both apparent conflict and resolution rationale.`
      );
    }
  }
}
