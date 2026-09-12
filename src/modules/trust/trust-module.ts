import { IChallengeModule, ModuleId } from '../../engine/module-contract.js';
import { formatEvidenceResponse } from '../../evidence/evidence-types.js';
import { SimHandlerContext } from '../../router/sim-handler.js';
import { parseSimRoute } from '../../router/sim-parser.js';
import { SimRouteRegistry } from '../../router/sim-registry.js';
import { AuditSessionState } from '../audit/audit-module.js';
import { ConfigSessionState } from '../config/config-module.js';
import { IdentitySessionState } from '../identity/identity-module.js';
import { MetadataSessionState } from '../metadata/metadata-module.js';
import { TRUST_ARTIFACTS } from './trust-artifacts.js';
import { InsufficientEvidenceError, TrustSessionState } from './trust-types.js';
import { validateTrustArtifacts } from './trust-validator.js';

/**
 * TrustModule implements the deterministic Trust Resolution & Evidence Correlation Engine.
 * Correlates already-discovered evidence across Metadata, Audit, Config, and Identity
 * modules to evaluate context coherence, binding consistency, lineage continuity,
 * perimeter boundaries, and active specification precedence.
 *
 * Enforces server-side discovery gating: players cannot retrieve a derived resolution
 * until supporting prerequisite evidence has been discovered in their session.
 */
export class TrustModule implements IChallengeModule {
  public readonly id: ModuleId = 'trust';
  public readonly version = '1.0.0';
  public readonly requiredDependencies: readonly ModuleId[] = Object.freeze([
    'metadata',
    'audit',
    'config',
    'identity',
  ]);
  private readonly routeRegistry: SimRouteRegistry;

  constructor(routeRegistry: SimRouteRegistry) {
    this.routeRegistry = routeRegistry;
  }

  /**
   * Initializes the Trust module, validates artifact consistency,
   * and registers canonical, fixed symbolic routes.
   */
  public initialize(_dependencies: ReadonlyMap<ModuleId, IChallengeModule>): void {
    // 1. Validate internal consistency, integrity, and anti-leakage constraints
    validateTrustArtifacts(TRUST_ARTIFACTS);

    // 2. Register fixed symbolic routes with server-side discovery gating
    for (const [segment, artifact] of Object.entries(TRUST_ARTIFACTS)) {
      const route = parseSimRoute(`sim://trust/${segment}`);

      this.routeRegistry.register(route, 'READ', (context: SimHandlerContext) => {
        // Enforce server-side session context requirement
        if (!context.sessionContext) {
          throw new InsufficientEvidenceError();
        }

        // 3. Inspect server-side discovery state across prior modules
        const metaState =
          context.sessionContext.getNamespaceState<MetadataSessionState>('metadata');
        const auditState =
          context.sessionContext.getNamespaceState<AuditSessionState>('audit');
        const configState =
          context.sessionContext.getNamespaceState<ConfigSessionState>('config');
        const identityState =
          context.sessionContext.getNamespaceState<IdentitySessionState>('identity');

        const discoveredSet = new Set<string>([
          ...(metaState?.discoveredEvidence ?? []),
          ...(auditState?.discoveredEvidence ?? []),
          ...(configState?.discoveredArtifacts ?? []),
          ...(configState?.discoveredEvidence ?? []),
          ...(identityState?.discoveredIdentities ?? []),
          ...(identityState?.discoveredEvidence ?? []),
        ]);

        // 4. Server-side prerequisite evaluation
        const hasAllPrerequisites = artifact.requiredPrerequisites.every((reqId) =>
          discoveredSet.has(reqId)
        );

        if (!hasAllPrerequisites) {
          // Reject request with safe generic error without leaking missing requirements
          throw new InsufficientEvidenceError();
        }

        // 5. Record trust resolution discovery in session context under 'trust' namespace
        const currentTrustState =
          context.sessionContext.getNamespaceState<TrustSessionState>('trust') ?? {
            discoveredResolutions: [],
            discoveredEvidence: [],
            accessCount: 0,
          };

        const updatedResolutions = Array.from(
          new Set([...currentTrustState.discoveredResolutions, artifact.artifactId])
        );

        context.sessionContext.setNamespaceState<TrustSessionState>(
          'trust',
          {
            discoveredResolutions: updatedResolutions,
            discoveredEvidence: updatedResolutions,
            lastAccessedResolution: artifact.artifactId,
            accessCount: currentTrustState.accessCount + 1,
          },
          'trust' // Strict state ownership enforcement
        );

        // 6. Return sanitized, defensively cloned and deeply frozen public evidence response
        return formatEvidenceResponse(artifact);
      });
    }
  }

  public shutdown(): void {
    // In-memory module requires no background resource cleanup
  }
}
